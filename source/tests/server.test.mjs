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
    bind: (...a) => stmt(sql, a),
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
