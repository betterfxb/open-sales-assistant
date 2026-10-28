import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const requiredPages = [
  ['/', '咨询助手'],
  ['/login.html', '后台登录'],
  ['/admin.html', '知识库后台管理']
];

const requiredAssets = [
  ['/i18n.js', 'language-toggle']
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Server did not become healthy within 15 seconds.');
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${data.error || 'Unknown error'}`);
  return data;
}

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'open-sales-assistant-'));
  const dataFile = path.join(tempDir, 'db.json');
  await fs.writeFile(dataFile, JSON.stringify({
    schemaVersion: 2,
    students: [{ id: 'legacy-student', nickname: 'Legacy Customer', createdAt: '2026-01-01T00:00:00.000Z' }]
  }), 'utf8');
  const adminUsername = 'smoke-admin';
  const adminPassword = 'SmokeTest@123456';
  const child = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      PUBLIC_BASE_URL: baseUrl,
      AI_API_KEY: '',
      DATA_FILE: dataFile,
      DATA_BACKUP_DIR: path.join(tempDir, 'backups'),
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD: adminPassword
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    const healthResponse = await waitForHealth(baseUrl, child);
    const health = await healthResponse.json();
    if (health.service !== 'open-sales-assistant') {
      throw new Error(`Unexpected service name: ${health.service}`);
    }
    if (health.schemaVersion !== 4) {
      throw new Error(`Expected schema version 4 after migration, received ${health.schemaVersion}.`);
    }
    if (health.storageDriver !== 'json') {
      throw new Error(`Expected JSON storage in smoke test, received ${health.storageDriver}.`);
    }
    if (health.aiConfigured !== false) {
      throw new Error('Smoke test expects AI to be unconfigured.');
    }

    const demoLanguageResponse = await fetch(`${baseUrl}/api/demo-language`);
    const demoLanguage = await demoLanguageResponse.json();
    if (!['en', 'zh-CN'].includes(demoLanguage.language)) {
      throw new Error(`Unexpected demo language: ${demoLanguage.language}`);
    }

    for (const [route, expectedTitle] of requiredPages) {
      const html = await fetchText(`${baseUrl}${route}`);
      if (!html.includes(`<title>${expectedTitle}</title>`)) {
        throw new Error(`${route} did not include expected title: ${expectedTitle}`);
      }
    }

    for (const [route, expectedText] of requiredAssets) {
      const content = await fetchText(`${baseUrl}${route}`);
      if (!content.includes(expectedText)) {
        throw new Error(`${route} did not include expected content: ${expectedText}`);
      }
    }

    const login = await fetchJson(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });
    const authHeaders = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json'
    };

    const legacyCustomers = await fetchJson(`${baseUrl}/api/admin/students`, { headers: authHeaders });
    if (!legacyCustomers.students.some((student) => student.id === 'legacy-student')) {
      throw new Error('Schema migration did not preserve an existing customer.');
    }

    const queueBefore = await fetchJson(`${baseUrl}/api/admin/leads/queue`, { headers: authHeaders });
    const lead = await fetchJson(`${baseUrl}/api/admin/leads`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Smoke Lead', company: 'Example Co', phone: '13800000000',
        stage: 'new', intentLevel: 'high', nextFollowUpAt: queueBefore.today,
        summary: 'Asked for a product demo.'
      })
    });
    if (!lead.lead?.id || lead.lead.owner !== '系统管理员') {
      throw new Error('Lead creation did not assign the current admin as owner.');
    }
    const concurrentLeadResults = await Promise.all(Array.from({ length: 8 }, (_, index) => fetchJson(`${baseUrl}/api/admin/leads`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ name: `Concurrent Lead ${index + 1}`, stage: 'new' })
    })));
    const concurrentLeadIds = concurrentLeadResults.map((item) => item.lead.id);
    const concurrentLeadList = await fetchJson(`${baseUrl}/api/admin/leads`, { headers: authHeaders });
    if (concurrentLeadIds.some((id) => !concurrentLeadList.leads.some((item) => item.id === id))) {
      throw new Error('Concurrent lead writes overwrote one another.');
    }

    const seller = await fetchJson(`${baseUrl}/api/admin/team/members`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ username: 'seller-01', realName: '测试销售', role: 'sales_rep', password: 'SalesSmoke@123' })
    });
    if (seller.member.role !== 'sales_rep' || Object.hasOwn(seller.member, 'passwordHash')) {
      throw new Error('Team member response exposed password data or the wrong role.');
    }
    const manager = await fetchJson(`${baseUrl}/api/admin/team/members`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ username: 'manager-01', realName: '测试主管', role: 'manager', password: 'ManagerSmoke@123' })
    });
    const weakPassword = await fetch(`${baseUrl}/api/admin/team/members`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ username: 'weak-user', realName: '弱密码', role: 'sales_rep', password: 'short' })
    });
    if (weakPassword.status !== 400) throw new Error('Team member creation accepted a weak password.');

    const managerLogin = await fetchJson(`${baseUrl}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'manager-01', password: 'ManagerSmoke@123' })
    });
    const managerHeaders = { Authorization: `Bearer ${managerLogin.token}`, 'Content-Type': 'application/json' };
    await fetchJson(`${baseUrl}/api/admin/leads/${lead.lead.id}`, {
      method: 'PUT', headers: managerHeaders,
      body: JSON.stringify({ ownerId: seller.member.id })
    });
    const privateLead = await fetchJson(`${baseUrl}/api/admin/leads`, {
      method: 'POST', headers: managerHeaders,
      body: JSON.stringify({ name: 'Manager Private Lead', stage: 'new' })
    });
    const managerCannotManageMembers = await fetch(`${baseUrl}/api/admin/team/members`, {
      method: 'POST', headers: managerHeaders,
      body: JSON.stringify({ username: 'manager-extra', realName: '额外账号', role: 'sales_rep', password: 'ManagerExtra@123' })
    });
    if (managerCannotManageMembers.status !== 403) throw new Error('Sales manager unexpectedly gained team administration access.');

    const sellerLogin = await fetchJson(`${baseUrl}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SELLER-01', password: 'SalesSmoke@123' })
    });
    const sellerHeaders = { Authorization: `Bearer ${sellerLogin.token}`, 'Content-Type': 'application/json' };
    const sellerLeads = await fetchJson(`${baseUrl}/api/admin/leads`, { headers: sellerHeaders });
    if (sellerLeads.leads.length !== 1 || sellerLeads.leads[0].id !== lead.lead.id) {
      throw new Error('Sales representative could see a lead assigned to another team member.');
    }
    const forbiddenDetail = await fetch(`${baseUrl}/api/admin/leads/${privateLead.lead.id}`, { headers: sellerHeaders });
    if (forbiddenDetail.status !== 403) throw new Error('Sales representative accessed another member’s lead.');
    const sellerOwnLead = await fetchJson(`${baseUrl}/api/admin/leads`, {
      method: 'POST', headers: sellerHeaders,
      body: JSON.stringify({ name: 'Seller Own Lead', stage: 'new' })
    });
    if (sellerOwnLead.lead.ownerId !== seller.member.id) throw new Error('Sales representative created a lead owned by another account.');
    const forbiddenAssignment = await fetch(`${baseUrl}/api/admin/leads/${sellerOwnLead.lead.id}`, {
      method: 'PUT', headers: sellerHeaders, body: JSON.stringify({ ownerId: login.user.id })
    });
    if (forbiddenAssignment.status !== 403) throw new Error('Sales representative reassigned a lead to another account.');
    const forbiddenDelete = await fetch(`${baseUrl}/api/admin/leads/${sellerOwnLead.lead.id}`, {
      method: 'DELETE', headers: sellerHeaders
    });
    if (forbiddenDelete.status !== 403) throw new Error('Sales representative unexpectedly deleted a lead.');
    const forbiddenLegacyAccess = await fetch(`${baseUrl}/api/settings`, { headers: sellerHeaders });
    if (forbiddenLegacyAccess.status !== 403) throw new Error('Sales representative accessed legacy administration settings.');

    const lastAdminDemotion = await fetch(`${baseUrl}/api/admin/team/members/${login.user.id}`, {
      method: 'PUT', headers: authHeaders, body: JSON.stringify({ role: 'manager' })
    });
    if (lastAdminDemotion.status !== 409) throw new Error('The final super administrator could be demoted.');
    await fetchJson(`${baseUrl}/api/admin/team/members/${seller.member.id}`, {
      method: 'PUT', headers: authHeaders, body: JSON.stringify({ status: 'disabled' })
    });
    const disabledMemberResponse = await fetch(`${baseUrl}/api/admin/me`, { headers: sellerHeaders });
    if (disabledMemberResponse.status !== 401) throw new Error('Disabled team member retained an active session.');

    const leadDetail = await fetchJson(`${baseUrl}/api/admin/leads/${lead.lead.id}`, { headers: authHeaders });
    if (leadDetail.lead.name !== 'Smoke Lead' || leadDetail.activities.length !== 0) {
      throw new Error('Lead detail did not return the new lead and its empty activity list.');
    }

    const invalidStage = await fetch(`${baseUrl}/api/admin/leads/${lead.lead.id}`, {
      method: 'PUT', headers: authHeaders,
      body: JSON.stringify({ stage: 'invented-stage' })
    });
    if (invalidStage.status !== 400) throw new Error('Invalid sales stage was not rejected.');

    const activity = await fetchJson(`${baseUrl}/api/admin/leads/${lead.lead.id}/activities`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ type: 'call', content: 'Confirmed the buyer wants a product demo.' })
    });
    if (activity.activity.type !== 'call' || activity.lead.lastActivityAt !== activity.activity.createdAt) {
      throw new Error('Lead activity was not saved or linked to the lead.');
    }

    const dueQueue = await fetchJson(`${baseUrl}/api/admin/leads/queue`, { headers: authHeaders });
    if (!dueQueue.leads.some((item) => item.id === lead.lead.id)) {
      throw new Error('Lead with a due follow-up date was missing from the queue.');
    }

    const copilotResponse = await fetch(`${baseUrl}/api/admin/leads/${lead.lead.id}/copilot`, {
      method: 'POST', headers: authHeaders
    });
    if (copilotResponse.status !== 503) {
      throw new Error(`Unconfigured AI copilot returned HTTP ${copilotResponse.status}, expected 503.`);
    }

    const csv = [
      '姓名,公司,手机号,邮箱,来源,阶段,负责人,下次跟进日期,意向,备注',
      `张三,甲科技,13900000001,zhang@example.com,活动,新线索,测试销售,${queueBefore.today},高,"需要报价,预算待确认"`,
      `李四,乙科技,13900000001,,官网,已联系,,,中,重复手机号`,
      ',缺少姓名,13900000002,,官网,,,,,缺少姓名'
    ].join('\n');
    const importForm = new FormData();
    importForm.append('file', new Blob([csv], { type: 'text/csv' }), 'leads.csv');
    const importResponse = await fetch(`${baseUrl}/api/admin/leads/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.token}` },
      body: importForm
    });
    const imported = await importResponse.json();
    if (!importResponse.ok) throw new Error(`Lead import returned HTTP ${importResponse.status}: ${imported.error || 'Unknown error'}`);
    if (imported.imported !== 1 || imported.skipped !== 1 || imported.invalid !== 1) {
      throw new Error(`Unexpected lead import counts: ${JSON.stringify({ imported: imported.imported, skipped: imported.skipped, invalid: imported.invalid })}`);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');
    worksheet.addRow(['联系人', '公司', '电话', '阶段', '意向']);
    worksheet.addRow(['王五', '丙科技', '13900000003', '已联系', '中']);
    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    const xlsxForm = new FormData();
    xlsxForm.append('file', new Blob([xlsxBuffer]), 'leads.xlsx');
    const xlsxResponse = await fetch(`${baseUrl}/api/admin/leads/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.token}` },
      body: xlsxForm
    });
    const xlsxImport = await xlsxResponse.json();
    if (!xlsxResponse.ok) throw new Error(`XLSX lead import returned HTTP ${xlsxResponse.status}: ${xlsxImport.error || 'Unknown error'}`);
    if (xlsxImport.imported !== 1 || xlsxImport.leads[0]?.stage !== 'contacted') {
      throw new Error('XLSX import did not preserve the lead stage mapping.');
    }

    await fetchJson(`${baseUrl}/api/admin/leads/${lead.lead.id}`, {
      method: 'DELETE', headers: authHeaders
    });
    await fetchJson(`${baseUrl}/api/admin/leads/${privateLead.lead.id}`, {
      method: 'DELETE', headers: authHeaders
    });
    await fetchJson(`${baseUrl}/api/admin/leads/${sellerOwnLead.lead.id}`, {
      method: 'DELETE', headers: authHeaders
    });
    await Promise.all(concurrentLeadIds.map((id) => fetchJson(`${baseUrl}/api/admin/leads/${id}`, {
      method: 'DELETE', headers: authHeaders
    })));
    const deletedLead = await fetch(`${baseUrl}/api/admin/leads/${lead.lead.id}`, { headers: authHeaders });
    if (deletedLead.status !== 404) throw new Error('Deleted lead was still accessible.');

    const material = await fetchJson(`${baseUrl}/api/materials/text`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Smoke test product',
        category: 'Demo',
        content: 'A practical sales assistant for small teams.'
      })
    });
    const suggestion = material.suggestions[0];
    if (!suggestion) throw new Error('Material analysis did not create a review suggestion.');
    const emptyAcceptance = await fetch(`${baseUrl}/api/knowledge/suggestions/${suggestion.id}/accept`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ content: '' })
    });
    if (emptyAcceptance.status !== 400) {
      throw new Error(`Empty suggestion acceptance returned HTTP ${emptyAcceptance.status}, expected 400.`);
    }
    const editedContent = 'Edited and approved sales guidance.';
    const accepted = await fetchJson(`${baseUrl}/api/knowledge/suggestions/${suggestion.id}/accept`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Reviewed guidance',
        scenario: 'Smoke test',
        content: editedContent
      })
    });
    if (!accepted.knowledge.salesPlaybook.some((item) => item.content === editedContent)) {
      throw new Error('Edited suggestion content was not accepted into the knowledge base.');
    }

    const duplicateResponse = await fetch(`${baseUrl}/api/knowledge/suggestions/${suggestion.id}/accept`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ content: editedContent })
    });
    if (duplicateResponse.status !== 409) {
      throw new Error(`Duplicate suggestion acceptance returned HTTP ${duplicateResponse.status}, expected 409.`);
    }

    console.log('Smoke test passed.');
  } finally {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 1000).unref();
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  if (child.exitCode && child.exitCode !== 0) {
    throw new Error(`Server exited with ${child.exitCode}:\n${output}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
