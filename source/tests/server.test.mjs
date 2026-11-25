// Server tests: updater installs app.json into a fake D1 (SQLite), loader serves it.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert';
const dist = new URL('../../dist/', import.meta.url);
const appText = fs.readFileSync(new URL('app.json', dist), 'utf8');
const buildTxt = fs.readFileSync(new URL('build.txt', dist), 'utf8');
function fakeD1() {
  const s = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a.map(x => x instanceof ArrayBuffer ? new Uint8Array(x) : x)),
    run: async () => { s.prepare(sql).run(...args); return {}; },
    first: async () => s.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: s.prepare(sql).all(...args) }),
  });
  return { prepare: sql => stmt(sql), batch: async list => { for (const x of list) await x.run(); } };
}
globalThis.fetch = async url => {
  const u = String(url);
  if (u.includes('/test/build.txt')) return new Response(buildTxt);
  if (u.includes('/test/app.json')) return new Response(appText);
  return new Response('nf', { status: 404 });
};
const updater = (await import('../workers/updater.js')).default;
const loader = (await import('../workers/loader.js')).default;
const db = fakeD1(), env = { TEST_DB: db, DB: db };
if (process.env.R2 === '1') {   // R2 MODE: a fake bucket
  const store = new Map();
  env.AUDIO = { put: async (k, v) => { store.set(k, new Uint8Array(v instanceof ArrayBuffer ? v : await new Response(v).arrayBuffer())); },
    get: async k => store.has(k) ? { arrayBuffer: async () => store.get(k).buffer.slice(0) } : null,
    list: async ({ prefix }) => ({ objects: [...store.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })), truncated: false }),
    delete: async keys => { for (const k of [].concat(keys)) store.delete(k); } };
  globalThis.__r2 = store;
}
// before install
let r = await loader.fetch(new Request('https://x/'), env); assert.match(await r.text(), /Almost ready/);
const tasks = []; await updater.scheduled({}, env, { waitUntil: p => tasks.push(p) }); await Promise.all(tasks);
const meta = await db.prepare("SELECT v FROM appmeta WHERE k='ghbuild'").first();
assert.equal(meta.v, buildTxt.trim()); console.log('installed', meta.v);
// second run is up to date
tasks.length = 0; await updater.scheduled({}, env, { waitUntil: p => tasks.push(p) }); await Promise.all(tasks);
assert.match((await db.prepare("SELECT v FROM appmeta WHERE k='ghlast'").first()).v, /up_to_date/);
await new Promise(r => setTimeout(r, 10));
const app = JSON.parse(appText);
for (const [p, type] of [['/', 'text/html'], ['/sw.js', 'javascript'], ['/manifest.webmanifest', 'manifest'], ['/icon.svg', 'svg'], ['/icon-192.png', 'png'], ['/icon-512.png', 'png'], ['/apple-touch-icon.png', 'png']]) {
  r = await loader.fetch(new Request('https://x' + p), env); assert.equal(r.status, 200, p); assert.ok(r.headers.get('content-type').includes(type), p);
}
r = await loader.fetch(new Request('https://x/'), env); const html = await r.text();
assert.ok(html.includes('v' + app.label) && html.includes(app.build), 'version shown');
r = await loader.fetch(new Request('https://x/api/health'), env); const h = await r.json(); assert.equal(h.build, app.build); assert.equal(h.ok, true);
// webhook: bad signature rejected, good signature accepted
env.HOOK_SECRET = 'abc123';
r = await updater.fetch(new Request('https://u/hook', { method: 'POST', body: '{}', headers: { 'X-GitHub-Event': 'ping', 'X-Hub-Signature-256': 'sha256=00' } }), env, { waitUntil() {} });
assert.equal(r.status, 401);
const body = '{"zen":"x"}'; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('abc123'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sig = 'sha256=' + Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).toString('hex');
r = await updater.fetch(new Request('https://u/hook', { method: 'POST', body, headers: { 'X-GitHub-Event': 'ping', 'X-Hub-Signature-256': sig } }), env, { waitUntil() {} });
assert.equal(await r.text(), 'pong');
// wrong-app file rejected
r = await loader.fetch(new Request('https://x/admin'), env); assert.equal(r.status, 200);
console.log('ALL SERVER TESTS PASSED');

// ---- cloud backup endpoints ----
{
  const KEY = 'ABCD-EFGH-JKMN-PQRS-TUVW', H = { 'X-Sync-Key': KEY, 'Content-Type': 'application/json' };
  const call = (path, body, key) => loader.fetch(new Request('https://x/api/sync/' + path, { method: body ? 'POST' : 'GET', headers: key === undefined ? H : { 'X-Sync-Key': key }, body: body ? JSON.stringify(body) : undefined }), env);
  assert.equal((await call('list', null, 'nope')).status, 400);
  assert.equal((await call('put', { id: 17, summary: { a: 1 }, data: { samples: [[0, 1]] } })).status, 200);
  assert.equal((await call('put', { id: 18, summary: { a: 2 }, data: { samples: [] } })).status, 200);
  let l = await (await call('list')).json(); assert.deepEqual(l.sessions.map(s => s.id), [18, 17]);
  let g = await (await call('get?id=17')).json(); assert.deepEqual(g.data.samples, [[0, 1]]);
  // another code sees nothing
  l = await (await call('list', null, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ')).json(); assert.equal(l.sessions.length, 0);
  assert.equal((await call('del', { id: 17 })).status, 200);
  l = await (await call('list')).json(); assert.deepEqual(l.sessions.map(s => s.id), [18]);
  assert.equal((await call('put', { id: 'x', summary: {}, data: {} })).status, 400);
  // raw key never stored
  const rows = await db.prepare('SELECT k FROM sessions').all(); assert.ok(!rows.results.some(r => r.k.includes('ABCD')));
  console.log('BACKUP TESTS PASSED');
}

// ---- Cox mode: recordings, transcripts, coach link ----
{
  const KEY = 'COXX-ABCD-EFGH-JKMN-PQRS';
  const waits = [];
  const ctx = { waitUntil: p => waits.push(p) };
  env.AI = { run: async (model, inp) => { assert.equal(model, '@cf/openai/whisper-large-v3-turbo'); assert.ok(inp.audio.length > 100); return { text: 'Power ten now', segments: [{ start: 1.5, end: 3.2, text: ' Power ten now', words: [{ word: ' Power', start: 1.5, end: 1.9 }, { word: ' ten', start: 1.9, end: 2.3 }, { word: ' now', start: 2.6, end: 3.2 }] }, { start: 10, end: 11, text: 'Legs' }] }; } };
  const req = (path, opt = {}) => loader.fetch(new Request('https://x' + path, opt), env, ctx);
  const audio = new Uint8Array(4000).map((_, i) => i % 251);
  let r = await req('/api/sync/put', { method: 'POST', headers: { 'X-Sync-Key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 500, summary: { start: 1, cox: true }, data: { samples: [], cox: { rec: 'r1' } } }) });
  assert.equal(r.status, 200);
  r = await req('/api/cox/audio?sid=500&idx=0&t0=-2.5&dur=60', { method: 'POST', headers: { 'X-Sync-Key': KEY, 'Content-Type': 'audio/mp4' }, body: audio });
  assert.equal(r.status, 200); await Promise.all(waits);
  let c = await (await req('/api/cox/chunks?sid=500', { headers: { 'X-Sync-Key': KEY } })).json();
  assert.equal(c.chunks.length, 1); assert.equal(c.chunks[0].status, 'done'); assert.equal(c.chunks[0].t0, -2.5); assert.equal(c.chunks[0].tx[0].t, 'Power ten now');
  assert.deepEqual(c.chunks[0].tx[0].w, [[1.5, 1.9, 'Power'], [1.9, 2.3, 'ten'], [2.6, 3.2, 'now']], 'word timings kept');
  r = await req('/api/cox/retx?all=1&sid=500', { method: 'POST', headers: { 'X-Sync-Key': KEY } }); assert.equal(r.status, 200);
  r = await req('/api/cox/audio?sid=500&idx=0', { headers: { 'X-Sync-Key': KEY } });
  assert.equal(r.headers.get('content-type'), 'audio/mp4'); assert.equal((await r.arrayBuffer()).byteLength, 4000);
  // crew cannot read without the link
  assert.equal((await req('/api/cox/chunks?sid=500')).status, 400);
  // coach link
  let t = await (await req('/api/cox/share', { method: 'POST', headers: { 'X-Sync-Key': KEY } })).json();
  assert.match(t.token, /^[a-z0-9]{32}$/);
  const CT = { 'X-Coach-Token': t.token };
  let l = await (await req('/api/sync/list', { headers: CT })).json(); assert.equal(l.sessions[0].id, 500);
  c = await (await req('/api/cox/chunks?sid=500', { headers: CT })).json(); assert.equal(c.chunks.length, 1);
  assert.equal((await req('/api/cox/audio?sid=500&idx=0', { headers: CT })).status, 200);
  // coach is read-only
  assert.equal((await req('/api/sync/put', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, CT), body: '{"id":9,"summary":{},"data":{}}' })).status, 403);
  assert.equal((await req('/api/cox/audio?sid=500&idx=1&t0=0&dur=1', { method: 'POST', headers: Object.assign({ 'Content-Type': 'audio/mp4' }, CT), body: audio })).status, 403);
  assert.equal((await req('/api/cox/share', { method: 'POST', headers: CT })).status, 403);
  // reset link: old token stops working
  const t2 = await (await req('/api/cox/share', { method: 'POST', headers: { 'X-Sync-Key': KEY } })).json();
  assert.notEqual(t2.token, t.token); assert.equal((await req('/api/sync/list', { headers: CT })).status, 400);
  // AI failure is recorded, not fatal
  env.AI = { run: async () => { throw new Error('boom'); } };
  waits.length = 0;
  await req('/api/cox/audio?sid=500&idx=1&t0=58&dur=60', { method: 'POST', headers: { 'X-Sync-Key': KEY, 'Content-Type': 'audio/mp4' }, body: audio }); await Promise.all(waits);
  c = await (await req('/api/cox/chunks?sid=500', { headers: { 'X-Sync-Key': KEY } })).json(); assert.equal(c.chunks[1].status, 'error');
  // bad inputs
  assert.equal((await req('/api/cox/audio?sid=500&idx=2&t0=0&dur=1', { method: 'POST', headers: { 'X-Sync-Key': KEY, 'Content-Type': 'text/html' }, body: audio })).status, 400);
  assert.equal((await req('/api/cox/audio?sid=500&idx=2&t0=0&dur=1', { method: 'POST', headers: { 'X-Sync-Key': KEY, 'Content-Type': 'audio/mp4' }, body: new Uint8Array(10) })).status, 400);
  // deleting the session removes its audio
  await req('/api/sync/del', { method: 'POST', headers: { 'X-Sync-Key': KEY, 'Content-Type': 'application/json' }, body: '{"id":500}' });
  c = await (await req('/api/cox/chunks?sid=500', { headers: { 'X-Sync-Key': KEY } })).json(); assert.equal(c.chunks.length, 0);
  // live endpoint needs a websocket upgrade
  assert.equal((await req('/api/live?key=' + KEY)).status, 426);
  if (process.env.R2 === '1') { assert.equal(globalThis.__r2.size, 0, 'session delete removes R2 audio'); const row = await db.prepare('SELECT COUNT(*) AS n FROM cox_audio WHERE audio IS NOT NULL').first(); assert.equal(row.n, 0, 'no audio bytes in D1'); }
  console.log('COX SERVER TESTS PASSED' + (process.env.R2 === '1' ? ' (R2 storage)' : ' (D1 storage)'));
}
{ // CREWS
  const C = (op, body, hdr) => loader.fetch(new Request('https://x/api/crew/' + op, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, hdr || {}), body: body ? JSON.stringify(body) : undefined }), env);
  let r = await C('create', { crew: 'Selkirk Girls 8+', name: 'Emily', color: '#ff9f1c' }); assert.equal(r.status, 200); const a = await r.json();
  assert.match(a.crew.code, /^[A-Z0-9]{6}$/); assert.match(a.mid, /^[a-f0-9]{16}$/); assert.match(a.token, /^[a-f0-9]{48}$/);
  const HA = { 'X-Member': a.mid + ':' + a.token };
  r = await C('join', { code: a.crew.code.toLowerCase(), name: 'Ava<script>' }); const b = await r.json(); assert.equal(b.crew.id, a.crew.id);
  const HB = { 'X-Member': b.mid + ':' + b.token };
  assert.equal((await C('join', { code: 'ZZZZZZ' })).status, 404);
  // push sessions (extra fields like samples/lat must be dropped)
  const now = Date.now();
  r = await C('push', { crew: a.crew.id, replace: true, since: 0, sessions: [{ id: now - 5000, start: now - 5000, dist: 5000, time: 1300, strokes: 500, kcal: 300, b500: 118.4, st: 81, samples: [[1, 50, -96]], lat: 50 }, { id: 'x' }] }, HA);
  assert.equal((await r.json()).n, 1);
  await C('push', { crew: a.crew.id, sessions: [{ id: now - 9000, start: now - 9000, dist: 3000, time: 800, strokes: 300 }] }, HB);
  r = await loader.fetch(new Request('https://x/api/crew/board?crew=' + a.crew.id, { headers: HB }), env); const bd = await r.json();
  assert.equal(bd.members.length, 2); const em = bd.members.find(m => m.mid === a.mid); assert.equal(em.sessions[0].b500, 118.4); assert.equal(em.sessions[0].samples, undefined); assert.equal(em.sessions[0].lat, undefined);
  assert.equal(bd.members.find(m => m.mid === b.mid).name, 'Avascript');
  // replace removes a deleted session
  await C('push', { crew: a.crew.id, replace: true, since: 0, sessions: [] }, HA);
  r = await loader.fetch(new Request('https://x/api/crew/board?crew=' + a.crew.id, { headers: HA }), env); assert.equal((await r.json()).members.find(m => m.mid === a.mid).sessions.length, 0);
  // auth
  assert.equal((await loader.fetch(new Request('https://x/api/crew/board?crew=' + a.crew.id, { headers: { 'X-Member': a.mid + ':' + '0'.repeat(48) } }), env)).status, 403);
  assert.equal((await C('remove', { crew: a.crew.id, mid: a.mid }, HB)).status, 403);   // only the owner can remove
  assert.equal((await C('goal', { crew: a.crew.id, goal_m: 40000 }, HB)).status, 200);
  assert.equal((await C('remove', { crew: a.crew.id, mid: b.mid }, HA)).status, 200);
  assert.equal((await loader.fetch(new Request('https://x/api/crew/board?crew=' + a.crew.id, { headers: HB }), env)).status, 403);
  r = await loader.fetch(new Request('https://x/api/crew/board?crew=' + a.crew.id, { headers: HA }), env); const bd2 = await r.json(); assert.equal(bd2.crew.goal_m, 40000); assert.equal(bd2.members.length, 1);
  assert.equal((await C('leave', { crew: a.crew.id }, HA)).status, 200);
  assert.equal(await db.prepare('SELECT id FROM crews WHERE id = ?1').bind(a.crew.id).first(), null);
  r = await loader.fetch(new Request('https://x/api/config'), Object.assign({}, env, { GMAPS_KEY: 'AIzaTEST' })); assert.equal((await r.json()).gmaps, 'AIzaTEST');
  console.log('CREW TESTS PASSED');
}
