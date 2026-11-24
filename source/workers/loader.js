// StrokePulse site Worker (loader) — serves the app installed in D1 by strokepulse-updater.
const LOADER = 'l2';
let appCache = null, appChecked = 0;
async function ensure(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS appmeta (k TEXT PRIMARY KEY, v TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS apppart (ver TEXT NOT NULL, i INTEGER NOT NULL, d TEXT NOT NULL, PRIMARY KEY (ver, i))').run();
}
/* ---------- cloud backup (per backup code; the code itself is never stored, only its SHA-256) ---------- */
const KEY_RE = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/;
const MAX_BODY = 1900000, MAX_SESSIONS = 5000;
let syncReady = false;
async function ensureSync(db) {
  if (syncReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS sessions (k TEXT NOT NULL, id INTEGER NOT NULL, summary TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (k, id))').run();
  syncReady = true;
}
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function hashKey(key) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('strokepulse:' + key)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function sync(request, env, op) {
  const key = request.headers.get('X-Sync-Key') || '';
  if (!KEY_RE.test(key)) return json({ error: 'bad_key' }, 400);
  const db = env.DB; await ensureSync(db); const k = await hashKey(key);
  if (op === 'list' && request.method === 'GET') {
    const rows = (await db.prepare('SELECT id, summary FROM sessions WHERE k = ?1 ORDER BY id DESC').bind(k).all()).results || [];
    return json({ sessions: rows.map(r => ({ id: r.id, summary: JSON.parse(r.summary) })) });
  }
  if (op === 'get' && request.method === 'GET') {
    const id = parseInt(new URL(request.url).searchParams.get('id'), 10);
    const r = await db.prepare('SELECT data FROM sessions WHERE k = ?1 AND id = ?2').bind(k, id).first();
    return r ? json({ data: JSON.parse(r.data) }) : json({ error: 'not_found' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_big' }, 413);
  let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: 'bad_json' }, 400); }
  const id = Number(b && b.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'bad_id' }, 400);
  if (op === 'del') { await db.prepare('DELETE FROM sessions WHERE k = ?1 AND id = ?2').bind(k, id).run(); return json({ ok: true }); }
  if (op === 'put') {
    if (!b.summary || typeof b.summary !== 'object' || !b.data || typeof b.data !== 'object') return json({ error: 'bad_session' }, 400);
    const exists = await db.prepare('SELECT 1 FROM sessions WHERE k = ?1 AND id = ?2').bind(k, id).first();
    if (!exists) { const c = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE k = ?1').bind(k).first(); if (c && c.n >= MAX_SESSIONS) return json({ error: 'full' }, 507); }
    await db.prepare('INSERT OR REPLACE INTO sessions (k, id, summary, data, updated) VALUES (?1, ?2, ?3, ?4, ?5)').bind(k, id, JSON.stringify(b.summary), JSON.stringify(b.data), Date.now()).run();
    return json({ ok: true });
  }
  return json({ error: 'unknown' }, 404);
}
async function loadApp(db) {
  if (appCache && Date.now() - appChecked < 15000) return appCache;
  await ensure(db);
  const m = await db.prepare("SELECT v FROM appmeta WHERE k = 'cur'").first();
  appChecked = Date.now();
  if (!m) return (appCache = null);
  const cur = JSON.parse(m.v);
  if (appCache && appCache.ver === cur.ver) return appCache;
  const rows = (await db.prepare('SELECT d FROM apppart WHERE ver = ?1 ORDER BY i').bind(cur.ver).all()).results || [];
  if (rows.length !== cur.n) return appCache;
  try { const b = JSON.parse(rows.map(r => r.d).join('')); b.ver = cur.ver; appCache = b; } catch (e) {}
  return appCache;
}
const b64bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const res = (body, type, extra) => new Response(body, { headers: Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-cache' }, extra || {}) });
const ADMIN_PAGE = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>StrokePulse admin</title>
<body style="font-family:-apple-system,sans-serif;max-width:480px;margin:30px auto;padding:0 16px">
<h2>StrokePulse — manual install</h2><p>Backup only. Updates normally install by themselves from GitHub.</p>
<form method=post enctype=multipart/form-data><p>Password<br><input name=pw type=password style="width:100%;padding:10px"></p>
<p>app.json file<br><input name=f type=file accept=".json,application/json"></p><p><button style="padding:12px 20px">Install</button></p></form>`;
async function adminInstall(request, env) {
  const fd = await request.formData();
  if (!env.ADMIN_PASSWORD || fd.get('pw') !== env.ADMIN_PASSWORD) return res('Wrong password', 'text/plain');
  const f = fd.get('f'); if (!f || typeof f === 'string') return res('No file', 'text/plain');
  const text = await f.text(); let b;
  try { b = JSON.parse(text); } catch (e) { return res('Not a valid app file', 'text/plain'); }
  if (b.app !== 'strokepulse' || typeof b.html !== 'string' || !b.build) return res('That is not a StrokePulse app file', 'text/plain');
  const db = env.DB; await ensure(db);
  const PART = 50000, ver = String(b.build).replace(/[^A-Za-z0-9]/g, '').slice(0, 14) + Date.now().toString(36), n = Math.ceil(text.length / PART);
  for (let i = 0; i < n; i += 8) { const st = []; for (let j = i; j < Math.min(n, i + 8); j++) st.push(db.prepare('INSERT OR REPLACE INTO apppart (ver, i, d) VALUES (?1, ?2, ?3)').bind(ver, j, text.slice(j * PART, (j + 1) * PART))); await db.batch(st); }
  await db.prepare("INSERT OR REPLACE INTO appmeta (k, v) VALUES ('cur', ?1)").bind(JSON.stringify({ ver, n })).run();
  await db.prepare('DELETE FROM apppart WHERE ver != ?1').bind(ver).run();
  appCache = null;
  return res('Installed ' + b.build + ' (note: GitHub updates continue to install newer builds)', 'text/plain');
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), p = url.pathname;
    if (p.startsWith('/api/sync/')) return sync(request, env, p.slice(10));
    if (p === '/admin') return request.method === 'POST' ? adminInstall(request, env) : res(ADMIN_PAGE, 'text/html; charset=utf-8');
    const app = await loadApp(env.DB);
    if (p === '/api/health') {
      const g = await env.DB.prepare("SELECT v FROM appmeta WHERE k = 'ghlast'").first().catch(() => null);
      return res(JSON.stringify({ ok: !!app, app: 'strokepulse', build: app ? app.build : null, label: app ? app.label : null, loader: LOADER, updater: g ? JSON.parse(g.v) : null }, null, 2), 'application/json', { 'Cache-Control': 'no-store' });
    }
    if (!app) return res('<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;background:#05070a;color:#fff"><h2>StrokePulse</h2><p>Almost ready — the first version is being installed. Try again in a minute.</p>', 'text/html; charset=utf-8');
    if (p === '/' || p === '/index.html') return res(app.html, 'text/html; charset=utf-8');
    if (p === '/sw.js') return res(app.sw, 'application/javascript; charset=utf-8');
    if (p === '/manifest.webmanifest') return res(app.manifest, 'application/manifest+json');
    if (p === '/icon.svg') return res(app.icon_svg, 'image/svg+xml');
    if (p === '/icon-192.png') return res(b64bytes(app.i192), 'image/png');
    if (p === '/icon-512.png') return res(b64bytes(app.i512), 'image/png');
    if (p === '/apple-touch-icon.png' || p === '/apple-touch-icon-precomposed.png') return res(b64bytes(app.apple), 'image/png');
    const f = app.files && app.files[p];
    if (f) return res(b64bytes(f.b64), f.type);
    return new Response('Not found', { status: 404 });
  }
};
