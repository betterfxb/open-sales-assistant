import crypto from 'node:crypto';

export const currentSchemaVersion = 4;

export const defaultSettings = {
  demoLanguage: 'en',
  siteName: 'Open Sales Assistant',
  welcomeText: 'Hi, I am your sales advisor. You can ask about product fit, schedule, pricing, process, and next steps.',
  serviceName: 'Alex',
  servicePhone: '',
  salesPersona: 'Friendly, professional, specific, and careful with promises. Reply like an experienced team sales advisor.',
  contactHint: 'If you want, I can help you compare the right option, schedule, and next steps.',
  safetyRules: 'Do not guarantee passing, certification, employment, income, or outcomes. Pricing, policy, and schedule must follow the team latest confirmed information.'
};

const adminRoles = ['super_admin', 'manager', 'sales_rep'];

function now() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function userCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function normalizeText(text = '') {
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function normalizePlaybookItem(item, index = 0) {
  if (typeof item === 'string') {
    return {
      id: newId('pb'),
      title: `销售话术 ${index + 1}`,
      scenario: '',
      content: normalizeText(item),
      enabled: true,
      conflicts: []
    };
  }
  return {
    id: item.id || newId('pb'),
    title: normalizeText(item.title || `销售话术 ${index + 1}`),
    scenario: normalizeText(item.scenario || ''),
    content: normalizeText(item.content || item.text || ''),
    enabled: item.enabled !== false,
    sourceMaterialId: item.sourceMaterialId || '',
    sourceMaterialTitle: item.sourceMaterialTitle || '',
    conflicts: Array.isArray(item.conflicts) ? item.conflicts : []
  };
}

function withDefaults(db) {
  return {
    ...db,
    schemaVersion: Number(db.schemaVersion || 0) || currentSchemaVersion,
    materials: Array.isArray(db.materials) ? db.materials : [],
    knowledge: db.knowledge || null,
    chats: Array.isArray(db.chats) ? db.chats : [],
    students: Array.isArray(db.students) ? db.students : [],
    studentSessions: Array.isArray(db.studentSessions) ? db.studentSessions : [],
    leads: Array.isArray(db.leads) ? db.leads : [],
    leadActivities: Array.isArray(db.leadActivities) ? db.leadActivities : [],
    courses: Array.isArray(db.courses) ? db.courses : [],
    courseSchedules: Array.isArray(db.courseSchedules) ? db.courseSchedules : [],
    certificates: Array.isArray(db.certificates) ? db.certificates : [],
    followUps: Array.isArray(db.followUps) ? db.followUps : [],
    aiAnalysis: Array.isArray(db.aiAnalysis) ? db.aiAnalysis : [],
    knowledgeSuggestions: Array.isArray(db.knowledgeSuggestions) ? db.knowledgeSuggestions : [],
    operationLogs: Array.isArray(db.operationLogs) ? db.operationLogs : [],
    adminUsers: Array.isArray(db.adminUsers) ? db.adminUsers : [],
    adminSessions: Array.isArray(db.adminSessions) ? db.adminSessions : [],
    settings: { ...defaultSettings, ...(db.settings || {}) }
  };
}

export function migrateDb(input = {}) {
  const originalVersion = Number(input.schemaVersion || 0) || 1;
  let db = withDefaults({ ...input, schemaVersion: originalVersion });
  let migrated = originalVersion !== currentSchemaVersion || !input.schemaVersion;

  if (Array.isArray(input.students)) {
    migrated = migrated || input.students.some((student) => !student.userCode || !student.intentLevel);
  }

  if (input.knowledge?.salesPlaybook) {
    migrated = migrated || input.knowledge.salesPlaybook.some((item) => typeof item === 'string');
  }

  db.students = db.students.map((student) => ({
    ...student,
    name: student.name || '',
    phone: student.phone || '',
    age: student.age || '',
    gender: student.gender || '',
    idCard: student.idCard || '',
    currentStatus: student.currentStatus || '',
    profileSummary: student.profileSummary || '',
    nextAction: student.nextAction || '',
    avatar: student.avatar || '',
    userCode: student.userCode || userCode(),
    intentLevel: student.intentLevel || 'unknown',
    salesId: student.salesId || '',
    referrerCode: student.referrerCode || ''
  }));

  db.leads = db.leads.map((lead) => ({
    ...lead,
    name: normalizeText(lead.name || ''),
    company: normalizeText(lead.company || ''),
    phone: normalizeText(lead.phone || ''),
    email: normalizeText(lead.email || ''),
    source: normalizeText(lead.source || ''),
    stage: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'].includes(lead.stage) ? lead.stage : 'new',
    owner: normalizeText(lead.owner || ''),
    ownerId: normalizeText(lead.ownerId || ''),
    teamId: normalizeText(lead.teamId || 'team_default'),
    nextFollowUpAt: normalizeText(lead.nextFollowUpAt || ''),
    intentLevel: ['high', 'medium', 'low', 'unknown'].includes(lead.intentLevel) ? lead.intentLevel : 'unknown',
    summary: normalizeText(lead.summary || ''),
    createdAt: lead.createdAt || now(),
    updatedAt: lead.updatedAt || lead.createdAt || now(),
    lastActivityAt: lead.lastActivityAt || ''
  }));

  db.leadActivities = db.leadActivities.map((activity) => ({
    ...activity,
    type: normalizeText(activity.type || 'note'),
    content: normalizeText(activity.content || ''),
    ownerId: normalizeText(activity.ownerId || ''),
    ownerName: normalizeText(activity.ownerName || '')
  }));

  db.adminUsers = db.adminUsers.map((user, index) => ({
    ...user,
    username: normalizeText(user.username || '').toLowerCase(),
    role: adminRoles.includes(user.role) ? user.role : (index === 0 ? 'super_admin' : 'sales_rep'),
    teamId: normalizeText(user.teamId || 'team_default'),
    status: user.status === 'disabled' ? 'disabled' : 'active'
  }));

  if (db.knowledge) {
    db.knowledge = {
      ...db.knowledge,
      overview: db.knowledge.overview || '',
      salesPlaybook: Array.isArray(db.knowledge.salesPlaybook)
        ? db.knowledge.salesPlaybook.map(normalizePlaybookItem).filter((item) => item.content)
        : [],
      faq: Array.isArray(db.knowledge.faq)
        ? db.knowledge.faq.map((item) => ({
          ...item,
          question: normalizeText(item.question || ''),
          answer: normalizeText(item.answer || ''),
          conflicts: Array.isArray(item.conflicts) ? item.conflicts : []
        })).filter((item) => item.question || item.answer)
        : [],
      concerns: Array.isArray(db.knowledge.concerns)
        ? db.knowledge.concerns.map((item) => ({
          ...item,
          concern: normalizeText(item.concern || ''),
          response: normalizeText(item.response || ''),
          conflicts: Array.isArray(item.conflicts) ? item.conflicts : []
        })).filter((item) => item.concern || item.response)
        : [],
      tags: Array.isArray(db.knowledge.tags) ? db.knowledge.tags.filter(Boolean) : [],
      imageCards: Array.isArray(db.knowledge.imageCards) ? db.knowledge.imageCards : []
    };
  }

  db.knowledgeSuggestions = db.knowledgeSuggestions.map((item) => ({
    ...item,
    status: item.status || 'pending',
    conflicts: Array.isArray(item.conflicts) ? item.conflicts : []
  }));

  db.schemaVersion = currentSchemaVersion;
  return { db, migrated };
}
