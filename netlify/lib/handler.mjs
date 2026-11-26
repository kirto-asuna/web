import crypto from 'node:crypto';
import {
  CATEGORIES,
  approvedAnswers,
  buildMeta,
  categoryExists,
  cleanText,
  countPendingAnswers,
  detailOf,
  findQuestion,
  isApproved,
  isPending,
  normalizeStore,
  optionalProfile,
  parseTags,
  pendingSummary,
  reviewStatusOf,
  summarize,
  textField,
  toNumber,
} from './core.mjs';
import { loadStore, saveStore } from './store.mjs';

const HOUR = 60 * 60 * 1000;
const SESSION_TTL = 8 * HOUR;
const BODY_LIMIT = 128 * 1024;
const COOKIE_NAME = 'qa_admin';

const rateBuckets = new Map();
const loginBuckets = new Map();
let warnedConfig = false;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

function ok(data, status = 200, extraHeaders = {}) {
  return json({ ok: true, data }, status, extraHeaders);
}

function fail(status, code, message) {
  return json({ ok: false, error: { code, message } }, status);
}

function header(req, name) {
  return req.headers.get(name) || '';
}

function parseCookies(value) {
  const result = {};
  for (const part of String(value || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      result[key] = part.slice(index + 1).trim();
    }
  }
  return result;
}

function sessionSecret(env) {
  const secret = env.QA_SESSION_SECRET || '';
  if (!secret && !warnedConfig) {
    warnedConfig = true;
    console.warn('QA_SESSION_SECRET 未配置，使用开发默认值；公网部署请务必设置。');
  }
  return secret || 'netlify-dev-session-secret-change-me';
}

function adminPassword(env) {
  const password = env.QA_ADMIN_PASSWORD || 'admin123';
  if (!env.QA_ADMIN_PASSWORD && !warnedConfig) {
    warnedConfig = true;
    console.warn('QA_ADMIN_PASSWORD 未配置，使用默认密码 admin123；公网部署请务必设置。');
  }
  return password;
}

function signSession(expiresAt, env) {
  const signature = crypto.createHmac('sha256', sessionSecret(env)).update(String(expiresAt)).digest('base64url');
  return `${expiresAt}.${signature}`;
}

function verifySession(token, env) {
  if (!token) return false;
  const [expiresRaw, signature] = String(token).split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + SESSION_TTL + 60_000) {
    return false;
  }
  const expected = crypto.createHmac('sha256', sessionSecret(env)).update(String(expiresAt)).digest('base64url');
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isAdmin(req, env) {
  return verifySession(parseCookies(header(req, 'cookie'))[COOKIE_NAME], env);
}

function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) {
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function rateLimited(bucket, key, limit, windowMs) {
  const now = Date.now();
  const current = bucket.get(key);
  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 60000)) };
  }
  return { limited: false, retryAfter: 0 };
}

function clientIp(req) {
  const direct = header(req, 'x-nf-client-connection-ip');
  if (direct) return direct.slice(0, 64);
  const forwarded = header(req, 'x-forwarded-for').split(',')[0].trim();
  return (forwarded || 'unknown').slice(0, 64);
}

function allowedHosts(req, env) {
  const hosts = new Set();
  for (const name of ['host', 'x-forwarded-host']) {
    for (const item of header(req, name).split(',')) {
      const host = item.trim();
      if (host) hosts.add(host);
    }
  }
  try {
    const requestUrl = new URL(req.url);
    if (requestUrl.host) hosts.add(requestUrl.host);
  } catch {
    /* ignore */
  }
  for (const value of [env.URL, env.DEPLOY_PRIME_URL, env.QA_PUBLIC_ORIGIN]) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.host) hosts.add(parsed.host);
    } catch {
      /* ignore malformed env */
    }
  }
  return hosts;
}

function isSameOrigin(req, env) {
  const origin = header(req, 'origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    return allowedHosts(req, env).has(originUrl.host);
  } catch {
    return false;
  }
}

async function readJson(req) {
  if (!/^application\/json\b/i.test(header(req, 'content-type'))) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', '请求格式不正确');
  }
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > BODY_LIMIT) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '提交内容过长，请精简后再试');
  try {
    const parsed = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed;
  } catch {
    throw new HttpError(400, 'BAD_JSON', '提交内容无法解析');
  }
}

function pathnameOf(req) {
  const url = new URL(req.url);
  let pathname = url.pathname;
  const apiIndex = pathname.indexOf('/api/');
  if (apiIndex >= 0) pathname = pathname.slice(apiIndex + 4);
  else if (pathname === '/api') pathname = '/';
  pathname = pathname.replace(/\/+$/, '') || '/';
  return { url, pathname };
}

function cookie(value, maxAge, env) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (env.QA_COOKIE_SECURE !== '0') parts.push('Secure');
  return parts.join('; ');
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportResponse(data, format) {
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    const header = ['编号', '标题', '分类', '状态', '提问人', '部门', '提问时间', '浏览', '标签', '问题描述', '回答数', '回答内容', '审核状态'];
    const rows = [header];
    for (const question of [...data.questions].sort((a, b) => a.number - b.number)) {
      rows.push([
        `Q-${String(question.number).padStart(3, '0')}`,
        question.title,
        (CATEGORIES.find((item) => item.id === question.category) || CATEGORIES[0]).name,
        question.status === 'resolved' ? '已解决' : '待解决',
        question.author,
        question.department,
        question.createdAt,
        question.views || 0,
        question.tags.join('、'),
        question.body,
        question.answers.length,
        question.answers
          .map(
            (answer, index) =>
              `回答${index + 1}${isPending(answer) ? '（待审核）' : ''}（${answer.author}${answer.department ? ' / ' + answer.department : ''}，${answer.createdAt}）\n${answer.body}`
          )
          .join('\n\n'),
        isPending(question) ? '待审核' : '已通过',
      ]);
    }
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qa-export-${date}.csv"; filename*=UTF-8''${encodeURIComponent(`优耐特施问答库-${date}.csv`)}`,
        'Cache-Control': 'no-store',
      },
    });
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    application: '优耐特施部门知识问答',
    categories: CATEGORIES,
    questions: [...data.questions].sort((a, b) => a.number - b.number),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="qa-export-${date}.json"; filename*=UTF-8''${encodeURIComponent(`优耐特施问答库-${date}.json`)}`,
      'Cache-Control': 'no-store',
    },
  });
}

function persist(store, data) {
  return saveStore(store, data);
}

export async function handleApi(req, { store, env = process.env } = {}) {
  if (!store) return fail(500, 'STORE_MISSING', '服务存储未初始化');
  const { url, pathname } = pathnameOf(req);
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (pathname === '/health' && method === 'GET') {
      return ok({ status: 'ok', uptime: 0, time: new Date().toISOString(), platform: 'netlify' });
    }

    const data = await loadStore(store);

    if (pathname === '/meta' && method === 'GET') {
      return ok(buildMeta(data));
    }

    if (pathname === '/questions' && method === 'GET') {
      const query = cleanText(url.searchParams.get('q') || '', 80).trim();
      const category = cleanText(url.searchParams.get('category') || '', 30);
      const status = cleanText(url.searchParams.get('status') || 'all', 20);
      const sort = cleanText(url.searchParams.get('sort') || 'active', 20);
      const page = toNumber(url.searchParams.get('page'), 1, 1, 100000);
      const pageSize = toNumber(url.searchParams.get('pageSize'), 8, 1, 24);
      if (category && !categoryExists(category)) return fail(400, 'INVALID_CATEGORY', '分类不存在');
      if (!['all', 'open', 'resolved'].includes(status)) return fail(400, 'INVALID_STATUS', '状态筛选无效');
      if (!['active', 'newest', 'popular'].includes(sort)) return fail(400, 'INVALID_SORT', '排序方式无效');

      let items = data.questions.filter(isApproved);
      if (category) items = items.filter((question) => question.category === category);
      if (status !== 'all') items = items.filter((question) => question.status === status);
      if (query) {
        const needle = query.toLowerCase();
        items = items.filter((question) => {
          const haystack = [
            question.title,
            question.body,
            question.tags.join(' '),
            question.author,
            question.department,
            ...approvedAnswers(question).flatMap((answer) => [answer.body, answer.author, answer.department]),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(needle);
        });
      }
      if (sort === 'newest') {
        items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      } else if (sort === 'popular') {
        items.sort(
          (a, b) =>
            (b.views || 0) - (a.views || 0) ||
            approvedAnswers(b).length - approvedAnswers(a).length ||
            String(b.createdAt).localeCompare(String(a.createdAt))
        );
      } else {
        items.sort((a, b) =>
          String(b.lastActivityAt || b.updatedAt).localeCompare(String(a.lastActivityAt || a.updatedAt))
        );
      }
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, pages);
      const start = (safePage - 1) * pageSize;
      return ok({
        items: items.slice(start, start + pageSize).map((question) => summarize(question, query)),
        total,
        page: safePage,
        pageSize,
        pages,
        query,
        category,
        status,
        sort,
      });
    }

    let match = pathname.match(/^\/questions\/(\d+)$/);
    if (match && method === 'GET') {
      const question = findQuestion(data, match[1]);
      const admin = isAdmin(req, env);
      if (!question || (!admin && isPending(question))) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      return ok(detailOf(question, { admin }));
    }

    match = pathname.match(/^\/questions\/(\d+)\/views$/);
    if (match && method === 'POST') {
      const question = findQuestion(data, match[1]);
      if (!question || isPending(question)) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      question.views = (question.views || 0) + 1;
      await persist(store, data);
      return ok({ views: question.views });
    }

    if (method !== 'GET' && method !== 'HEAD' && !isSameOrigin(req, env)) {
      return fail(403, 'BAD_ORIGIN', '请求来源不合法');
    }

    if (pathname === '/questions' && method === 'POST') {
      const admin = isAdmin(req, env);
      const limit = rateLimited(rateBuckets, `question:${clientIp(req)}`, 20, HOUR);
      if (limit.limited) return fail(429, 'RATE_LIMITED', `提问太频繁，请 ${limit.retryAfter} 分钟后再试`);
      const body = await readJson(req);
      const title = textField(body.title, { label: '标题', min: 4, max: 120 });
      if (title.error) return fail(400, 'VALIDATION_ERROR', title.error);
      const bodyField = textField(body.body, { label: '问题描述', min: 8, max: 5000 });
      if (bodyField.error) return fail(400, 'VALIDATION_ERROR', bodyField.error);
      if (!categoryExists(body.category)) return fail(400, 'VALIDATION_ERROR', '请选择有效的问题分类');
      const tags = parseTags(body.tags);
      if (tags.error) return fail(400, 'VALIDATION_ERROR', tags.error);
      const profile = optionalProfile(body);
      if (profile.error) return fail(400, 'VALIDATION_ERROR', profile.error);
      const now = new Date().toISOString();
      const question = {
        id: `q_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        number: data.nextNumber,
        title: title.value,
        body: bodyField.value,
        category: body.category,
        tags: tags.value,
        author: profile.author,
        department: profile.department,
        status: 'open',
        views: 0,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        isSample: false,
        reviewStatus: admin ? 'approved' : 'pending',
        answers: [],
      };
      data.nextNumber += 1;
      data.questions.push(question);
      await persist(store, data);
      return ok({ id: question.id, number: question.number, pending: !admin, reviewStatus: question.reviewStatus }, 201);
    }

    match = pathname.match(/^\/questions\/(\d+)\/answers$/);
    if (match && method === 'POST') {
      const admin = isAdmin(req, env);
      const limit = rateLimited(rateBuckets, `answer:${clientIp(req)}`, 60, HOUR);
      if (limit.limited) return fail(429, 'RATE_LIMITED', `回答太频繁，请 ${limit.retryAfter} 分钟后再试`);
      const question = findQuestion(data, match[1]);
      if (!question || (!admin && isPending(question))) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const body = await readJson(req);
      const bodyField = textField(body.body, { label: '回答内容', min: 2, max: 3000 });
      if (bodyField.error) return fail(400, 'VALIDATION_ERROR', bodyField.error);
      const profile = optionalProfile(body);
      if (profile.error) return fail(400, 'VALIDATION_ERROR', profile.error);
      const now = new Date().toISOString();
      const answer = {
        id: `a_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        body: bodyField.value,
        author: profile.author,
        department: profile.department,
        createdAt: now,
        accepted: false,
        reviewStatus: admin ? 'approved' : 'pending',
      };
      question.answers.push(answer);
      if (admin) {
        question.lastActivityAt = now;
        question.updatedAt = now;
      }
      await persist(store, data);
      return ok({ id: answer.id, pending: !admin, reviewStatus: answer.reviewStatus }, 201);
    }

    if (pathname === '/admin/session' && method === 'GET') {
      return ok({ authenticated: isAdmin(req, env) });
    }

    if (pathname === '/admin/login' && method === 'POST') {
      const limit = rateLimited(loginBuckets, `login:${clientIp(req)}`, 8, 10 * 60 * 1000);
      if (limit.limited) return fail(429, 'RATE_LIMITED', `尝试次数过多，请 ${limit.retryAfter} 分钟后再试`);
      const body = await readJson(req);
      const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
      if (!safeEqual(password, adminPassword(env))) {
        return fail(401, 'BAD_PASSWORD', '管理员密码不正确');
      }
      loginBuckets.delete(`login:${clientIp(req)}`);
      const expiresAt = Date.now() + SESSION_TTL;
      return ok(
        { authenticated: true },
        200,
        { 'Set-Cookie': cookie(signSession(expiresAt, env), Math.floor(SESSION_TTL / 1000), env) }
      );
    }

    if (pathname === '/admin/logout' && method === 'POST') {
      return ok({ authenticated: false }, 200, {
        'Set-Cookie': cookie('', 0, env),
      });
    }

    if (pathname === '/admin/questions' && method === 'GET') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const items = [...data.questions]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((question) => summarize(question, '', { admin: true }));
      return ok({
        items,
        total: items.length,
        pending: {
          questions: data.questions.filter(isPending).length,
          answers: countPendingAnswers(data),
        },
      });
    }

    if (pathname === '/admin/pending' && method === 'GET') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      return ok(pendingSummary(data));
    }

    match = pathname.match(/^\/admin\/questions\/(\d+)\/review$/);
    if (match && method === 'POST') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const index = data.questions.findIndex((question) => Number(question.number) === Number(match[1]));
      if (index === -1) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const body = await readJson(req);
      if (!['approve', 'reject'].includes(body.action)) return fail(400, 'VALIDATION_ERROR', '审核操作无效');
      if (body.action === 'reject') {
        const [removed] = data.questions.splice(index, 1);
        await persist(store, data);
        return ok({ action: 'rejected', deleted: removed.number });
      }
      const question = data.questions[index];
      question.reviewStatus = 'approved';
      const now = new Date().toISOString();
      question.updatedAt = now;
      question.lastActivityAt = now;
      await persist(store, data);
      return ok({ action: 'approved', question: summarize(question, '', { admin: true }) });
    }

    match = pathname.match(/^\/admin\/questions\/(\d+)\/answers\/([a-zA-Z0-9_]+)\/review$/);
    if (match && method === 'POST') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const question = findQuestion(data, match[1]);
      if (!question) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const answerIndex = question.answers.findIndex((answer) => answer.id === match[2]);
      if (answerIndex === -1) return fail(404, 'NOT_FOUND', '回答不存在或已被删除');
      const body = await readJson(req);
      if (!['approve', 'reject'].includes(body.action)) return fail(400, 'VALIDATION_ERROR', '审核操作无效');
      if (body.action === 'reject') {
        const [removed] = question.answers.splice(answerIndex, 1);
        if (question.status === 'resolved' && !question.answers.some((answer) => answer.accepted && isApproved(answer))) {
          question.status = 'open';
        }
        question.updatedAt = new Date().toISOString();
        await persist(store, data);
        return ok({ action: 'rejected', deleted: removed.id });
      }
      const answer = question.answers[answerIndex];
      answer.reviewStatus = 'approved';
      const now = new Date().toISOString();
      question.updatedAt = now;
      question.lastActivityAt = now;
      await persist(store, data);
      return ok({ action: 'approved', answerId: answer.id });
    }

    match = pathname.match(/^\/admin\/questions\/(\d+)$/);
    if (match && method === 'PUT') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const question = findQuestion(data, match[1]);
      if (!question) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const body = await readJson(req);
      if (Object.prototype.hasOwnProperty.call(body, 'title')) {
        const value = textField(body.title, { label: '标题', min: 4, max: 120 });
        if (value.error) return fail(400, 'VALIDATION_ERROR', value.error);
        question.title = value.value;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'body')) {
        const value = textField(body.body, { label: '问题描述', min: 8, max: 5000 });
        if (value.error) return fail(400, 'VALIDATION_ERROR', value.error);
        question.body = value.value;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'category')) {
        if (!categoryExists(body.category)) return fail(400, 'VALIDATION_ERROR', '分类不存在');
        question.category = body.category;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
        const value = parseTags(body.tags);
        if (value.error) return fail(400, 'VALIDATION_ERROR', value.error);
        question.tags = value.value;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'author')) {
        const author = cleanText(body.author, 31);
        if (!author) return fail(400, 'VALIDATION_ERROR', '提问人不能为空');
        if (author.length > 30) return fail(400, 'VALIDATION_ERROR', '提问人不能超过 30 个字符');
        question.author = author;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'department')) {
        const department = cleanText(body.department, 41);
        if (department.length > 40) return fail(400, 'VALIDATION_ERROR', '部门不能超过 40 个字符');
        question.department = department;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'status')) {
        if (!['open', 'resolved'].includes(body.status)) return fail(400, 'VALIDATION_ERROR', '状态无效');
        question.status = body.status;
      }
      question.updatedAt = new Date().toISOString();
      await persist(store, data);
      return ok(detailOf(question, { admin: true }));
    }

    if (match && method === 'DELETE') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const index = data.questions.findIndex((question) => Number(question.number) === Number(match[1]));
      if (index === -1) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const [removed] = data.questions.splice(index, 1);
      await persist(store, data);
      return ok({ deleted: removed.number });
    }

    match = pathname.match(/^\/admin\/questions\/(\d+)\/status$/);
    if (match && method === 'POST') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const question = findQuestion(data, match[1]);
      if (!question) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const body = await readJson(req);
      if (!['open', 'resolved'].includes(body.status)) return fail(400, 'VALIDATION_ERROR', '状态无效');
      question.status = body.status;
      if (body.status === 'open') for (const answer of question.answers) answer.accepted = false;
      question.updatedAt = new Date().toISOString();
      await persist(store, data);
      return ok({ status: question.status });
    }

    match = pathname.match(/^\/admin\/questions\/(\d+)\/answers\/([a-zA-Z0-9_]+)\/accept$/);
    if (match && method === 'POST') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const question = findQuestion(data, match[1]);
      if (!question) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const answer = question.answers.find((item) => item.id === match[2]);
      if (!answer) return fail(404, 'NOT_FOUND', '回答不存在或已被删除');
      if (isPending(answer)) return fail(400, 'NOT_APPROVED', '请先审核通过这条回答');
      for (const item of question.answers) item.accepted = item.id === answer.id;
      question.status = 'resolved';
      question.updatedAt = new Date().toISOString();
      question.lastActivityAt = question.updatedAt;
      await persist(store, data);
      return ok({ accepted: answer.id });
    }

    match = pathname.match(/^\/admin\/questions\/(\d+)\/answers\/([a-zA-Z0-9_]+)$/);
    if (match && method === 'DELETE') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const question = findQuestion(data, match[1]);
      if (!question) return fail(404, 'NOT_FOUND', '问题不存在或已被删除');
      const index = question.answers.findIndex((answer) => answer.id === match[2]);
      if (index === -1) return fail(404, 'NOT_FOUND', '回答不存在或已被删除');
      question.answers.splice(index, 1);
      if (!question.answers.some((answer) => answer.accepted) && question.status === 'resolved') question.status = 'open';
      question.updatedAt = new Date().toISOString();
      await persist(store, data);
      return ok({ deleted: match[2] });
    }

    if (pathname === '/admin/samples/clear' && method === 'POST') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      const before = data.questions.length;
      data.questions = data.questions.filter((question) => !question.isSample);
      const removed = before - data.questions.length;
      await persist(store, data);
      return ok({ removed, remaining: data.questions.length });
    }

    if (pathname === '/admin/export' && method === 'GET') {
      if (!isAdmin(req, env)) return fail(401, 'UNAUTHORIZED', '请先登录管理后台');
      return exportResponse(data, (url.searchParams.get('format') || 'json').toLowerCase());
    }

    return fail(404, 'NOT_FOUND', '接口不存在');
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.code, error.message);
    console.error('Netlify API error:', error);
    return fail(500, 'INTERNAL_ERROR', '服务器内部错误，请稍后重试');
  }
}

export { isAdmin, isApproved, isPending, reviewStatusOf, normalizeStore };
