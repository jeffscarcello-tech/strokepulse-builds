// StrokePulse site Worker (loader) — serves the app installed in D1 by strokepulse-updater,
// plus cloud backup, Cox mode recordings/transcripts, private coach links, and the live coach relay.
const LOADER = 'l8';
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

/* ---------- crews: invite code → shared leaderboards and team goals (session summaries only) ---------- */
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const hex = n => [...rnd(n)].map(b => b.toString(16).padStart(2, '0')).join('');
const code6 = () => [...rnd(6)].map(b => CODE_ABC[b % CODE_ABC.length]).join('');
async function sha(t) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('spcrew:' + t)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
const cleanName = v => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
const cleanColor = v => /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : '#2f9bff';
const num = (v, lo, hi) => { v = +v; return isFinite(v) && v >= lo && v <= hi ? v : null; };
let crewReady = false;
async function crewTables(db) {
  if (crewReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS crews (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, owner TEXT NOT NULL, goal_m INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS crew_members (crew TEXT NOT NULL, mid TEXT NOT NULL, th TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, joined INTEGER NOT NULL, seen INTEGER NOT NULL, PRIMARY KEY (crew, mid))'),
    db.prepare('CREATE TABLE IF NOT EXISTS crew_sessions (crew TEXT NOT NULL, mid TEXT NOT NULL, sid INTEGER NOT NULL, s TEXT NOT NULL, start INTEGER NOT NULL, PRIMARY KEY (crew, mid, sid))'),
  ]);
  try { await db.prepare('ALTER TABLE crews ADD COLUMN lineup TEXT').run(); } catch (e) {}   // shared lineup of the day (added in l8)
  crewReady = true;
}
async function crewAuth(request, env, crewId) {
  const h = request.headers.get('X-Member') || ''; const m = /^([a-f0-9]{16}):([a-f0-9]{48})$/.exec(h); if (!m || !/^[a-f0-9]{16}$/.test(crewId || '')) return null;
  const r = await env.DB.prepare('SELECT mid FROM crew_members WHERE crew = ?1 AND mid = ?2 AND th = ?3').bind(crewId, m[1], await sha(m[2])).first();
  return r ? m[1] : null;
}
/* one session summary as shared with the crew: numbers only, never GPS, audio or notes */
function cleanSession(o) {
  const sid = num(o && o.id, 1, 9e15), start = num(o && o.start, 1e12, 9e15); if (!sid || !start) return null;
  const out = { id: sid, start, dist: num(o.dist, 0, 500000) || 0, time: num(o.time, 0, 86400) || 0, strokes: num(o.strokes, 0, 100000) || 0, kcal: num(o.kcal, 0, 20000) || 0, mode: o.mode === 'intervals' ? 'intervals' : 'justgo', wkDesc: cleanName(o.wkDesc) };
  for (const k of ['b500', 'b1k', 'b2k']) { const v = num(o[k], 30, 3600); if (v) out[k] = +v.toFixed(1); }
  const st = num(o.st, 0, 100); if (st != null) out.st = Math.round(st);
  const kpk = num(o.kpk, 0, 60); if (kpk != null) out.kpk = +kpk.toFixed(2);   // calories per kg, so each rower's own weight can be applied
  const load = num(o.load, 0, 2000); if (load != null) out.load = Math.round(load);
  if (o.lu) out.lu = cleanName(o.lu);
  return out;
}
async function crew(request, env, op, url) {
  const db = env.DB; await crewTables(db);
  if (request.method !== 'POST' && op !== 'board') return json({ error: 'method' }, 405);
  let body = {}; if (request.method === 'POST') { const t = await request.text(); if (t.length > 400000) return json({ error: 'too_big' }, 413); try { body = JSON.parse(t || '{}'); } catch (e) { return json({ error: 'bad_json' }, 400); } }
  const now = Date.now();
  const join = async (crewRow) => {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM crew_members WHERE crew = ?1').bind(crewRow.id).first();
    if (n && n.n >= 40) return json({ error: 'crew_full' }, 409);
    const mid = hex(8), token = hex(24), name = cleanName(body.name) || 'Rower';
    await db.prepare('INSERT INTO crew_members (crew, mid, th, name, color, joined, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)').bind(crewRow.id, mid, await sha(token), name, cleanColor(body.color), now).run();
    return json({ crew: { id: crewRow.id, name: crewRow.name, code: crewRow.code }, mid, token });
  };
  if (op === 'create') {
    const name = cleanName(body.crew); if (!name) return json({ error: 'name' }, 400);
    for (let i = 0; i < 5; i++) {
      const row = { id: hex(8), name, code: code6() };
      try { await db.prepare('INSERT INTO crews (id, name, code, owner, goal_m, created) VALUES (?1, ?2, ?3, ?4, 0, ?5)').bind(row.id, name, row.code, '-', now).run(); }
      catch (e) { continue; }
      const r = await join(row); const j = await r.clone().json();
      if (j.mid) await db.prepare('UPDATE crews SET owner = ?1 WHERE id = ?2').bind(j.mid, row.id).run();
      return r;
    }
    return json({ error: 'busy' }, 503);
  }
  if (op === 'join') {
    const c = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{6}$/.test(c)) return json({ error: 'bad_code' }, 400);
    const row = await db.prepare('SELECT id, name, code FROM crews WHERE code = ?1').bind(c).first();
    if (!row) return json({ error: 'no_crew' }, 404);
    return join(row);
  }
  const crewId = op === 'board' ? url.searchParams.get('crew') : body.crew;
  const mid = await crewAuth(request, env, crewId);
  if (!mid) return json({ error: 'not_member' }, 403);
  if (op === 'board') {
    const since = now - 400 * 864e5;
    const c = await db.prepare('SELECT id, name, code, owner, goal_m, lineup FROM crews WHERE id = ?1').bind(crewId).first();
    if (c) { try { c.lineup = c.lineup ? JSON.parse(c.lineup) : null; } catch (e) { c.lineup = null; } }
    const ms = (await db.prepare('SELECT mid, name, color, joined, seen FROM crew_members WHERE crew = ?1').bind(crewId).all()).results || [];
    const ss = (await db.prepare('SELECT mid, s FROM crew_sessions WHERE crew = ?1 AND start >= ?2').bind(crewId, since).all()).results || [];
    await db.prepare('UPDATE crew_members SET seen = ?1 WHERE crew = ?2 AND mid = ?3').bind(now, crewId, mid).run();
    return json({ crew: c, me: mid, members: ms.map(m => Object.assign(m, { sessions: ss.filter(x => x.mid === m.mid).map(x => JSON.parse(x.s)) })) });
  }
  if (op === 'push') {
    const list = (Array.isArray(body.sessions) ? body.sessions : []).slice(0, 600).map(cleanSession).filter(Boolean);
    const since = num(body.since, 0, 9e15) || 0, st = [];
    if (body.replace) st.push(db.prepare(`DELETE FROM crew_sessions WHERE crew = ?1 AND mid = ?2 AND start >= ?3 AND s NOT LIKE '%"by":%'`).bind(crewId, mid, since));   // keep sessions others credited to this rower
    for (const o of list) st.push(db.prepare('INSERT OR REPLACE INTO crew_sessions (crew, mid, sid, s, start) VALUES (?1, ?2, ?3, ?4, ?5)').bind(crewId, mid, o.id, JSON.stringify(o), o.start));
    if (body.name) st.push(db.prepare('UPDATE crew_members SET name = ?1, color = ?2 WHERE crew = ?3 AND mid = ?4').bind(cleanName(body.name) || 'Rower', cleanColor(body.color), crewId, mid));
    for (let i = 0; i < st.length; i += 50) await db.batch(st.slice(i, i + 50));
    return json({ ok: true, n: list.length });
  }
  if (op === 'credit') {   // the phone that recorded a boat session credits it to the other rowers in the boat
    const o = cleanSession(body.session); if (!o) return json({ error: 'bad_session' }, 400);
    const me = await db.prepare('SELECT name FROM crew_members WHERE crew = ?1 AND mid = ?2').bind(crewId, mid).first();
    const want = [...new Set((Array.isArray(body.mids) ? body.mids : []).filter(x => /^[a-f0-9]{16}$/.test(x) && x !== mid))].slice(0, 12);
    if (!want.length) return json({ ok: true, n: 0 });
    const ok = ((await db.prepare('SELECT mid FROM crew_members WHERE crew = ?1').bind(crewId).all()).results || []).map(r => r.mid).filter(x => want.includes(x));
    const s2 = JSON.stringify(Object.assign({}, o, { by: mid, byName: me ? me.name : '' }));
    if (ok.length) await db.batch(ok.map(x => db.prepare('INSERT OR REPLACE INTO crew_sessions (crew, mid, sid, s, start) VALUES (?1, ?2, ?3, ?4, ?5)').bind(crewId, x, o.id, s2, o.start)));
    return json({ ok: true, n: ok.length });
  }
  if (op === 'uncredit') {
    const sid = num(body.sid, 1, 9e15); if (!sid) return json({ error: 'bad_sid' }, 400);
    await db.prepare(`DELETE FROM crew_sessions WHERE crew = ?1 AND sid = ?2 AND mid != ?3 AND s LIKE ?4`).bind(crewId, sid, mid, '%"by":"' + mid + '"%').run();
    return json({ ok: true });
  }
  if (op === 'lineup') {   // share today's lineup with the whole crew (names and seats only)
    let lu = null;
    if (body.lineup) { const L = body.lineup, seats = (Array.isArray(L.seats) ? L.seats : []).slice(0, 8).map(x => ({ n: cleanName(x && x.n), s: x && /^[PS]$/.test(x.s) ? x.s : '' }));
      lu = JSON.stringify({ name: cleanName(L.name), type: /^[1248][x+-]?$/.test(L.type || '') ? L.type : '8+', boat: cleanName(L.boat), cox: cleanName(L.cox), seats, note: String(L.note || '').replace(/[<>]/g, '').slice(0, 200), at: now, by: mid }); }
    await db.prepare('UPDATE crews SET lineup = ?1 WHERE id = ?2').bind(lu, crewId).run();
    return json({ ok: true });
  }
  if (op === 'goal') { const g = num(body.goal_m, 0, 10000000); if (g == null) return json({ error: 'goal' }, 400); await db.prepare('UPDATE crews SET goal_m = ?1 WHERE id = ?2').bind(Math.round(g), crewId).run(); return json({ ok: true }); }
  if (op === 'leave' || op === 'remove') {
    const target = op === 'leave' ? mid : String(body.mid || '');
    if (op === 'remove') { const c = await db.prepare('SELECT owner FROM crews WHERE id = ?1').bind(crewId).first(); if (!c || c.owner !== mid || !/^[a-f0-9]{16}$/.test(target) || target === mid) return json({ error: 'not_owner' }, 403); }
    await db.batch([db.prepare('DELETE FROM crew_sessions WHERE crew = ?1 AND mid = ?2').bind(crewId, target), db.prepare('DELETE FROM crew_members WHERE crew = ?1 AND mid = ?2').bind(crewId, target)]);
    const left = await db.prepare('SELECT COUNT(*) AS n FROM crew_members WHERE crew = ?1').bind(crewId).first();
    if (left && !left.n) await db.prepare('DELETE FROM crews WHERE id = ?1').bind(crewId).run();
    return json({ ok: true });
  }
  return json({ error: 'unknown' }, 404);
}

/* ---------- weekly report emails (Resend): the phone uploads a ready-made check-in snapshot, the server emails it Sunday 6 PM local ---------- */
const SITE = 'https://strokepulsetest.jeffscarcello.workers.dev';
const FROM = 'StrokePulse <strokepulse@shotpulse.app>';
const SEND_DOW = 0, SEND_HOUR = 18;   // Sunday, 6 PM in each rower's own time zone
const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
let repReady = false;
async function repTables(db) {
  if (repReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS report_subs (rid TEXT PRIMARY KEY, sh TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, tz TEXT NOT NULL, snap TEXT, updated INTEGER NOT NULL, ut TEXT NOT NULL UNIQUE, last_wk TEXT, tday TEXT, tn INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)').run();
  repReady = true;
}
const goodTz = tz => { try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch (e) { return false; } };
function localParts(tz, d) {
  const p = {}; for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hour12: false }).formatToParts(d || new Date())) p[x.type] = x.value;
  return { date: p.year + '-' + p.month + '-' + p.day, hour: +p.hour % 24, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
const hesc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okColor = c => /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#2f9bff';
/* the email itself: tables + inline styles so Gmail, Outlook and iPhone Mail all show it right */
function reportEmail(sub, snap, unsubUrl) {
  const S = snap || {}, st = S.status || {}, col = okColor(st.color), name = hesc(sub.name);
  const box = (k, v) => '<td style="width:33%;padding:10px;background:#f4f7fb;border-radius:10px;text-align:center"><div style="font-size:11px;letter-spacing:1px;color:#6b7785;text-transform:uppercase">' + hesc(k) + '</div><div style="font-size:22px;font-weight:800;color:#0b1724;margin-top:2px">' + hesc(v) + '</div></td>';
  const sec = t => '<div style="font-size:12px;letter-spacing:2px;font-weight:800;color:#e07800;margin:22px 0 8px">' + hesc(t) + '</div>';
  const pct = Math.max(0, Math.min(100, Math.round((+S.done || 0) * 100)));
  let h = '<div style="background:#eef2f7;padding:18px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">' +
    '<tr><td style="background:#0b1724;padding:18px 22px"><div style="color:#5ab4ff;font-weight:900;font-size:18px;letter-spacing:1px">STROKEPULSE</div><div style="color:#c9d3de;font-size:13px;margin-top:2px">' + name + ' · weekly check-in · ' + hesc(S.weekLabel) + '</div></td></tr>' +
    '<tr><td style="padding:20px 22px">';
  if (S.goal) {
    h += '<div style="font-size:26px;font-weight:900;color:' + col + '">' + hesc(st.text) + '</div><div style="color:#56616d;font-size:14px;margin-top:2px">Goal: ' + hesc(S.goal) + '</div>';
  } else h += '<div style="font-size:24px;font-weight:900;color:#0b1724">Your week</div>';
  h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin-top:12px"><tr>' + box('Sessions', S.sessions) + box('Distance', S.distance) + box(S.goal ? 'Predicted' : 'Time', S.goal ? S.predicted : S.time) + '</tr></table>';
  if (S.goal) h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-radius:5px;overflow:hidden"><tr><td style="height:10px;width:' + pct + '%;background:#2f9bff"></td><td style="height:10px;background:#e3e9f0"></td></tr></table>' +
    (S.trend ? '<div style="color:#56616d;font-size:13px;margin-top:6px">' + hesc(S.trend) + '</div>' : '');
  if (Array.isArray(S.series) && S.series.length) {
    h += sec('ON TRACK? WEEK BY WEEK') + '<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse"><tr style="color:#6b7785;font-size:12px"><td>Week</td><td>Predicted</td><td>On-track</td><td></td></tr>' +
      S.series.slice(-10).map(r => '<tr style="border-top:1px solid #e8edf3"><td>' + hesc(r.w) + '</td><td style="font-weight:800">' + hesc(r.p) + '</td><td style="color:#6b7785">' + hesc(r.n) + '</td><td style="font-weight:800;color:' + (r.ok ? '#16a34a' : '#dc2626') + '">' + (r.ok ? '✓' : '•') + '</td></tr>').join('') + '</table>' +
      (S.heading ? '<div style="color:#56616d;font-size:13px;margin-top:6px">' + hesc(S.heading) + '</div>' : '');
  }
  if (Array.isArray(S.changes) && S.changes.length) h += sec('PLAN CHANGES FOR NEXT WEEK') + S.changes.slice(0, 6).map(c => '<div style="padding:6px 0;font-size:15px;color:#0b1724">🔧 ' + hesc(c) + '</div>').join('');
  if (Array.isArray(S.tips) && S.tips.length) h += sec('SUGGESTIONS') + S.tips.slice(0, 6).map(t => '<div style="padding:8px 0;border-top:1px solid #eef2f6"><div style="font-weight:800;font-size:15px;color:#0b1724">' + hesc(t[0]) + ' ' + hesc(t[1]) + '</div><div style="color:#56616d;font-size:14px;margin-top:2px">' + hesc(t[2]) + '</div></div>').join('');
  if (Array.isArray(S.plan) && S.plan.length) h += sec((S.planLabel || 'NEXT WEEK').toUpperCase()) + S.plan.slice(0, 8).map(x => '<div style="padding:7px 0;border-top:1px solid #eef2f6"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:' + okColor(x.c) + ';margin-right:8px"></span><b style="color:#0b1724">' + hesc(x.n) + '</b><div style="color:#56616d;font-size:13px;margin-left:18px">' + hesc(x.d) + '</div></div>').join('');
  h += '<div style="text-align:center;margin:24px 0 6px"><a href="' + SITE + '/" style="display:inline-block;background:#1f74ff;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:12px">Open StrokePulse</a></div>' +
    '<div style="color:#8a95a1;font-size:12px;text-align:center;margin-top:12px">Based on sessions up to ' + hesc(S.asOf) + '. Open the app before Sunday evening for the freshest numbers.<br><a href="' + unsubUrl + '" style="color:#8a95a1">Stop these emails</a></div>' +
    '</td></tr></table></td></tr></table></div>';
  const text = 'StrokePulse weekly check-in - ' + (S.weekLabel || '') + '\n' + (S.goal ? (st.text || '') + '\nGoal: ' + S.goal + '\n' : '') + 'Sessions: ' + (S.sessions || '') + '  Distance: ' + (S.distance || '') + (S.goal ? '  Predicted: ' + (S.predicted || '') : '') + '\n' +
    (S.changes || []).map(c => '- ' + c).join('\n') + '\n' + (S.tips || []).map(t => '* ' + t[1] + ': ' + t[2]).join('\n') + '\n\nOpen StrokePulse: ' + SITE + '/\nStop these emails: ' + unsubUrl;
  return { subject: 'Your StrokePulse week: ' + (S.goal ? (st.text || 'check-in') : (S.sessions || '0') + ' sessions') + ' · ' + (S.weekLabel || ''), html: h, text };
}
async function sendBatch(env, msgs) {
  if (!env.RESEND_API_KEY) return { status: 0, body: 'no_key' };
  const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(msgs) });
  return { status: r.status, body: (await r.text()).slice(0, 300) };
}
function msgFor(sub) {
  const u = SITE + '/u?t=' + sub.ut, e = reportEmail(sub, sub.snap ? JSON.parse(sub.snap) : {}, u);
  return { from: FROM, to: [sub.email], subject: e.subject, html: e.html, text: e.text, headers: { 'List-Unsubscribe': '<' + u + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}
async function report(request, env, op) {
  const db = env.DB; await repTables(db);
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const t = await request.text(); if (t.length > 60000) return json({ error: 'too_big' }, 413);
  let b; try { b = JSON.parse(t || '{}'); } catch (e) { return json({ error: 'bad_json' }, 400); }
  if (!/^[a-f0-9]{16}$/.test(b.rid || '') || !/^[a-f0-9]{32}$/.test(b.secret || '')) return json({ error: 'bad_id' }, 400);
  const row = await db.prepare('SELECT * FROM report_subs WHERE rid = ?1').bind(b.rid).first(), sh = await sha('rep:' + b.secret);
  if (row && row.sh !== sh) return json({ error: 'not_yours' }, 403);
  const now = Date.now();
  if (op === 'save') {
    if (!b.email) { if (row) await db.prepare('DELETE FROM report_subs WHERE rid = ?1').bind(b.rid).run(); return json({ ok: true, off: true }); }
    const email = String(b.email).trim().slice(0, 254); if (!EMAIL_RE.test(email)) return json({ error: 'bad_email' }, 400);
    const tz = goodTz(b.tz) ? String(b.tz).slice(0, 60) : 'America/Winnipeg', name = cleanName(b.name) || 'Rower';
    const snap = b.snap && typeof b.snap === 'object' ? JSON.stringify(b.snap).slice(0, 50000) : (row ? row.snap : null);
    if (row) await db.prepare('UPDATE report_subs SET email = ?2, name = ?3, tz = ?4, snap = ?5, updated = ?6 WHERE rid = ?1').bind(b.rid, email, name, tz, snap, now).run();
    else await db.prepare('INSERT INTO report_subs (rid, sh, email, name, tz, snap, updated, ut, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?7)').bind(b.rid, sh, email, name, tz, snap, now, hex(16)).run();
    return json({ ok: true });
  }
  if (op === 'test') {
    if (!row) return json({ error: 'not_subscribed' }, 404);
    const day = new Date().toISOString().slice(0, 10), n = row.tday === day ? row.tn : 0;
    if (n >= 5) return json({ error: 'too_many_tests' }, 429);
    await db.prepare('UPDATE report_subs SET tday = ?2, tn = ?3 WHERE rid = ?1').bind(b.rid, day, n + 1).run();
    const r = await sendBatch(env, [msgFor(row)]);
    await db.prepare("INSERT OR REPLACE INTO appmeta (k, v) VALUES ('replog', ?1)").bind(JSON.stringify({ at: now, kind: 'test', n: 1, status: r.status, body: r.body })).run().catch(() => {});
    return r.status === 200 ? json({ ok: true }) : json({ error: 'send_failed', status: r.status }, 502);
  }
  return json({ error: 'unknown' }, 404);
}
async function unsubscribe(request, env, url) {
  const db = env.DB; await repTables(db); const tok = url.searchParams.get('t') || '';
  const page = (msg) => res('<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,sans-serif;max-width:440px;margin:60px auto;padding:0 20px;text-align:center"><h2>StrokePulse</h2>' + msg, 'text/html; charset=utf-8');
  if (!/^[a-f0-9]{32}$/.test(tok)) return page('<p>That link isn’t valid.</p>');
  const row = await db.prepare('SELECT email FROM report_subs WHERE ut = ?1').bind(tok).first();
  if (request.method === 'POST') { if (row) await db.prepare('DELETE FROM report_subs WHERE ut = ?1').bind(tok).run(); return page('<p>Done — no more weekly reports. You can turn them back on in the app under Progress → Goals.</p>'); }
  if (!row) return page('<p>You’re already unsubscribed.</p>');
  return page('<p>Stop the weekly StrokePulse report to <b>' + hesc(row.email) + '</b>?</p><form method=post><button style="padding:12px 22px;font-size:16px;border-radius:10px;border:0;background:#dc2626;color:#fff;font-weight:700">Unsubscribe</button></form>');
}
/* hourly on Sundays/Mondays (UTC): email everyone whose own clock says Sunday 6 PM, once per week */
async function weeklyReports(env) {
  const db = env.DB; await repTables(db); const now = new Date();
  const subs = (await db.prepare('SELECT * FROM report_subs').all()).results || [];
  const due = subs.filter(s => { const lp = localParts(s.tz, now); return lp.dow === SEND_DOW && lp.hour === SEND_HOUR && s.last_wk !== lp.date; });
  const log = { at: Date.now(), kind: 'weekly', due: due.length, sent: 0, status: [] };
  for (let i = 0; i < due.length; i += 100) {
    const part = due.slice(i, i + 100), r = await sendBatch(env, part.map(msgFor)); log.status.push(r.status);
    if (r.status === 200) { log.sent += part.length; await db.batch(part.map(s => db.prepare('UPDATE report_subs SET last_wk = ?2 WHERE rid = ?1').bind(s.rid, localParts(s.tz, now).date))); }
    else log.err = r.body;
  }
  if (due.length) await db.prepare("INSERT OR REPLACE INTO appmeta (k, v) VALUES ('replog', ?1)").bind(JSON.stringify(log)).run().catch(() => {});
  return log;
}

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
    await deleteAudio(env, k, id);
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

/* ---------- Cox mode: recordings + transcripts ----------
   Audio lives in R2 (binding AUDIO, key k/sid/idx) when bound; D1 keeps the metadata and transcript.
   Older rows that still hold audio in D1 keep working. */
const akey = (k, sid, idx) => k + '/' + sid + '/' + idx;
async function getAudioBytes(env, k, sid, idx, row) {
  if (row && row.audio) return toBytes(row.audio);
  if (!env.AUDIO) return null;
  const o = await env.AUDIO.get(akey(k, sid, idx)); return o ? new Uint8Array(await o.arrayBuffer()) : null;
}
async function deleteAudio(env, k, sid) {
  if (!env.AUDIO) return;
  let cursor; do { const l = await env.AUDIO.list({ prefix: k + '/' + sid + '/', cursor }); if (l.objects.length) await env.AUDIO.delete(l.objects.map(o => o.key)); cursor = l.truncated ? l.cursor : null; } while (cursor);
}
const PROMPT = 'Rowing coxswain calls: sit ready, attention, row, power ten, legs, catch, finish, swing, ratio, rate up two, settle, lengthen, weigh enough, hold water, port, starboard, bow pair, stern pair, seat, five hundred to go, sprint.';
async function transcribe(env, k, sid, idx) {
  const db = env.DB;
  const row = await db.prepare('SELECT audio, mime FROM cox_audio WHERE k = ?1 AND sid = ?2 AND idx = ?3').bind(k, sid, idx).first();
  const bytes = row ? await getAudioBytes(env, k, sid, idx, row) : null;
  if (!bytes) return 'missing';
  if (!env.AI) { await db.prepare("UPDATE cox_audio SET status = 'no_ai' WHERE k = ?1 AND sid = ?2 AND idx = ?3").bind(k, sid, idx).run(); return 'no_ai'; }
  try {
    const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64(bytes), initial_prompt: PROMPT, vad_filter: true, language: 'en' });
    // keep every word's own start/end time so calls can be split at pauses and timed at the keyword
    const segs = ((r && r.segments) || []).map(s => ({ s: +(+s.start).toFixed(2), e: +(+s.end).toFixed(2), t: String(s.text || '').trim(),
      w: (s.words || []).map(w => [+(+w.start).toFixed(2), +(+w.end).toFixed(2), String(w.word || '').trim()]).filter(w => w[2]) })).filter(s => s.t);
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
    const bytes = r ? await getAudioBytes(env, k, sid, idx, r) : null;
    if (!bytes) return json({ error: 'not_found' }, 404);
    return new Response(bytes, { headers: { 'Content-Type': r.mime, 'Cache-Control': 'private, max-age=86400' } });
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
    if (env.AUDIO) await env.AUDIO.put(akey(k, sid, idx), buf, { httpMetadata: { contentType: mime } });
    await db.prepare("INSERT OR REPLACE INTO cox_audio (k, sid, idx, t0, dur, mime, audio, status, tx, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'new', NULL, ?8)").bind(k, sid, idx, t0, dur, mime, env.AUDIO ? null : buf, Date.now()).run();
    ctx.waitUntil(transcribe(env, k, sid, idx));
    return json({ ok: true });
  }
  if (op === 'retx' && request.method === 'POST') {   // retry any chunk that failed or never finished
    const all = url.searchParams.get('all') === '1';   // all=1: redo finished chunks too (older transcripts without word timings)
    const rows = (await (all ? db.prepare("SELECT idx FROM cox_audio WHERE k = ?1 AND sid = ?2 AND (status != 'done' OR tx NOT LIKE '%\"w\":%')").bind(k, sid)
      : db.prepare("SELECT idx FROM cox_audio WHERE k = ?1 AND sid = ?2 AND status != 'done' AND updated < ?3").bind(k, sid, Date.now() - 60000)).all()).results || [];
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
  async scheduled(event, env, ctx) { ctx.waitUntil(weeklyReports(env)); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url), p = url.pathname;
    if (p.startsWith('/api/sync/')) return sync(request, env, p.slice(10), url);
    if (p.startsWith('/api/cox/')) return cox(request, env, ctx, p.slice(9), url);
    if (p === '/api/live') return live(request, env, url);
    if (p.startsWith('/api/crew/')) return crew(request, env, p.slice(10), url);
    if (p === '/api/config') return json({ gmaps: env.GMAPS_KEY || null, email: !!env.RESEND_API_KEY });
    if (p.startsWith('/api/report/')) return report(request, env, p.slice(12));
    if (p === '/u') return unsubscribe(request, env, url);
    if (p === '/admin') return request.method === 'POST' ? adminInstall(request, env) : res(ADMIN_PAGE, 'text/html; charset=utf-8');
    const app = await loadApp(env.DB);
    if (p === '/api/health') {
      const g = await env.DB.prepare("SELECT v FROM appmeta WHERE k = 'ghlast'").first().catch(() => null);
      return res(JSON.stringify({ ok: !!app, app: 'strokepulse', build: app ? app.build : null, label: app ? app.label : null, loader: LOADER, ai: !!env.AI, live: !!env.LIVE, r2: !!env.AUDIO, gmaps: !!env.GMAPS_KEY, email: !!env.RESEND_API_KEY, updater: g ? JSON.parse(g.v) : null }, null, 2), 'application/json', { 'Cache-Control': 'no-store' });
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
