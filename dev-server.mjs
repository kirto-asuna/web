import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from '../netlify/lib/handler.mjs';
import { memoryStore } from '../netlify/lib/store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = Number(process.env.PORT || 8899);
const store = memoryStore();
const env = {
  ...process.env,
  QA_ADMIN_PASSWORD: process.env.QA_ADMIN_PASSWORD || 'netlify-local-test',
  QA_SESSION_SECRET: process.env.QA_SESSION_SECRET || 'netlify-local-session-secret',
  QA_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
  QA_COOKIE_SECURE: '0',
  URL: `http://127.0.0.1:${port}`,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

const CSP = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) && target !== root) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const content = await fs.readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Security-Policy': CSP,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (!url.pathname.startsWith('/api/')) {
    await serveStatic(url.pathname, res);
    return;
  }
  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers[key] = Array.isArray(value) ? value.join(',') : value;
    }
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const request = new Request(`${env.URL}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      body,
    });
    const response = await handleApi(request, { store, env });
    const responseHeaders = Object.fromEntries(response.headers.entries());
    responseHeaders['content-security-policy'] = CSP;
    res.writeHead(response.status, responseHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Netlify local preview: http://127.0.0.1:${port}`);
  console.log(`admin password: ${env.QA_ADMIN_PASSWORD}`);
});
