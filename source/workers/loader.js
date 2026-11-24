// StrokePulse site Worker (loader) — serves the app installed in D1 by strokepulse-updater.
const LOADER = 'l1';
let appCache = null, appChecked = 0;
async function ensure(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS appmeta (k TEXT PRIMARY KEY, v TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS apppart (ver TEXT NOT NULL, i INTEGER NOT NULL, d TEXT NOT NULL, PRIMARY KEY (ver, i))').run();
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
