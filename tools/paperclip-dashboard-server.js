#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = '/home/darre/.openclaw/workspace';
const liveDir = path.join(root, 'ai2ai-protocol', 'paperclip-live');
const dashboardHtml = path.join(root, 'paperclip-ai2ai-plugin', 'public', 'paperclip-dashboard.html');
const port = 8765;

function send(res, code, body, type='text/plain') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === '/' || url.pathname === '/dashboard') {
    return send(res, 200, fs.readFileSync(dashboardHtml), 'text/html; charset=utf-8');
  }
  if (url.pathname.startsWith('/paperclip-live/')) {
    const file = path.basename(url.pathname);
    const full = path.join(liveDir, file);
    if (!fs.existsSync(full)) return send(res, 404, 'not found');
    return send(res, 200, fs.readFileSync(full), 'application/json; charset=utf-8');
  }
  send(res, 404, 'not found');
}).listen(port, '127.0.0.1', () => {
  console.log(`Dashboard running at http://127.0.0.1:${port}/dashboard`);
});
