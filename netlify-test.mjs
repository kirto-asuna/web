import assert from 'node:assert/strict';
import { handleApi } from '../netlify/lib/handler.mjs';
import { memoryStore } from '../netlify/lib/store.mjs';

const BASE = 'https://qa.example.com';
const ENV = {
  QA_ADMIN_PASSWORD: 'test-password-123',
  QA_SESSION_SECRET: 'test-session-secret-123',
  QA_PUBLIC_ORIGIN: BASE,
  URL: BASE,
};

let passed = 0;
let failed = 0;
let cookie = '';

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(path, { method = 'GET', body, headers = {}, admin = false, origin } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';
  if (admin && cookie) requestHeaders.cookie = cookie;
  if (origin) requestHeaders.origin = origin;
  return handleApi(
    new Request(`${BASE}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { store, env: ENV }
  );
}

async function json(path, options) {
  const response = await request(path, options);
  const payload = await response.json();
  return { response, payload };
}

const store = memoryStore();

console.log('[1] 基础读接口');
{
  const response = await request('/api/health');
  check('健康检查 200', response.status === 200);
  const { payload } = await json('/api/meta');
  check('meta 为 10 个问题', payload.data.stats.totalQuestions === 10, JSON.stringify(payload.data.stats));
  check('meta 为 9 条回答', payload.data.stats.totalAnswers === 9);
  check('8 个分类', payload.data.categories.length === 8);
  const list = await json('/api/questions?pageSize=5');
  check('列表分页 total=10', list.payload.data.total === 10);
  check('列表每页 5 条', list.payload.data.items.length === 5);
  const search = await json('/api/questions?q=高温');
  check('中文搜索命中', search.payload.data.total === 1, JSON.stringify(search.payload.data));
  const detail = await json('/api/questions/1');
  check('详情 Q-001 可读', detail.response.status === 200 && detail.payload.data.number === 1);
  const functionPath = await json('/.netlify/functions/api/health');
  check('函数路径也可用', functionPath.payload.data.status === 'ok');
}

console.log('[2] 公开提交先审核');
const asked = await json('/api/questions', {
  method: 'POST',
  body: {
    title: 'Netlify 审核测试问题',
    body: '这是一条用于验证 Netlify Functions 审核流程的测试问题。',
    category: 'it',
    tags: '测试,审核',
    author: '访客',
    department: '信息部',
  },
});
const number = asked.payload.data.number;
check('公开提问 201', asked.response.status === 201);
check('公开提问返回 pending=true', asked.payload.data.pending === true);
{
  const list = await json('/api/questions?q=Netlify');
  check('待审核问题不在公开列表', list.payload.data.total === 0);
  const detail = await json(`/api/questions/${number}`);
  check('待审核问题公开详情 404', detail.response.status === 404);
  const pending = await json('/api/admin/pending');
  check('未登录读待审核队列 401', pending.response.status === 401);
}

console.log('[3] 管理员登录与审核问题');
{
  const bad = await json('/api/admin/login', { method: 'POST', body: { password: 'wrong' } });
  check('错误密码 401', bad.response.status === 401);
  const login = await request('/api/admin/login', {
    method: 'POST',
    body: { password: ENV.QA_ADMIN_PASSWORD },
    origin: BASE,
  });
  check('同源登录 200', login.status === 200);
  const setCookie = login.headers.get('set-cookie') || '';
  check('Cookie 含 Secure', /Secure/i.test(setCookie), setCookie);
  check('Cookie 含 HttpOnly', /HttpOnly/i.test(setCookie));
  cookie = setCookie.split(';')[0];
  const session = await json('/api/admin/session', { admin: true });
  check('管理员 session=true', session.payload.data.authenticated === true);
  const adminQuestions = await json('/api/admin/questions', { admin: true });
  check('后台可见待审核问题', adminQuestions.payload.data.pending.questions >= 1);
  const pending = await json('/api/admin/pending', { admin: true });
  const item = pending.payload.data.questions.find((question) => question.number === number);
  check('待审核队列含问题正文', Boolean(item) && item.body.includes('Netlify'));
  const detail = await json(`/api/questions/${number}`, { admin: true });
  check('管理员可读待审核详情', detail.response.status === 200);
  const approved = await json(`/api/admin/questions/${number}/review`, {
    method: 'POST',
    body: { action: 'approve' },
    admin: true,
  });
  check('审核通过问题', approved.response.status === 200);
  const publicDetail = await json(`/api/questions/${number}`);
  check('通过后公开详情 200', publicDetail.response.status === 200);
  const search = await json('/api/questions?q=Netlify');
  check('通过后公开可搜', search.payload.data.total === 1);
}

console.log('[4] 回答审核与采纳');
const answer = await json(`/api/questions/${number}/answers`, {
  method: 'POST',
  body: { body: '这是一条待审核的测试回答。', author: '访客', department: '信息部' },
});
const answerId = answer.payload.data.id;
check('公开回答 pending=true', answer.payload.data.pending === true);
{
  const detail = await json(`/api/questions/${number}`);
  check('待审核回答不出现在公开详情', detail.payload.data.answers.length === 0);
  const accept = await json(`/api/admin/questions/${number}/answers/${answerId}/accept`, {
    method: 'POST',
    admin: true,
  });
  check('待审核回答不能采纳', accept.response.status === 400);
  const pending = await json('/api/admin/pending', { admin: true });
  check('待审核队列含回答', pending.payload.data.answers.some((item) => item.id === answerId));
  const approved = await json(`/api/admin/questions/${number}/answers/${answerId}/review`, {
    method: 'POST',
    body: { action: 'approve' },
    admin: true,
  });
  check('审核通过回答', approved.response.status === 200);
  const publicDetail = await json(`/api/questions/${number}`);
  check('通过后回答公开', publicDetail.payload.data.answers.length === 1);
  const accepted = await json(`/api/admin/questions/${number}/answers/${answerId}/accept`, {
    method: 'POST',
    admin: true,
  });
  check('通过后可采纳', accepted.response.status === 200);
  const resolved = await json(`/api/questions/${number}`);
  check('采纳后已解决', resolved.payload.data.status === 'resolved');
}

console.log('[5] 拒绝与管理员直发');
{
  const rejectedQuestion = await json('/api/questions', {
    method: 'POST',
    body: { title: '待拒绝的问题', body: '这个问题应该被管理员拒绝并删除。', category: 'it' },
  });
  const rejectedNumber = rejectedQuestion.payload.data.number;
  const reject = await json(`/api/admin/questions/${rejectedNumber}/review`, {
    method: 'POST',
    body: { action: 'reject' },
    admin: true,
  });
  check('拒绝问题 200', reject.response.status === 200);
  const gone = await json(`/api/questions/${rejectedNumber}`, { admin: true });
  check('拒绝后问题 404', gone.response.status === 404);

  const rejectedAnswer = await json(`/api/questions/${number}/answers`, {
    method: 'POST',
    body: { body: '这条回答会被拒绝。' },
  });
  const rejectAnswer = await json(`/api/admin/questions/${number}/answers/${rejectedAnswer.payload.data.id}/review`, {
    method: 'POST',
    body: { action: 'reject' },
    admin: true,
  });
  check('拒绝回答 200', rejectAnswer.response.status === 200);

  const adminPost = await json('/api/questions', {
    method: 'POST',
    body: { title: '管理员直接发布', body: '管理员提交的内容应自动通过。', category: 'it' },
    admin: true,
  });
  check('管理员直发 pending=false', adminPost.payload.data.pending === false);
  const publicDetail = await json(`/api/questions/${adminPost.payload.data.number}`);
  check('管理员直发直接公开', publicDetail.response.status === 200);
}

console.log('[6] 编辑、导出与清理');
{
  const edit = await json(`/api/admin/questions/${number}`, {
    method: 'PUT',
    body: { title: 'Netlify 审核测试问题（已编辑）', tags: '测试,Netlify' },
    admin: true,
  });
  check('编辑标题 200', edit.response.status === 200);
  check('编辑生效', edit.payload.data.title.includes('已编辑'));

  const jsonExport = await request('/api/admin/export?format=json', { admin: true });
  const jsonBody = await jsonExport.json();
  check('JSON 导出 200', jsonExport.status === 200);
  check('JSON 导出含全部问题', Array.isArray(jsonBody.questions) && jsonBody.questions.length >= 11);

  const csvExport = await request('/api/admin/export?format=csv', { admin: true });
  const csvBytes = new Uint8Array(await csvExport.arrayBuffer());
  check('CSV 导出 200', csvExport.status === 200);
  check('CSV 带 UTF-8 BOM', csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf);
  check('CSV 含审核状态列', csvExport.headers.get('content-type')?.includes('text/csv'));

  const clear = await json('/api/admin/samples/clear', { method: 'POST', admin: true });
  check('清除示例 removed=10', clear.payload.data.removed === 10);
  check('清除后仍有测试问题', clear.payload.data.remaining >= 2);
}

console.log('[7] 删除、退出与安全');
{
  const deleted = await json(`/api/admin/questions/${number}`, { method: 'DELETE', admin: true });
  check('删除问题 200', deleted.response.status === 200);
  const gone = await json(`/api/questions/${number}`, { admin: true });
  check('删除后详情 404', gone.response.status === 404);
  const logout = await request('/api/admin/logout', { method: 'POST', admin: true });
  check('退出 200', logout.status === 200);
  cookie = '';
  const session = await json('/api/admin/session', { admin: true });
  check('退出后 session=false', session.payload.data.authenticated === false);

  const cors = await request('/api/admin/login', {
    method: 'POST',
    body: { password: ENV.QA_ADMIN_PASSWORD },
    origin: 'https://evil.example',
  });
  check('跨站 Origin 403', cors.status === 403);
  const badContentType = await request('/api/questions', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: undefined,
  });
  check('非 JSON 请求 415', badContentType.status === 415);
  const missing = await json('/api/not-found');
  check('未知接口 404', missing.response.status === 404);
}

console.log('');
console.log(`结果：${passed} 项通过，${failed} 项失败。`);
if (failed > 0) process.exitCode = 1;
