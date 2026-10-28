const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  currentUser: null,
  teamMembers: [],
  materials: [],
  knowledge: null,
  suggestions: [],
  settings: null,
  students: [],
  chats: [],
  certificates: [],
  leads: [],
  leadStats: {},
  leadQueue: [],
  leadQueuePayload: {},
  selectedLeadId: '',
  selectedLeadDetail: null,
  leadQuery: '',
  leadStageFilter: 'all',
  operationLogs: [],
  selectedStudentId: '',
  selectedStudentDetail: null,
  studentQuery: '',
  studentSort: 'createdAt_desc',
  studentPage: 1,
  studentPageSize: 8
};
const token = localStorage.getItem('adminToken');

if (!token) {
  location.href = '/login.html';
}

function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.add('show');
  setTimeout(() => box.classList.remove('show'), 2200);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    location.href = '/login.html';
    throw new Error(data.error || '请重新登录');
  }
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function publicApi(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function short(text = '', max = 150) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function intentText(level = 'unknown') {
  return ({ high: '高', medium: '中', low: '低', unknown: '未知' })[level] || level || '未知';
}

function intentRank(level = 'unknown') {
  return ({ high: 4, medium: 3, low: 2, unknown: 1 })[level] || 0;
}

function setLoading(button, loadingText) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.textContent = oldText;
  };
}

function renderSettings() {
  if (!state.settings) return;
  const form = $('#settingsForm');
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value || '';
  });
}

function renderMetrics() {
  const knowledge = state.knowledge || {};
  $('#materialCount').textContent = state.materials.length;
  $('#imageCount').textContent = state.materials.filter((item) => item.type === 'image').length;
  $('#faqCount').textContent = (knowledge.faq || []).length;
  $('#playbookCount').textContent = (knowledge.salesPlaybook || []).length;
  $('#overviewPreview').textContent = knowledge.overview || '暂无知识库内容。';
}

function operationActionText(action = '') {
  return ({
    'auth.login': 'Admin signed in',
    'data.export': 'Exported data',
    'data.backup': 'Created backup',
    'student.analyze': 'AI analyzed customer',
    'student.update': 'Updated customer',
    'student.delete': 'Deleted customer',
    'followup.create': 'Added follow-up',
    'lead.create': 'Created lead',
    'lead.import': 'Imported leads',
    'lead.update': 'Updated lead',
    'lead.delete': 'Deleted lead',
    'lead.activity.create': 'Added lead activity',
    'settings.update': 'Updated settings',
    'material.create': 'Added text material',
    'material.upload': 'Uploaded material',
    'material.delete': 'Deleted material',
    'certificate.create': 'Added certificate',
    'certificate.import': 'Imported certificates',
    'certificate.update': 'Updated certificate',
    'certificate.delete': 'Deleted certificate',
    'knowledge.update': 'Updated knowledge base',
    'knowledge.generate': 'Regenerated knowledge base',
    'suggestion.accept': 'Accepted AI suggestion',
    'suggestion.ignore': 'Ignored AI suggestion'
  })[action] || action || 'Operation';
}

function renderOperationLogs() {
  const box = $('#operationLogsList');
  if (!state.operationLogs.length) {
    box.innerHTML = '<p class="empty-text">No operation logs yet.</p>';
    return;
  }
  box.innerHTML = state.operationLogs.slice(0, 8).map((item) => `
    <article class="operation-log-item">
      <strong>${escapeHtml(operationActionText(item.action))}</strong>
      <p>${escapeHtml([item.targetLabel, item.summary].filter(Boolean).join(' · ') || '-')}</p>
      <p>${escapeHtml(item.actorName || 'System')} · ${formatDate(item.createdAt)}</p>
    </article>
  `).join('');
}

function renderStudents() {
  const box = $('#studentsList');
  const query = state.studentQuery.trim().toLowerCase();
  const filtered = state.students.filter((student) => {
    if (!query) return true;
    return [student.nickname, student.name, student.phone, student.currentStatus, student.intentLevel]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  const [sortKey, sortDirection] = state.studentSort.split('_');
  filtered.sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortKey === 'intentLevel') return (intentRank(a.intentLevel) - intentRank(b.intentLevel)) * modifier;
    if (sortKey === 'chatCount') return ((a.chatCount || 0) - (b.chatCount || 0)) * modifier;
    const left = a[sortKey] || '';
    const right = b[sortKey] || '';
    return String(left).localeCompare(String(right), 'zh-Hans-CN') * modifier;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.studentPageSize));
  state.studentPage = Math.min(Math.max(state.studentPage, 1), totalPages);
  const start = (state.studentPage - 1) * state.studentPageSize;
  const pageItems = filtered.slice(start, start + state.studentPageSize);

  $('#studentTotal').textContent = `${filtered.length} 人`;
  $('#studentPageInfo').textContent = `第 ${state.studentPage} / ${totalPages} 页`;
  $('#studentPrevPage').disabled = state.studentPage <= 1;
  $('#studentNextPage').disabled = state.studentPage >= totalPages;

  if (!pageItems.length) {
    box.innerHTML = '<div class="detail-empty">没有匹配的学员。</div>';
    return;
  }
  box.innerHTML = pageItems.map((student) => `
    <article class="student-row ${state.selectedStudentId === student.id ? 'active' : ''}" data-id="${student.id}">
      <div class="student-row-main">
        <strong>${escapeHtml(student.name || student.nickname)}</strong>
        <p>${escapeHtml(student.nickname)} · ${escapeHtml(student.phone || '未留电话')} · 聊天 ${student.chatCount || 0} 条</p>
        <p>${escapeHtml(student.currentStatus || '暂无现状')} · 最近咨询：${formatDate(student.lastChatAt)}</p>
      </div>
      <div class="student-row-side">
        <span class="intent-badge ${student.intentLevel || 'unknown'}">${intentText(student.intentLevel)}</span>
        <button class="delete-btn delete-student-list" data-id="${student.id}" type="button">删除</button>
      </div>
    </article>
  `).join('');
  box.querySelectorAll('.student-row').forEach((row) => {
    row.addEventListener('click', () => loadStudentDetail(row.dataset.id));
  });
  box.querySelectorAll('.delete-student-list').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteStudent(button.dataset.id);
    });
  });
}

function fillStudentProfile(detail) {
  const student = detail.student;
  const form = $('#studentProfileForm');
  ['nickname', 'name', 'phone', 'age', 'gender', 'idCard', 'currentStatus', 'intentLevel', 'profileSummary', 'nextAction'].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = student[key] || '';
  });
  $('#detailTitle').textContent = `${student.name || student.nickname} · 学员画像`;
  $('#detailMeta').textContent = `编号：${student.userCode || '-'} · 注册：${formatDate(student.createdAt)} · 最近登录：${formatDate(student.lastLoginAt)}`;
  const analysis = detail.analysis;
  $('#studentAnalysisBox').innerHTML = analysis ? `
    <h3>AI 分析结果</h3>
    <p>${escapeHtml(analysis.summary || '')}</p>
    <p>意向：${intentText(analysis.intentLevel)}</p>
    <p>顾虑：${escapeHtml((analysis.concerns || []).join('、') || '-')}</p>
    <p>关注项目：${escapeHtml((analysis.interestedProjects || analysis.interestedCourses || []).join('、') || '-')}</p>
    <p>下一步：${escapeHtml(analysis.nextAction || '-')}</p>
    <p class="muted-line">分析时间：${formatDate(analysis.createdAt)}</p>
  ` : '暂无 AI 分析。';
}

function renderStudentChats(detail) {
  $('#studentFollowUps').innerHTML = (detail.followUps || []).length ? detail.followUps.map((item) => `
    <article class="mini-card">
      <p>${escapeHtml(item.content)}</p>
      <p>${escapeHtml(item.adminName || '-')} · ${formatDate(item.createdAt)}</p>
    </article>
  `).join('') : '<p class="empty-text">暂无跟进记录。</p>';

  $('#studentChats').innerHTML = (detail.chats || []).length ? detail.chats.map((chat) => `
    <article class="chat-record-card">
      <p><b>${escapeHtml(chat.studentNickname || detail.student.nickname)}：</b>${escapeHtml(chat.question)}</p>
      <p><b>销售：</b>${escapeHtml(chat.answer)}</p>
      ${(chat.images || []).length ? `<div class="record-images">${chat.images.map((image) => `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.title || '')}">`).join('')}</div>` : ''}
      <span>${formatDate(chat.createdAt)}</span>
    </article>
  `).join('') : '<p class="empty-text">暂无聊天记录。</p>';
}

async function loadStudentDetail(id) {
  try {
    const detail = await api(`/api/admin/students/${id}`);
    state.selectedStudentId = id;
    state.selectedStudentDetail = detail;
    $('#studentDetailEmpty').classList.add('hidden');
    $('#studentDetail').classList.remove('hidden');
    fillStudentProfile(detail);
    renderStudentChats(detail);
    renderStudents();
    history.replaceState(null, '', `#student=${encodeURIComponent(id)}`);
  } catch (error) {
    toast(error.message);
  }
}

async function deleteStudent(id = state.selectedStudentId) {
  if (!id) return;
  const student = state.students.find((item) => item.id === id) || state.selectedStudentDetail?.student;
  if (!confirm(`确定删除学员「${student?.name || student?.nickname || id}」吗？聊天记录和跟进记录也会一起删除。`)) return;
  try {
    await api(`/api/admin/students/${id}`, { method: 'DELETE' });
    if (state.selectedStudentId === id) {
      state.selectedStudentId = '';
      state.selectedStudentDetail = null;
      $('#studentDetail').classList.add('hidden');
      $('#studentDetailEmpty').classList.remove('hidden');
      history.replaceState(null, '', location.pathname);
    }
    await loadAll();
    toast('学员已删除');
  } catch (error) {
    toast(error.message);
  }
}

function renderCertificates() {
  const box = $('#certificatesList');
  if (!state.certificates.length) {
    box.textContent = '暂无证书';
    return;
  }
  box.innerHTML = state.certificates.map((cert) => `
    <article class="table-row">
      <div>
        <strong>${cert.name} · ${cert.status || '-'}</strong>
        <p>手机号：${cert.phone || '-'} · 项目：${cert.courseTitle || '-'}</p>
        <p>证书编号：${cert.certNo || '-'} · 发放时间：${cert.issuedAt || '-'}</p>
      </div>
      <button class="delete-btn delete-cert" data-id="${cert.id}" type="button">删除</button>
    </article>
  `).join('');
  box.querySelectorAll('.delete-cert').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('确定删除证书记录吗？')) return;
      await api(`/api/admin/certificates/${button.dataset.id}`, { method: 'DELETE' });
      await loadAll();
      toast('证书已删除');
    });
  });
}

function renderMaterials() {
  const box = $('#materialsList');
  if (!state.materials.length) {
    box.textContent = '暂无素材';
    return;
  }
  box.innerHTML = state.materials.map((item) => {
    const summary = item.analysis?.summary || item.extractedText || item.content || item.description || '';
    const image = item.type === 'image' ? `<img src="${item.url}" alt="${item.title}">` : '';
    return `
      <article class="material-card">
        <div>
          <strong>${item.title}</strong>
          <p>${item.category || '未分类'} · ${item.type} · ${new Date(item.createdAt).toLocaleString()}</p>
          <p>${short(summary)}</p>
          ${image}
        </div>
        <button class="delete-btn" type="button" data-id="${item.id}">删除</button>
      </article>
    `;
  }).join('');
  box.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('确定删除这条素材吗？')) return;
      await api(`/api/materials/${button.dataset.id}`, { method: 'DELETE' });
      await loadAll();
      toast('素材已删除，相关待审核建议已清理');
    });
  });
}

function renderKnowledgeEditor() {
  const knowledge = state.knowledge || {};
  $('#knowledgeOverview').value = knowledge.overview || '';
  renderPlaybookEditor(knowledge.salesPlaybook || []);
  renderStructuredEditor('faqEditor', knowledge.faq || [], {
    emptyText: '暂无常见问题，点击“添加问题”开始填写。',
    firstName: 'question',
    firstLabel: '问题',
    firstPlaceholder: '例如：零基础可以学吗？',
    secondName: 'answer',
    secondLabel: '标准答复',
    secondPlaceholder: '填写销售顾问可直接使用的答复'
  });
  renderStructuredEditor('concernsEditor', knowledge.concerns || [], {
    emptyText: '暂无顾虑应对，点击“添加顾虑”开始填写。',
    firstName: 'concern',
    firstLabel: '顾虑',
    firstPlaceholder: '例如：担心工作忙没时间上课',
    secondName: 'response',
    secondLabel: '应对话术',
    secondPlaceholder: '填写安抚、解释和引导下一步的话术'
  });
  renderSuggestions();
}

function normalizePlaybookForUi(item, index = 0) {
  if (typeof item === 'string') {
    return { title: `销售话术 ${index + 1}`, scenario: '', content: item };
  }
  return {
    title: item.title || `销售话术 ${index + 1}`,
    scenario: item.scenario || '',
    content: item.content || item.text || '',
    conflicts: item.conflicts || []
  };
}

function renderPlaybookEditor(items) {
  const box = $('#salesPlaybook');
  const normalized = items.map(normalizePlaybookForUi).filter((item) => item.content || item.title || item.scenario);
  if (!normalized.length) {
    box.innerHTML = '<div class="detail-empty compact">暂无销售话术，点击“添加话术”开始填写。</div>';
    return;
  }
  box.innerHTML = normalized.map((item, index) => `
    <article class="structured-item playbook-item">
      <div class="structured-item-head">
        <strong>${index + 1}</strong>
        <button class="delete-btn remove-structured" type="button">删除</button>
      </div>
      ${renderConflictText(item.conflicts)}
      <label>话术标题<input name="title" value="${escapeHtml(item.title || '')}" placeholder="例如：零基础咨询开场"></label>
      <label>使用场景<input name="scenario" value="${escapeHtml(item.scenario || '')}" placeholder="例如：零基础 / 价格顾虑 / 证书咨询"></label>
      <label>话术内容<textarea name="content" rows="4" placeholder="填写销售顾问可直接使用的话术">${escapeHtml(item.content || '')}</textarea></label>
    </article>
  `).join('');
  box.querySelectorAll('.remove-structured').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.structured-item').remove();
      if (!box.querySelector('.structured-item')) renderPlaybookEditor([]);
    });
  });
}

function addPlaybookItem() {
  const box = $('#salesPlaybook');
  if (!box.querySelector('.structured-item')) box.innerHTML = '';
  const index = box.querySelectorAll('.structured-item').length + 1;
  box.insertAdjacentHTML('beforeend', `
    <article class="structured-item playbook-item">
      <div class="structured-item-head">
        <strong>${index}</strong>
        <button class="delete-btn remove-structured" type="button">删除</button>
      </div>
      <label>话术标题<input name="title" placeholder="例如：零基础咨询开场"></label>
      <label>使用场景<input name="scenario" placeholder="例如：零基础 / 价格顾虑 / 证书咨询"></label>
      <label>话术内容<textarea name="content" rows="4" placeholder="填写销售顾问可直接使用的话术"></textarea></label>
    </article>
  `);
  box.lastElementChild.querySelector('.remove-structured').addEventListener('click', (event) => {
    event.currentTarget.closest('.structured-item').remove();
  });
}

function collectPlaybookItems() {
  return $$('#salesPlaybook .structured-item')
    .map((item) => ({
      title: item.querySelector('[name="title"]')?.value.trim() || '',
      scenario: item.querySelector('[name="scenario"]')?.value.trim() || '',
      content: item.querySelector('[name="content"]')?.value.trim() || '',
      conflicts: []
    }))
    .filter((item) => item.title || item.scenario || item.content);
}

function renderConflictText(conflicts = []) {
  if (!conflicts.length) return '';
  return `<p class="conflict-text">${conflicts.map((item) => escapeHtml(item.reason || '可能与已有词条重复或冲突')).join('；')}</p>`;
}

function suggestionTitle(suggestion) {
  if (suggestion.type === 'playbook') return `销售话术：${suggestion.title || '未命名话术'}`;
  if (suggestion.type === 'faq') return `常见问题：${suggestion.question || '未填写问题'}`;
  if (suggestion.type === 'concern') return `顾虑应对：${suggestion.concern || '未填写顾虑'}`;
  return '建议词条';
}

function suggestionFields(suggestion) {
  if (suggestion.type === 'playbook') return [
    ['title', '话术标题', suggestion.title, '例如：价格咨询跟进'],
    ['scenario', '使用场景', suggestion.scenario, '例如：客户询问价格后'],
    ['content', '话术内容', suggestion.content, '审核并修改可直接使用的话术', true]
  ];
  if (suggestion.type === 'faq') return [
    ['question', '问题', suggestion.question, '客户常问的问题'],
    ['answer', '标准答复', suggestion.answer, '审核并修改标准答复', true]
  ];
  if (suggestion.type === 'concern') return [
    ['concern', '顾虑', suggestion.concern, '客户可能提出的顾虑'],
    ['response', '应对话术', suggestion.response, '审核并修改应对话术', true]
  ];
  return [];
}

function renderSuggestionFields(suggestion) {
  return suggestionFields(suggestion).map(([name, label, value, placeholder, multiline]) => `
    <label>${label}${multiline
      ? `<textarea name="${name}" rows="4" placeholder="${placeholder}">${escapeHtml(value || '')}</textarea>`
      : `<input name="${name}" value="${escapeHtml(value || '')}" placeholder="${placeholder}">`}
    </label>
  `).join('');
}

function renderSuggestions() {
  const box = $('#suggestionsList');
  $('#suggestionCount').textContent = `${state.suggestions.length} 条待审核`;
  if (!state.suggestions.length) {
    box.innerHTML = '<div class="detail-empty compact">暂无待审核建议。上传新素材后，AI 会把建议词条放在这里。</div>';
    return;
  }
  box.innerHTML = state.suggestions.map((suggestion) => `
    <article class="structured-item suggestion-item">
      <div class="structured-item-head">
        <div>
          <strong>${escapeHtml(suggestionTitle(suggestion))}</strong>
          <p class="muted-line">来源：${escapeHtml(suggestion.sourceMaterialTitle || '-')}</p>
        </div>
        <div class="suggestion-actions">
          <button class="secondary-btn accept-suggestion" data-id="${suggestion.id}" type="button">采纳</button>
          <button class="ghost-btn ignore-suggestion" data-id="${suggestion.id}" type="button">忽略</button>
        </div>
      </div>
      ${renderConflictText(suggestion.conflicts)}
      <div class="suggestion-edit-fields">
        ${renderSuggestionFields(suggestion)}
      </div>
    </article>
  `).join('');
  box.querySelectorAll('.accept-suggestion').forEach((button) => {
    button.addEventListener('click', () => acceptSuggestion(button.dataset.id));
  });
  box.querySelectorAll('.ignore-suggestion').forEach((button) => {
    button.addEventListener('click', () => ignoreSuggestion(button.dataset.id));
  });
}

function renderStructuredEditor(id, items, config) {
  const box = $(`#${id}`);
  if (!items.length) {
    box.innerHTML = `<div class="detail-empty compact">${config.emptyText}</div>`;
    return;
  }
  box.innerHTML = items.map((item, index) => `
    <article class="structured-item">
      <div class="structured-item-head">
        <strong>${index + 1}</strong>
        <button class="delete-btn remove-structured" type="button">删除</button>
      </div>
      <label>${config.firstLabel}<input name="${config.firstName}" value="${escapeHtml(item[config.firstName] || '')}" placeholder="${config.firstPlaceholder}"></label>
      <label>${config.secondLabel}<textarea name="${config.secondName}" rows="4" placeholder="${config.secondPlaceholder}">${escapeHtml(item[config.secondName] || '')}</textarea></label>
    </article>
  `).join('');
  box.querySelectorAll('.remove-structured').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.structured-item').remove();
      if (!box.querySelector('.structured-item')) renderStructuredEditor(id, [], config);
    });
  });
}

function addStructuredItem(id, config) {
  const box = $(`#${id}`);
  if (!box.querySelector('.structured-item')) box.innerHTML = '';
  const index = box.querySelectorAll('.structured-item').length + 1;
  box.insertAdjacentHTML('beforeend', `
    <article class="structured-item">
      <div class="structured-item-head">
        <strong>${index}</strong>
        <button class="delete-btn remove-structured" type="button">删除</button>
      </div>
      <label>${config.firstLabel}<input name="${config.firstName}" placeholder="${config.firstPlaceholder}"></label>
      <label>${config.secondLabel}<textarea name="${config.secondName}" rows="4" placeholder="${config.secondPlaceholder}"></textarea></label>
    </article>
  `);
  box.lastElementChild.querySelector('.remove-structured').addEventListener('click', (event) => {
    event.currentTarget.closest('.structured-item').remove();
  });
}

function collectStructuredItems(id, firstName, secondName) {
  return $$(`#${id} .structured-item`)
    .map((item) => ({
      [firstName]: item.querySelector(`[name="${firstName}"]`)?.value.trim() || '',
      [secondName]: item.querySelector(`[name="${secondName}"]`)?.value.trim() || ''
    }))
    .filter((item) => item[firstName] || item[secondName]);
}

async function acceptSuggestion(id) {
  const item = $(`.suggestion-item [data-id="${id}"]`)?.closest('.suggestion-item');
  const suggestion = state.suggestions.find((entry) => entry.id === id);
  if (!item || !suggestion) return;
  const payload = Object.fromEntries(suggestionFields(suggestion).map(([name]) => [
    name,
    item.querySelector(`[name="${name}"]`)?.value.trim() || ''
  ]));
  const button = item.querySelector('.accept-suggestion');
  const restore = setLoading(button, '采纳中...');
  try {
    await api(`/api/knowledge/suggestions/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await loadAll();
    toast('建议已采纳到正式知识库');
  } catch (error) {
    toast(error.message);
  } finally {
    restore();
  }
}

async function ignoreSuggestion(id) {
  if (!confirm('确定忽略这条建议吗？')) return;
  try {
    await api(`/api/knowledge/suggestions/${id}/ignore`, { method: 'POST' });
    await loadAll();
    toast('建议已忽略');
  } catch (error) {
    toast(error.message);
  }
}

const leadStageText = {
  new: '新线索', contacted: '已联系', qualified: '需求明确', proposal: '方案 / 报价', won: '已成交', lost: '已关闭'
};

const leadActivityText = {
  call: '电话', message: '微信 / 消息', meeting: '会议', email: '邮件', note: '其他'
};

function formatShortDate(value) {
  if (!value) return '未安排';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function renderLeadMetrics(stats = {}) {
  $('#leadOpenCount').textContent = stats.total || 0;
  $('#leadDueCount').textContent = stats.dueToday || 0;
  $('#leadHighIntentCount').textContent = stats.highIntent || 0;
  $('#leadWonCount').textContent = stats.won || 0;
}

function renderLeads() {
  const box = $('#leadsList');
  const query = state.leadQuery.trim().toLowerCase();
  const filtered = state.leads.filter((lead) => {
    if (state.leadStageFilter !== 'all' && lead.stage !== state.leadStageFilter) return false;
    if (!query) return true;
    return [lead.name, lead.company, lead.phone, lead.email, lead.owner, lead.source, lead.summary]
      .join(' ').toLowerCase().includes(query);
  });
  filtered.sort((left, right) => {
    if (left.nextFollowUpAt && right.nextFollowUpAt) return left.nextFollowUpAt.localeCompare(right.nextFollowUpAt);
    if (left.nextFollowUpAt) return -1;
    if (right.nextFollowUpAt) return 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  $('#leadTotal').textContent = `${filtered.length} 条`;
  if (!filtered.length) {
    box.innerHTML = `<div class="detail-empty">${query || state.leadStageFilter !== 'all' ? '没有符合条件的线索。' : '添加第一条线索，或导入已有客户名单。'}</div>`;
    return;
  }
  box.innerHTML = filtered.map((lead) => `
    <article class="student-row lead-row ${state.selectedLeadId === lead.id ? 'active' : ''}" data-id="${escapeHtml(lead.id)}" tabindex="0" role="button" aria-label="查看 ${escapeHtml(lead.name)}">
      <div class="student-row-main lead-row-main">
        <strong>${escapeHtml(lead.name)}</strong>
        <p>${escapeHtml([lead.company, lead.phone].filter(Boolean).join(' · ') || '未填写公司和电话')}</p>
        <p>负责人：${escapeHtml(lead.owner || '未分配')} · 最近更新：${formatDate(lead.lastActivityAt || lead.updatedAt)}</p>
      </div>
      <div class="student-row-side lead-badges">
        <span class="lead-stage-badge ${lead.stage === 'won' || lead.stage === 'lost' ? lead.stage : ''}">${escapeHtml(leadStageText[lead.stage] || lead.stage)}</span>
        <span class="intent-badge ${lead.intentLevel || 'unknown'}">意向${intentText(lead.intentLevel)}</span>
        <span class="lead-next-date">下次：${formatShortDate(lead.nextFollowUpAt)}</span>
      </div>
    </article>
  `).join('');
  box.querySelectorAll('.lead-row').forEach((row) => {
    row.addEventListener('click', () => loadLeadDetail(row.dataset.id));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadLeadDetail(row.dataset.id);
      }
    });
  });
}

function renderLeadQueue(data = {}) {
  state.leadQueue = data.leads || [];
  const overdueCount = data.overdueCount || 0;
  $('#leadOverdueBadge').textContent = overdueCount ? `${overdueCount} 条已逾期` : '暂无逾期';
  $('#leadOverdueBadge').classList.toggle('warning', overdueCount > 0);
  const box = $('#leadQueueList');
  if (!state.leadQueue.length) {
    box.innerHTML = '<p class="empty-text">暂无待跟进线索。</p>';
    return;
  }
  const today = data.today || new Date().toISOString().slice(0, 10);
  box.innerHTML = state.leadQueue.map((lead) => {
    const overdue = lead.nextFollowUpAt.slice(0, 10) < today;
    return `
      <button class="lead-queue-item ${overdue ? 'overdue' : ''}" type="button" data-id="${escapeHtml(lead.id)}">
        <strong>${escapeHtml(lead.name)} · ${escapeHtml(lead.company || '未填写公司')}</strong>
        <span>${overdue ? '已逾期' : '今天'} ${escapeHtml(formatShortDate(lead.nextFollowUpAt))} · ${escapeHtml(leadStageText[lead.stage] || lead.stage)}</span>
        <span>负责人：${escapeHtml(lead.owner || '未分配')} · 意向${intentText(lead.intentLevel)}</span>
      </button>
    `;
  }).join('');
  box.querySelectorAll('.lead-queue-item').forEach((button) => {
    button.addEventListener('click', () => loadLeadDetail(button.dataset.id));
  });
}

function renderLeadOwnerSelects() {
  const activeMembers = state.teamMembers.filter((member) => member.status === 'active');
  const assignable = state.currentUser?.role === 'sales_rep'
    ? activeMembers.filter((member) => member.id === state.currentUser.id)
    : activeMembers;
  for (const select of [$('#leadCreateOwner'), $('#leadEditOwner')]) {
    if (!select) continue;
    const selected = select.value;
    select.innerHTML = assignable.map((member) =>
      `<option value="${escapeHtml(member.id)}">${escapeHtml(member.realName || member.username)}</option>`
    ).join('');
    if (assignable.some((member) => member.id === selected)) select.value = selected;
    else if (state.currentUser && assignable.some((member) => member.id === state.currentUser.id)) select.value = state.currentUser.id;
  }
}

function renderTeamMembers() {
  const box = $('#teamMembersList');
  if (!box || state.currentUser?.role !== 'super_admin') return;
  if (!state.teamMembers.length) {
    box.textContent = '暂无团队成员';
    return;
  }
  box.innerHTML = state.teamMembers.map((member) => `
    <div class="team-member-row" data-id="${escapeHtml(member.id)}">
      <div><strong>${escapeHtml(member.realName || member.username)}</strong><span>${escapeHtml(member.username)}</span></div>
      <select class="team-member-role" aria-label="${escapeHtml(member.username)} 的角色">
        <option value="sales_rep" ${member.role === 'sales_rep' ? 'selected' : ''}>销售</option>
        <option value="manager" ${member.role === 'manager' ? 'selected' : ''}>销售主管</option>
        <option value="super_admin" ${member.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
      </select>
      <span class="status-pill ${member.status === 'active' ? 'ok' : ''}">${member.status === 'active' ? '启用' : '停用'}</span>
      <div class="team-member-actions">
        <button class="secondary-btn" data-action="save" type="button">保存角色</button>
        <button class="ghost-btn" data-action="toggle" type="button">${member.status === 'active' ? '停用' : '启用'}</button>
        <button class="ghost-btn" data-action="password" type="button">重置密码</button>
      </div>
    </div>
  `).join('');
}

function renderLeadDetail(detail) {
  const { lead, activities = [] } = detail;
  const form = $('#leadEditForm');
  ['name', 'company', 'phone', 'email', 'source', 'stage', 'nextFollowUpAt', 'intentLevel', 'summary'].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = lead[key] || '';
  });
  if (form.elements.ownerId) form.elements.ownerId.value = lead.ownerId || '';
  $('#leadDetailTitle').textContent = `${lead.name}${lead.company ? ` · ${lead.company}` : ''}`;
  $('#leadDetailMeta').textContent = `创建于 ${formatDate(lead.createdAt)} · ${activities.length} 条沟通记录`;
  $('#leadActivityList').innerHTML = activities.length ? activities.map((activity) => `
    <article class="lead-activity-item">
      <p>${escapeHtml(activity.content)}</p>
      <span>${escapeHtml(leadActivityText[activity.type] || activity.type)} · ${escapeHtml(activity.ownerName || '未记录负责人')} · ${formatDate(activity.createdAt)}</span>
    </article>
  `).join('') : '<p class="empty-text">暂无沟通记录。</p>';
  const suggestion = detail.suggestion;
  const suggestionBox = $('#leadAiSuggestion');
  if (!suggestion) {
    suggestionBox.classList.add('hidden');
    suggestionBox.innerHTML = '';
    return;
  }
  suggestionBox.classList.remove('hidden');
  suggestionBox.innerHTML = `
    <h3>AI 跟进建议 · 请人工核对</h3>
    <p><b>线索判断：</b>${escapeHtml(suggestion.summary || '暂无')}</p>
    <p><b>下一步：</b>${escapeHtml(suggestion.nextStep || '暂无')}</p>
    <label>消息草稿（可编辑，系统不会自动发送）<textarea id="leadDraftText" rows="4">${escapeHtml(suggestion.messageDraft || '')}</textarea></label>
    ${suggestion.missingInfo?.length ? `<p><b>建议补充：</b>${escapeHtml(suggestion.missingInfo.join('、'))}</p>` : ''}
    ${suggestion.riskFlags?.length ? `<p><b>待确认：</b>${escapeHtml(suggestion.riskFlags.join('、'))}</p>` : ''}
  `;
}

async function loadLeadDetail(id) {
  try {
    const detail = await api(`/api/admin/leads/${encodeURIComponent(id)}`);
    state.selectedLeadId = id;
    state.selectedLeadDetail = detail;
    $('#leadDetailEmpty').classList.add('hidden');
    $('#leadDetail').classList.remove('hidden');
    renderLeadDetail(detail);
    renderLeads();
    history.replaceState(null, '', `#lead=${encodeURIComponent(id)}`);
  } catch (error) {
    toast(error.message);
  }
}

async function deleteLead() {
  const lead = state.selectedLeadDetail?.lead;
  if (!lead || !confirm(`确定删除线索「${lead.name}」及其全部沟通记录吗？`)) return;
  try {
    await api(`/api/admin/leads/${encodeURIComponent(lead.id)}`, { method: 'DELETE' });
    state.selectedLeadId = '';
    state.selectedLeadDetail = null;
    $('#leadDetail').classList.add('hidden');
    $('#leadDetailEmpty').classList.remove('hidden');
    history.replaceState(null, '', location.pathname);
    await loadAll();
    toast('线索已删除');
  } catch (error) {
    toast(error.message);
  }
}

function bindLeadForms() {
  $('#toggleLeadCreateBtn').addEventListener('click', () => {
    $('#leadCreateForm').classList.toggle('hidden');
    if (!$('#leadCreateForm').classList.contains('hidden')) $('#leadCreateForm').elements.name.focus();
  });
  $('#cancelLeadCreateBtn').addEventListener('click', () => {
    $('#leadCreateForm').reset();
    $('#leadCreateForm').classList.add('hidden');
  });
  $('#leadCreateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const done = setLoading(form.querySelector('[type="submit"]'), '保存中...');
    try {
      const data = await api('/api/admin/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      form.reset();
      form.classList.add('hidden');
      state.selectedLeadId = data.lead.id;
      await loadAll();
      await loadLeadDetail(data.lead.id);
      toast('线索已创建');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });
  $('#leadImportForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = $('#leadImportFile').files[0];
    if (!file) return toast('请选择 CSV 或 XLSX 文件');
    const done = setLoading(form.querySelector('button'), '导入中...');
    try {
      const data = await api('/api/admin/leads/import', { method: 'POST', body: new FormData(form) });
      form.reset();
      await loadAll();
      toast(`已导入 ${data.imported} 条，重复 ${data.skipped} 条，无效 ${data.invalid} 条`);
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });
  $('#leadSearch').addEventListener('input', (event) => {
    state.leadQuery = event.target.value;
    renderLeads();
  });
  $('#leadStageFilter').addEventListener('change', (event) => {
    state.leadStageFilter = event.target.value;
    renderLeads();
  });
  $('#leadEditForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedLeadId) return;
    const form = event.currentTarget;
    const done = setLoading(form.querySelector('[type="submit"]'), '保存中...');
    try {
      await api(`/api/admin/leads/${encodeURIComponent(state.selectedLeadId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadAll();
      toast('线索资料已保存');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });
  $('#leadActivityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedLeadId) return;
    const form = event.currentTarget;
    const done = setLoading(form.querySelector('[type="submit"]'), '保存中...');
    try {
      await api(`/api/admin/leads/${encodeURIComponent(state.selectedLeadId)}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      form.reset();
      await loadAll();
      toast('沟通记录已保存');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });
  $('#leadCopilotBtn').addEventListener('click', async (event) => {
    if (!state.selectedLeadId) return;
    const done = setLoading(event.currentTarget, '分析中...');
    try {
      const data = await api(`/api/admin/leads/${encodeURIComponent(state.selectedLeadId)}/copilot`, { method: 'POST' });
      state.selectedLeadDetail.suggestion = data.suggestion;
      renderLeadDetail(state.selectedLeadDetail);
      toast('建议已生成，请核对后使用');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });
  $('#deleteLeadBtn').addEventListener('click', deleteLead);
}

function renderAll() {
  renderSettings();
  renderMetrics();
  renderLeadMetrics(state.leadStats);
  renderLeadQueue(state.leadQueuePayload);
  renderLeads();
  renderOperationLogs();
  renderStudents();
  renderCertificates();
  renderMaterials();
  renderKnowledgeEditor();
}

async function loadAll() {
  if (state.currentUser?.role === 'sales_rep') {
    const [leadsData, leadQueueData] = await Promise.all([
      api('/api/admin/leads'),
      api('/api/admin/leads/queue')
    ]);
    state.leads = leadsData.leads || [];
    state.leadStats = leadsData.stats || {};
    state.leadQueuePayload = leadQueueData;
    state.teamMembers = [state.currentUser];
    renderAll();
    renderLeadOwnerSelects();
    if (state.selectedLeadId && state.leads.some((lead) => lead.id === state.selectedLeadId)) {
      await loadLeadDetail(state.selectedLeadId);
    }
    return;
  }
  const [settingsData, materialsData, knowledgeData, studentsData, certificatesData, operationLogsData, leadsData, leadQueueData, teamData] = await Promise.all([
    api('/api/settings'),
    api('/api/materials'),
    api('/api/knowledge'),
    api('/api/admin/students'),
    api('/api/admin/certificates'),
    api('/api/admin/operation-logs'),
    api('/api/admin/leads'),
    api('/api/admin/leads/queue'),
    api('/api/admin/team')
  ]);
  state.settings = settingsData.settings;
  state.materials = materialsData.materials || [];
  state.knowledge = knowledgeData.knowledge;
  state.suggestions = knowledgeData.suggestions || [];
  state.students = studentsData.students || [];
  state.certificates = certificatesData.certificates || [];
  state.operationLogs = operationLogsData.operationLogs || [];
  state.leads = leadsData.leads || [];
  state.leadStats = leadsData.stats || {};
  state.leadQueuePayload = leadQueueData;
  state.teamMembers = teamData.members || [];
  renderAll();
  renderLeadOwnerSelects();
  renderTeamMembers();
  if (state.selectedStudentId && state.students.some((student) => student.id === state.selectedStudentId)) {
    await loadStudentDetail(state.selectedStudentId);
  }
  if (state.selectedLeadId && state.leads.some((lead) => lead.id === state.selectedLeadId)) {
    await loadLeadDetail(state.selectedLeadId);
  }
}

async function checkHealth() {
  try {
    const data = await publicApi('/api/health');
    const box = $('#healthStatus');
    box.textContent = data.aiConfigured ? `AI 已配置：${data.textModel}` : '未配置 API Key：本地兜底';
    box.classList.add('ok');
  } catch {
    $('#healthStatus').textContent = '服务异常';
  }
}

async function checkAdmin() {
  const data = await api('/api/admin/me');
  state.currentUser = data.user;
  $('#adminUser').textContent = data.user.realName || data.user.username;
  if (data.user.role === 'super_admin') $('#teamTab').classList.remove('hidden');
  if (data.user.role === 'sales_rep') {
    ['dashboardPanel', 'studentsPanel', 'materialsPanel', 'knowledgePanel', 'settingsPanel'].forEach((panel) => {
      $(`[data-panel="${panel}"]`)?.classList.add('hidden');
    });
    $('#deleteLeadBtn').classList.add('hidden');
  }
}

function bindNavigation() {
  $$('.admin-tab').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.admin-tab').forEach((item) => item.classList.remove('active'));
      $$('.admin-panel').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      $(`#${button.dataset.panel}`).classList.add('active');
    });
  });
}

function bindTeamForm() {
  const form = $('#teamMemberForm');
  const list = $('#teamMembersList');
  if (!form || !list) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const done = setLoading(form.querySelector('[type="submit"]'), '创建中...');
    try {
      await api('/api/admin/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      form.reset();
      await loadAll();
      toast('团队账号已创建');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    const row = button?.closest('.team-member-row');
    const member = state.teamMembers.find((item) => item.id === row?.dataset.id);
    if (!button || !member) return;
    try {
      if (button.dataset.action === 'password') {
        const password = prompt('输入至少 12 位的新密码：');
        if (!password) return;
        await api(`/api/admin/team/members/${encodeURIComponent(member.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
        });
      } else if (button.dataset.action === 'toggle') {
        const status = member.status === 'active' ? 'disabled' : 'active';
        await api(`/api/admin/team/members/${encodeURIComponent(member.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
        });
      } else if (button.dataset.action === 'save') {
        const role = row.querySelector('.team-member-role').value;
        await api(`/api/admin/team/members/${encodeURIComponent(member.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role })
        });
      }
      await loadAll();
      toast('成员账号已更新');
    } catch (error) {
      toast(error.message);
    }
  });
}

function bindForms() {
  bindLeadForms();
  bindTeamForm();
  $('#studentSearch').addEventListener('input', (event) => {
    state.studentQuery = event.target.value;
    state.studentPage = 1;
    renderStudents();
  });

  $('#studentSort').addEventListener('change', (event) => {
    state.studentSort = event.target.value;
    state.studentPage = 1;
    renderStudents();
  });

  $('#studentPrevPage').addEventListener('click', () => {
    state.studentPage -= 1;
    renderStudents();
  });

  $('#studentNextPage').addEventListener('click', () => {
    state.studentPage += 1;
    renderStudents();
  });

  $$('.detail-tab').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.detail-tab').forEach((item) => item.classList.remove('active'));
      $$('.student-detail-view').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      $(`#student${button.dataset.studentView === 'profile' ? 'Profile' : 'Chats'}View`).classList.add('active');
    });
  });

  $('#studentProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedStudentId) return;
    const done = setLoading(event.currentTarget.querySelector('button'), '保存中...');
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const data = await api(`/api/admin/students/${state.selectedStudentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.selectedStudentDetail.student = { ...state.selectedStudentDetail.student, ...data.student };
      await loadAll();
      toast('学员资料已保存');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#analyzeDetailBtn').addEventListener('click', async (event) => {
    if (!state.selectedStudentId) return;
    const done = setLoading(event.currentTarget, 'AI 分析中...');
    try {
      await api(`/api/admin/students/${state.selectedStudentId}/analyze`, { method: 'POST' });
      await loadStudentDetail(state.selectedStudentId);
      await loadAll();
      toast('AI 分析已填充学员画像');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#deleteStudentBtn').addEventListener('click', () => deleteStudent());

  $('#studentFollowForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedStudentId) return;
    const done = setLoading(event.currentTarget.querySelector('button'), '保存中...');
    try {
      await api(`/api/admin/students/${state.selectedStudentId}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
      });
      event.currentTarget.reset();
      await loadStudentDetail(state.selectedStudentId);
      toast('跟进记录已保存');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#textForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const done = setLoading(event.currentTarget.querySelector('button'), 'AI 分析并生成建议...');
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      await api('/api/materials/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      event.currentTarget.reset();
      await loadAll();
      toast('文字素材已保存，已生成待审核建议');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#fileInput');
    if (!input.files.length) {
      toast('请先选择文件');
      return;
    }
    const done = setLoading(event.currentTarget.querySelector('button'), '上传分析并生成建议...');
    try {
      const formData = new FormData(event.currentTarget);
      await api('/api/materials/upload', { method: 'POST', body: formData });
      event.currentTarget.reset();
      await loadAll();
      toast('文件素材已保存，已生成待审核建议');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#certificateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const done = setLoading(event.currentTarget.querySelector('button'), '保存中...');
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      await api('/api/admin/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      event.currentTarget.reset();
      await loadAll();
      toast('证书已保存');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#certificateImportForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const done = setLoading(event.currentTarget.querySelector('button'), '导入中...');
    try {
      const data = await api('/api/admin/certificates/import', {
        method: 'POST',
        body: new FormData(event.currentTarget)
      });
      event.currentTarget.reset();
      await loadAll();
      toast(`已导入 ${data.imported} 条证书`);
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#generateBtn').addEventListener('click', async (event) => {
    if (!confirm('AI 全量整理会根据所有素材重新生成知识库，可能覆盖你手动维护过的话术、FAQ 和顾虑应对。确定继续吗？')) return;
    const done = setLoading(event.currentTarget, 'AI 正在生成...');
    try {
      const data = await api('/api/knowledge/generate', { method: 'POST' });
      state.knowledge = data.knowledge;
      renderAll();
      toast('知识库已重新生成');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#addPlaybookBtn').addEventListener('click', addPlaybookItem);

  $('#addFaqBtn').addEventListener('click', () => {
    addStructuredItem('faqEditor', {
      firstName: 'question',
      firstLabel: '问题',
      firstPlaceholder: '例如：零基础可以学吗？',
      secondName: 'answer',
      secondLabel: '标准答复',
      secondPlaceholder: '填写销售顾问可直接使用的答复'
    });
  });

  $('#addConcernBtn').addEventListener('click', () => {
    addStructuredItem('concernsEditor', {
      firstName: 'concern',
      firstLabel: '顾虑',
      firstPlaceholder: '例如：担心工作忙没时间上课',
      secondName: 'response',
      secondLabel: '应对话术',
      secondPlaceholder: '填写安抚、解释和引导下一步的话术'
    });
  });

  $('#saveKnowledgeBtn').addEventListener('click', async (event) => {
    const done = setLoading(event.currentTarget, '保存中...');
    try {
      const payload = {
        overview: $('#knowledgeOverview').value,
        salesPlaybook: collectPlaybookItems(),
        faq: collectStructuredItems('faqEditor', 'question', 'answer'),
        concerns: collectStructuredItems('concernsEditor', 'concern', 'response')
      };
      const data = await api('/api/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.knowledge = data.knowledge;
      renderAll();
      toast('知识库已保存');
    } catch (error) {
      toast(`保存失败：${error.message}`);
    } finally {
      done();
    }
  });

  $('#saveSettingsBtn').addEventListener('click', async (event) => {
    const done = setLoading(event.currentTarget, '保存中...');
    try {
      const payload = Object.fromEntries(new FormData($('#settingsForm')).entries());
      const data = await api('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.settings = data.settings;
      await loadAll();
      toast('配置已保存');
    } catch (error) {
      toast(error.message);
    } finally {
      done();
    }
  });

  $('#refreshBtn').addEventListener('click', async () => {
    await loadAll();
    toast('已刷新');
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch {
      // Token may already be invalid; still clear local state.
    }
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    location.href = '/login.html';
  });
}

bindNavigation();
bindForms();
checkHealth();
checkAdmin()
  .then(async () => {
    const studentId = new URLSearchParams(location.hash.replace(/^#/, '')).get('student');
    if (studentId) state.selectedStudentId = studentId;
    const leadId = new URLSearchParams(location.hash.replace(/^#/, '')).get('lead');
    if (leadId) state.selectedLeadId = leadId;
    await loadAll();
  })
  .catch((error) => toast(error.message));
