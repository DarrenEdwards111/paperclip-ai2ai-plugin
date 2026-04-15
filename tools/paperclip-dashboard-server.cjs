const http = require('http');
const fs = require('fs');
const path = require('path');

const root = '/home/darre/.openclaw/workspace';
const liveDir = path.join(root, 'ai2ai-protocol', 'paperclip-live');
const port = 8765;
const tasks = [
  { id: 'routeb-codex', title: 'Codex, P-side Route B' },
  { id: 'routeb-claude', title: 'Claude, semantic Route B' },
];

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function send(res, code, body, type='text/plain') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readTask(id) {
  const full = path.join(liveDir, `${id}.json`);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function renderDashboard() {
  const now = new Date().toISOString();
  const cards = tasks.map((task) => {
    const data = readTask(task.id);
    if (!data) {
      return `<section class="card"><header>${esc(task.title)}</header><div class="body"><pre>No live data yet.</pre></div></section>`;
    }
    const status = esc(data.status || 'running');
    const cls = ['running','completed','failed'].includes(status) ? status : 'running';
    return `
      <section class="card">
        <header>
          <div><div class="label">Task</div><div class="title">${esc(task.title)}</div></div>
          <span class="status ${cls}">${status}</span>
        </header>
        <div class="body">
          <div class="meta"><span>Task ID</span><span>${esc(data.taskId || task.id)}</span></div>
          <div class="meta"><span>Started</span><span>${esc(data.startedAt || '')}</span></div>
          <div class="meta"><span>Updated</span><span>${esc(data.updatedAt || '')}</span></div>
          <div class="meta"><span>Finished</span><span>${esc(data.finishedAt || '')}</span></div>
          <div class="meta"><span>CWD</span><span>${esc(data.cwd || '')}</span></div>
          <div class="meta"><span>Command</span><span>${esc(data.command || '')}</span></div>
          <div class="label" style="margin-top:12px;">Log tail</div>
          <pre>${esc(data.logTail || '(no log yet)')}</pre>
        </div>
      </section>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="2" />
  <title>Route B Dashboard</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #0b1020; color: #e8ecf3; }
    header.page { padding: 20px 24px; border-bottom: 1px solid #24304a; background: #121a2f; }
    h1 { margin: 0; font-size: 20px; }
    .sub { margin-top: 6px; color: #96a3bd; font-size: 13px; }
    main { padding: 20px 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }
    .card { background: #121a2f; border: 1px solid #24304a; border-radius: 14px; overflow: hidden; }
    .card header { padding: 14px 16px; border-bottom: 1px solid #24304a; display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .label { color: #96a3bd; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .title { font-size: 14px; }
    .body { padding: 16px; }
    .meta { display:grid; grid-template-columns: 110px 1fr; gap:8px 12px; margin-bottom:8px; font-size:13px; }
    .status { display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }
    .running { background:#173a2d; color:#78f0b0; }
    .completed { background:#1b2e52; color:#8cc5ff; }
    .failed { background:#4a1f27; color:#ff9dab; }
    pre { background:#0a0f1f; color:#d9e2f2; padding:14px; border-radius:10px; overflow:auto; white-space:pre-wrap; max-height:420px; }
    a { color:#8cc5ff; }
  </style>
</head>
<body>
  <header class="page">
    <h1>Route B Agent Dashboard</h1>
    <div class="sub">Server-rendered live view. Auto-refresh every 2 seconds. Last render: ${esc(now)}</div>
  </header>
  <main>${cards}</main>
</body>
</html>`;
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === '/' || url.pathname === '/dashboard') {
    return send(res, 200, renderDashboard(), 'text/html; charset=utf-8');
  }
  if (url.pathname === '/ping') {
    return send(res, 200, JSON.stringify({ now: new Date().toISOString() }), 'application/json; charset=utf-8');
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
