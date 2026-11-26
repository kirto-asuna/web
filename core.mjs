import { seedData } from './seed.mjs';

export const CATEGORIES = [
  { id: 'product', name: '产品技术', icon: 'cube', description: '选型、方案、参数解释、技术资料' },
  { id: 'service', name: '售后服务', icon: 'wrench', description: '安装、调试、故障处理、备件与维保' },
  { id: 'production', name: '生产制造', icon: 'factory', description: '工艺、设备、图纸、现场管理' },
  { id: 'quality', name: '质量管理', icon: 'shield', description: '来料、过程、体系与改进' },
  { id: 'sales', name: '销售支持', icon: 'chart', description: '报价、投标、客户沟通、合同' },
  { id: 'supply', name: '采购物流', icon: 'truck', description: '采购流程、交期、仓储、物流' },
  { id: 'hr', name: '人事行政', icon: 'users', description: '入职离职、报销、日常行政' },
  { id: 'it', name: 'IT 办公', icon: 'monitor', description: '账号、软件、网络、办公设备' },
];

const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]));
const HOUR = 60 * 60 * 1000;

export function categoryOf(id) {
  return CATEGORY_MAP.get(id) || CATEGORIES[0];
}

export function categoryExists(id) {
  return CATEGORY_MAP.has(id);
}

export function cleanText(value, maxLength = 5000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function textField(value, { label, min, max }) {
  const text = cleanText(value, max + 1);
  if (text.length < min) return { error: `${label}至少需要 ${min} 个字符` };
  if (text.length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

export function parseTags(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[,，、;；\s]+/);
  const tags = [];
  const seen = new Set();
  for (const item of raw) {
    const tag = cleanText(String(item), 40).replace(/^#+/, '').trim();
    if (!tag) continue;
    if (tag.length > 16) return { error: `标签“${tag.slice(0, 10)}…”不能超过 16 个字符` };
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length > 5) return { error: '最多填写 5 个标签' };
  }
  return { value: tags };
}

export function optionalProfile(body) {
  const author = cleanText(body.author, 31) || '匿名同事';
  if (author.length > 30) return { error: '姓名或昵称不能超过 30 个字符' };
  const department = cleanText(body.department, 41);
  if (department.length > 40) return { error: '部门不能超过 40 个字符' };
  return { author, department };
}

export function toNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function isPending(item) {
  return Boolean(item && item.reviewStatus === 'pending');
}

export function isApproved(item) {
  return !isPending(item);
}

export function approvedAnswers(question) {
  return (question.answers || []).filter(isApproved);
}

export function reviewStatusOf(item) {
  return isPending(item) ? 'pending' : 'approved';
}

export function findQuestion(data, number) {
  return (data.questions || []).find((question) => Number(question.number) === Number(number));
}

export function normalizeStore(input) {
  const source = input && typeof input === 'object' ? input : JSON.parse(JSON.stringify(seedData));
  const data = {
    version: 1,
    nextNumber: Number(source.nextNumber) || 1,
    questions: Array.isArray(source.questions) ? source.questions : [],
  };
  for (const question of data.questions) {
    question.id = String(question.id || `q_${question.number}`);
    question.number = Number(question.number) || 0;
    question.title = cleanText(question.title, 120);
    question.body = cleanText(question.body, 5000);
    question.category = categoryExists(question.category) ? question.category : CATEGORIES[0].id;
    question.tags = Array.isArray(question.tags) ? question.tags.map((tag) => cleanText(String(tag), 16)).filter(Boolean).slice(0, 5) : [];
    question.author = cleanText(question.author, 30) || '匿名同事';
    question.department = cleanText(question.department, 40);
    question.status = question.status === 'resolved' ? 'resolved' : 'open';
    question.views = Number(question.views) || 0;
    const created = question.createdAt || new Date().toISOString();
    question.createdAt = created;
    question.updatedAt = question.updatedAt || created;
    question.lastActivityAt = question.lastActivityAt || question.updatedAt;
    question.isSample = Boolean(question.isSample);
    question.reviewStatus = isPending(question) ? 'pending' : 'approved';
    question.answers = Array.isArray(question.answers) ? question.answers : [];
    for (const answer of question.answers) {
      answer.id = String(answer.id || `a_${Date.now().toString(36)}`);
      answer.body = cleanText(answer.body, 3000);
      answer.author = cleanText(answer.author, 30) || '匿名同事';
      answer.department = cleanText(answer.department, 40);
      answer.createdAt = answer.createdAt || created;
      answer.accepted = Boolean(answer.accepted);
      answer.reviewStatus = isPending(answer) ? 'pending' : 'approved';
    }
  }
  const maxNumber = data.questions.reduce((max, question) => Math.max(max, question.number), 0);
  data.nextNumber = Math.max(Number(source.nextNumber) || 1, maxNumber + 1);
  return data;
}

export function publicQuestions(data) {
  return (data.questions || []).filter(isApproved);
}

export function questionExcerpt(text, query = '') {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (!query) return flat.length > 150 ? `${flat.slice(0, 150)}…` : flat;
  const index = flat.toLowerCase().indexOf(String(query).toLowerCase());
  if (index === -1) return flat.length > 150 ? `${flat.slice(0, 150)}…` : flat;
  const start = Math.max(0, index - 50);
  const end = Math.min(flat.length, index + String(query).length + 100);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

export function summarize(question, query = '', { admin = false } = {}) {
  const visibleAnswers = admin ? question.answers : approvedAnswers(question);
  const summary = {
    id: question.id,
    number: question.number,
    title: question.title,
    excerpt: questionExcerpt(question.body, query),
    category: question.category,
    categoryName: categoryOf(question.category).name,
    tags: question.tags,
    author: question.author,
    department: question.department,
    status: question.status,
    views: question.views || 0,
    answerCount: visibleAnswers.length,
    hasAccepted: visibleAnswers.some((answer) => answer.accepted),
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    lastActivityAt: question.lastActivityAt || question.updatedAt || question.createdAt,
    isSample: Boolean(question.isSample),
  };
  if (admin) {
    summary.reviewStatus = reviewStatusOf(question);
    summary.pendingAnswerCount = (question.answers || []).filter(isPending).length;
  }
  return summary;
}

export function detailOf(question, { admin = false } = {}) {
  const answers = admin ? question.answers : approvedAnswers(question);
  return {
    ...summarize(question, '', { admin }),
    body: question.body,
    answers: [...answers]
      .sort((a, b) => {
        if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;
        return String(a.createdAt).localeCompare(String(b.createdAt));
      })
      .map((answer) => ({
        id: answer.id,
        body: answer.body,
        author: answer.author,
        department: answer.department,
        createdAt: answer.createdAt,
        accepted: Boolean(answer.accepted),
        ...(admin ? { reviewStatus: reviewStatusOf(answer) } : {}),
      })),
  };
}

export function buildStats(data) {
  const questions = publicQuestions(data);
  const contributors = new Map();
  const addContributor = (name, department, createdAt) => {
    const key = String(name || '').trim();
    if (!key || key === '匿名同事') return;
    const current = contributors.get(key) || { name: key, department: department || '', count: 0, lastAt: '' };
    current.count += 1;
    if (department) current.department = department;
    if (!current.lastAt || createdAt > current.lastAt) current.lastAt = createdAt;
    contributors.set(key, current);
  };

  let answerTotal = 0;
  for (const question of questions) {
    addContributor(question.author, question.department, question.createdAt);
    for (const answer of approvedAnswers(question)) {
      answerTotal += 1;
      addContributor(answer.author, answer.department, answer.createdAt);
    }
  }

  const tagCounts = new Map();
  for (const question of questions) {
    for (const tag of question.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  const weekAgo = Date.now() - 7 * 24 * HOUR;
  const weekNew = questions.filter((question) => new Date(question.createdAt).getTime() >= weekAgo).length;
  const resolved = questions.filter((question) => question.status === 'resolved').length;
  const totalViews = questions.reduce((sum, question) => sum + (question.views || 0), 0);
  const answered = questions.filter((question) => approvedAnswers(question).length > 0).length;

  const stats = {
    totalQuestions: questions.length,
    open: questions.length - resolved,
    resolved,
    resolvedRate: questions.length ? Math.round((resolved / questions.length) * 100) : 0,
    answered,
    totalAnswers: answerTotal,
    contributors: contributors.size,
    totalViews,
    weekNew,
    sampleCount: questions.filter((question) => question.isSample).length,
    hotTags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
    topContributors: [...contributors.values()]
      .sort((a, b) => b.count - a.count || String(b.lastAt).localeCompare(String(a.lastAt)))
      .slice(0, 4),
  };
  return {
    ...stats,
    total: stats.totalQuestions,
    answers: stats.totalAnswers,
    sample: stats.sampleCount,
  };
}

export function buildMeta(data) {
  return {
    categories: CATEGORIES.map((category) => ({
      ...category,
      count: (data.questions || []).filter((question) => question.category === category.id && isApproved(question)).length,
    })),
    stats: buildStats(data),
    serverTime: new Date().toISOString(),
  };
}

export function pendingSummary(data) {
  const questions = (data.questions || [])
    .filter(isPending)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((question) => ({ ...summarize(question, '', { admin: true }), body: question.body }));
  const answers = [];
  for (const question of data.questions || []) {
    for (const answer of question.answers || []) {
      if (!isPending(answer)) continue;
      answers.push({
        id: answer.id,
        questionNumber: question.number,
        questionTitle: question.title,
        body: answer.body,
        author: answer.author,
        department: answer.department,
        createdAt: answer.createdAt,
      });
    }
  }
  answers.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return {
    questions,
    answers,
    counts: { questions: questions.length, answers: answers.length },
  };
}

export function countPendingAnswers(data) {
  return (data.questions || []).reduce((sum, question) => sum + (question.answers || []).filter(isPending).length, 0);
}
