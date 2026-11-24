// StrokePulse site Worker (loader) — serves the app installed in D1 by strokepulse-updater,
// plus cloud backup, Cox mode recordings/transcripts, private coach links, and the live coach relay.
const LOADER = 'l3';
let appCache = null, appChecked = 0;
async function ensure(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS appmeta (k TEXT PRIMARY KEY, v TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS apppart (ver TEXT NOT NULL, i INTEGER NOT NULL, d TEXT NOT NULL, PRIMARY KEY (ver, i))').run();
}

/* ---------- shared helpers ---------- */
const KEY_RE = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/;
const TOKEN_RE = /^[a-z0-9]{32}$/;
const MAX_BODY = 1900000, MAX_SESSIONS = 5000, MAX_AUDIO = 1900000;
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function hashKey(key) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('strokepulse:' + key)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
let tablesReady = false;
async function ensureTables(db) {
  if (tablesReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (k TEXT NOT NULL, id INTEGER NOT NULL, summary TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (k, id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS cox_audio (k TEXT NOT NULL, sid INTEGER NOT NULL, idx INTEGER NOT NULL, t0 REAL NOT NULL, dur REAL NOT NULL, mime TEXT NOT NULL, audio BLOB, status TEXT NOT NULL, tx TEXT, updated INTEGER NOT NULL, PRIMARY KEY (k, sid, idx))'),
    db.prepare('CREATE TABLE IF NOT EXISTS cox_share (token TEXT PRIMARY KEY, k TEXT NOT NULL, created INTEGER NOT NULL)'),
  ]);
  tablesReady = true;
}
/* Who is asking: the cox (backup code → full access) or a coach (private link → read-only + live) */
async function who(request, env, url) {
  const key = request.headers.get('X-Sync-Key') || url.searchParams.get('key') || '';
  if (KEY_RE.test(key)) return { k: await hashKey(key), role: 'cox' };
  const ct = request.headers.get('X-Coach-Token') || url.searchParams.get('ct') || '';
  if (TOKEN_RE.test(ct)) {
    await ensureTables(env.DB);
    const r = await env.DB.prepare('SELECT k FROM cox_share WHERE token = ?1').bind(ct).first();
    if (r) return { k: r.k, role: 'coach' };
  }
  return null;
}
/* D1 returns BLOB columns as a plain array of numbers; turn whatever we get back into bytes */
const toBytes = v => v instanceof Uint8Array ? v : (v instanceof ArrayBuffer ? new Uint8Array(v) : Uint8Array.from(v || []));
const b64 = buf => { const u = toBytes(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

/* ---------- cloud backup ---------- */
async function sync(request, env, op, url) {
  const me = await who(request, env, url);
  if (!me) return json({ error: 'bad_key' }, 400);
  const db = env.DB; await ensureTables(db); const k = me.k;
  if (op === 'list' && request.method === 'GET') {
    const rows = (await db.prepare('SELECT id, summary FROM sessions WHERE k = ?1 ORDER BY id DESC').bind(k).all()).results || [];
    return json({ sessions: rows.map(r => ({ id: r.id, summary: JSON.parse(r.summary) })) });
  }
  if (op === 'get' && request.method === 'GET') {
    const id = parseInt(url.searchParams.get('id'), 10);
    const r = await db.prepare('SELECT data FROM sessions WHERE k = ?1 AND id = ?2').bind(k, id).first();
    return r ? json({ data: JSON.parse(r.data) }) : json({ error: 'not_found' }, 404);
  }
  if (me.role !== 'cox') return json({ error: 'read_only' }, 403);
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_big' }, 413);
  let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: 'bad_json' }, 400); }
  const id = Number(b && b.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'bad_id' }, 400);
  if (op === 'del') {
    await db.batch([db.prepare('DELETE FROM sessions WHERE k = ?1 AND id = ?2').bind(k, id), db.prepare('DELETE FROM cox_audio WHERE k = ?1 AND sid = ?2').bind(k, id)]);
    return json({ ok: true });
  }
  if (op === 'put') {
    if (!b.summary || typeof b.summary !== 'object' || !b.data || typeof b.data !== 'object') return json({ error: 'bad_session' }, 400);
    const exists = await db.prepare('SELECT 1 FROM sessions WHERE k = ?1 AND id = ?2').bind(k, id).first();
    if (!exists) { const c = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE k = ?1').bind(k).first(); if (c && c.n >= MAX_SESSIONS) return json({ error: 'full' }, 507); }
    await db.prepare('INSERT OR REPLACE INTO sessions (k, id, summary, data, updated) VALUES (?1, ?2, ?3, ?4, ?5)').bind(k, id, JSON.stringify(b.summary), JSON.stringify(b.data), Date.now()).run();
    return json({ ok: true });
  }
  return json({ error: 'unknown' }, 404);
}

/* ---------- Cox mode: recordings + transcripts ---------- */
const PROMPT = 'Rowing coxswain calls: sit ready, attention, row, power ten, legs, catch, finish, swing, ratio, rate up two, settle, lengthen, weigh enough, hold water, port, starboard, bow pair, stern pair, seat, five hundred to go, sprint.';
async function transcribe(env, k, sid, idx) {
  const db = env.DB;
  const row = await db.prepare('SELECT audio, mime FROM cox_audio WHERE k = ?1 AND sid = ?2 AND idx = ?3').bind(k, sid, idx).first();
  if (!row || !row.audio) return 'missing';
  if (!env.AI) { await db.prepare("UPDATE cox_audio SET status = 'no_ai' WHERE k = ?1 AND sid = ?2 AND idx = ?3").bind(k, sid, idx).run(); return 'no_ai'; }
  try {
    const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64(row.audio), initial_prompt: PROMPT, vad_filter: true, language: 'en' });
    const segs = ((r && r.segments) || []).map(s => ({ s: +(+s.start).toFixed(2), e: +(+s.end).toFixed(2), t: String(s.text || '').trim() })).filter(s => s.t);
    await db.prepare("UPDATE cox_audio SET status = 'done', tx = ?4, updated = ?5 WHERE k = ?1 AND sid = ?2 AND idx = ?3").bind(k, sid, idx, JSON.stringify(segs), Date.now()).run();
    return 'done';
  } catch (e) {
    await db.prepare("UPDATE cox_audio SET status = 'error', tx = ?4 WHERE k = ?1 AND sid = ?2 AND idx = ?3").bind(k, sid, idx, JSON.stringify({ error: String(e && e.message || e).slice(0, 200) })).run();
    return 'error';
  }
}
async function cox(request, env, ctx, op, url) {
  const me = await who(request, env, url);
  if (!me) return json({ error: 'bad_key' }, 400);
  const db = env.DB; await ensureTables(db); const k = me.k;
  const sid = parseInt(url.searchParams.get('sid'), 10), idx = parseInt(url.searchParams.get('idx'), 10);
  if (op === 'chunks' && request.method === 'GET') {
    if (!Number.isSafeInteger(sid)) return json({ error: 'bad_sid' }, 400);
    const rows = (await db.prepare('SELECT idx, t0, dur, mime, status, tx FROM cox_audio WHERE k = ?1 AND sid = ?2 ORDER BY idx').bind(k, sid).all()).results || [];
    return json({ chunks: rows.map(r => ({ idx: r.idx, t0: r.t0, dur: r.dur, mime: r.mime, status: r.status, tx: r.status === 'done' ? JSON.parse(r.tx || '[]') : [] })) });
  }
  if (op === 'audio' && request.method === 'GET') {
    const r = await db.prepare('SELECT audio, mime FROM cox_audio WHERE k = ?1 AND sid = ?2 AND idx = ?3').bind(k, sid, idx).first();
    if (!r || !r.audio) return json({ error: 'not_found' }, 404);
    return new Response(toBytes(r.audio), { headers: { 'Content-Type': r.mime, 'Cache-Control': 'private, max-age=86400' } });
  }
  if (op === 'share') {   // the cox manages the private coach link
    if (me.role !== 'cox') return json({ error: 'read_only' }, 403);
    if (request.method === 'GET') { const r = await db.prepare('SELECT token FROM cox_share WHERE k = ?1').bind(k).first(); return json({ token: r ? r.token : null }); }
    if (request.method === 'POST') {
      const a = new Uint8Array(16); crypto.getRandomValues(a); const token = [...a].map(x => x.toString(36).padStart(2, '0').slice(-2)).join('');
      await db.batch([db.prepare('DELETE FROM cox_share WHERE k = ?1').bind(k), db.prepare('INSERT INTO cox_share (token, k, created) VALUES (?1, ?2, ?3)').bind(token, k, Date.now())]);
      return json({ token });
    }
    if (request.method === 'DELETE') { await db.prepare('DELETE FROM cox_share WHERE k = ?1').bind(k).run(); return json({ ok: true }); }
  }
  if (me.role !== 'cox') return json({ error: 'read_only' }, 403);
  if (op === 'audio' && request.method === 'POST') {
    const t0 = Number(url.searchParams.get('t0')), dur = Number(url.searchParams.get('dur'));
    const mime = (request.headers.get('Content-Type') || 'audio/mp4').split(';')[0].slice(0, 40);
    if (!Number.isSafeInteger(sid) || sid <= 0 || !Number.isSafeInteger(idx) || idx < 0 || idx > 5000 || !isFinite(t0) || !isFinite(dur)) return json({ error: 'bad_params' }, 400);
    if (!/^audio\/[a-z0-9.+-]+$/.test(mime)) return json({ error: 'bad_type' }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_AUDIO) return json({ error: 'too_big' }, 413);
    if (buf.byteLength < 200) return json({ error: 'empty' }, 400);
    await db.prepare("INSERT OR REPLACE INTO cox_audio (k, sid, idx, t0, dur, mime, audio, status, tx, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'new', NULL, ?8)").bind(k, sid, idx, t0, dur, mime, buf, Date.now()).run();
    ctx.waitUntil(transcribe(env, k, sid, idx));
    return json({ ok: true });
  }
  if (op === 'retx' && request.method === 'POST') {   // retry any chunk that failed or never finished
    const rows = (await db.prepare("SELECT idx FROM cox_audio WHERE k = ?1 AND sid = ?2 AND status != 'done' AND updated < ?3").bind(k, sid, Date.now() - 60000).all()).results || [];
    for (const r of rows.slice(0, 20)) ctx.waitUntil(transcribe(env, k, sid, r.idx));
    return json({ retried: rows.length });
  }
  return json({ error: 'unknown' }, 404);
}

/* ---------- live coach relay: one room per cox, cox ↔ coaches over WebSockets ---------- */
async function live(request, env, url) {
  if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket_only' }, 426);
  const me = await who(request, env, url);
  if (!me) return json({ error: 'bad_key' }, 400);
  if (!env.LIVE) return json({ error: 'live_off' }, 503);
  const stub = env.LIVE.get(env.LIVE.idFromName(me.k));
  return stub.fetch(new Request('https://live/connect?role=' + me.role, { headers: request.headers }));
}
export class LiveRoom {
  constructor(state, env) { this.state = state; }
  async fetch(request) {
    const role = new URL(request.url).searchParams.get('role') === 'cox' ? 'cox' : 'coach';
    const pair = new WebSocketPair();
    if (role === 'cox') for (const old of this.state.getWebSockets('cox')) { try { old.close(4000, 'replaced'); } catch (e) {} }
    this.state.acceptWebSocket(pair[1], [role]);
    pair[1].serializeAttachment({ role, listen: false });
    this.presence();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  coaches() { return this.state.getWebSockets('coach'); }
  presence() {
    const coaches = this.coaches(), listening = coaches.filter(w => (w.deserializeAttachment() || {}).listen).length;
    const msg = JSON.stringify({ t: 'presence', cox: this.state.getWebSockets('cox').length > 0, coaches: coaches.length, listening });
    for (const w of this.state.getWebSockets()) { try { w.send(msg); } catch (e) {} }
  }
  async webSocketMessage(ws, msg) {
    const me = ws.deserializeAttachment() || {};
    if (typeof msg !== 'string') {   // binary = audio. cox → listening coaches; coach → cox (talk-back)
      if (msg.byteLength > 16000) return;
      if (me.role === 'cox') { for (const w of this.coaches()) if ((w.deserializeAttachment() || {}).listen) { try { w.send(msg); } catch (e) {} } }
      else for (const w of this.state.getWebSockets('cox')) { try { w.send(msg); } catch (e) {} }
      return;
    }
    if (msg.length > 4000) return;
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    if (me.role === 'coach' && m.t === 'listen') { ws.serializeAttachment({ role: 'coach', listen: !!m.on }); this.presence(); return; }
    if (m.t === 'ping') { try { ws.send('{"t":"pong"}'); } catch (e) {} return; }
    const out = JSON.stringify(m);
    if (me.role === 'cox' && (m.t === 'tel' || m.t === 'talking')) { for (const w of this.coaches()) { try { w.send(out); } catch (e) {} } }
    if (me.role === 'coach' && (m.t === 'msg' || m.t === 'talk')) { for (const w of this.state.getWebSockets('cox')) { try { w.send(out); } catch (e) {} } }
  }
  async webSocketClose(ws) { try { ws.close(1000, 'bye'); } catch (e) {} this.presence(); }
  async webSocketError(ws) { this.presence(); }
}

/* ---------- app files ---------- */
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url), p = url.pathname;
    if (p.startsWith('/api/sync/')) return sync(request, env, p.slice(10), url);
    if (p.startsWith('/api/cox/')) return cox(request, env, ctx, p.slice(9), url);
    if (p === '/api/live') return live(request, env, url);
    if (p === '/admin') return request.method === 'POST' ? adminInstall(request, env) : res(ADMIN_PAGE, 'text/html; charset=utf-8');
    const app = await loadApp(env.DB);
    if (p === '/api/health') {
      const g = await env.DB.prepare("SELECT v FROM appmeta WHERE k = 'ghlast'").first().catch(() => null);
      return res(JSON.stringify({ ok: !!app, app: 'strokepulse', build: app ? app.build : null, label: app ? app.label : null, loader: LOADER, ai: !!env.AI, live: !!env.LIVE, updater: g ? JSON.parse(g.v) : null }, null, 2), 'application/json', { 'Cache-Control': 'no-store' });
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
