// StrokePulse updater — installs builds from GitHub into the site database.
const UPDATER = 'u1';
const REPO = 'jeffscarcello-tech/strokepulse-builds';
const BRANCH = 'main';
const PART = 50000;
const APP_KIND = 'strokepulse';
const SITES = [ { name: 'test', dir: 'test', db: 'TEST_DB' } ];   // later: { name: 'live', dir: 'live', db: 'LIVE_DB' }

async function getText(path, ref) {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${ref || BRANCH}/${path}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' }, cf: { cacheTtl: 0 } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('github_' + r.status);
  return await r.text();
}
async function ensure(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS appmeta (k TEXT PRIMARY KEY, v TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS apppart (ver TEXT NOT NULL, i INTEGER NOT NULL, d TEXT NOT NULL, PRIMARY KEY (ver, i))').run();
}
const setMeta = (db, k, v) => db.prepare('INSERT OR REPLACE INTO appmeta (k, v) VALUES (?1, ?2)').bind(k, v).run();
function bundleOk(b) {
  if (!(b && typeof b.html === 'string' && b.html.length > 1000 && typeof b.sw === 'string' && b.build && b.manifest && b.icon_svg && b.i192 && b.i512 && b.apple)) return 'not_an_app_file';
  if (b.app !== APP_KIND) return 'wrong_app';
  return null;
}
async function syncSite(env, site, ref) {
  const db = env[site.db]; if (!db) return 'no_database_binding';
  await ensure(db);
  const bt = ((await getText(site.dir + '/build.txt', ref)) || '').trim();
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(bt)) return 'nothing_to_install';
  const last = await db.prepare("SELECT v FROM appmeta WHERE k = 'ghbuild'").first();
  if (last && last.v === bt) return 'up_to_date';
  const text = await getText(site.dir + '/app.json', ref); if (!text) return 'app_file_missing';
  let b; try { b = JSON.parse(text); } catch (e) { return 'app_file_damaged'; }
  const bad = bundleOk(b); if (bad) return bad;
  if (String(b.build) !== bt) return 'build_name_mismatch';
  /* only one install at a time (the backup check and a GitHub ping can arrive together) */
  const now = Date.now(), got = await db.prepare("INSERT INTO appmeta (k, v) VALUES ('ghlock', ?1) ON CONFLICT(k) DO UPDATE SET v = excluded.v WHERE CAST(appmeta.v AS INTEGER) < ?2 RETURNING v").bind(String(now), now - 120000).first();
  if (!got) return 'busy';
  try { return await install(db, text, bt); } finally { await db.prepare("DELETE FROM appmeta WHERE k = 'ghlock'").run().catch(() => {}); }
}
async function install(db, text, bt) {
  const ver = bt.replace(/[^A-Za-z0-9]/g, '').slice(0, 14) + Date.now().toString(36);
  const n = Math.ceil(text.length / PART);
  for (let i = 0; i < n; i += 8) {
    const st = [];
    for (let j = i; j < Math.min(n, i + 8); j++) st.push(db.prepare('INSERT OR REPLACE INTO apppart (ver, i, d) VALUES (?1, ?2, ?3)').bind(ver, j, text.slice(j * PART, (j + 1) * PART)));
    await db.batch(st);
  }
  const rows = (await db.prepare('SELECT d FROM apppart WHERE ver = ?1 ORDER BY i').bind(ver).all()).results || [];
  if (rows.length !== n || rows.map(r => r.d).join('') !== text) { await db.prepare('DELETE FROM apppart WHERE ver = ?1').bind(ver).run(); return 'readback_mismatch'; }
  await setMeta(db, 'cur', JSON.stringify({ ver, n }));
  await db.prepare('DELETE FROM apppart WHERE ver != ?1').bind(ver).run();
  await setMeta(db, 'ghbuild', bt);
  return 'installed ' + bt;
}
async function run(env, ref) {
  const out = {};
  for (const s of SITES) {
    let r; try { r = await syncSite(env, s, ref); } catch (e) { r = 'error ' + String(e && e.message || e).slice(0, 120); }
    out[s.name] = r;
    const db = env[s.db]; if (db) await setMeta(db, 'ghlast', JSON.stringify({ at: Date.now(), r, u: UPDATER })).catch(() => {});
  }
  return out;
}
/* GitHub calls POST /hook the moment Claude pushes (webhook signed with HOOK_SECRET) */
async function hook(request, env, ctx) {
  if (request.method !== 'POST' || !env.HOOK_SECRET) return new Response('no', { status: 404 });
  const raw = await request.text();
  if (raw.length > 2000000) return new Response('too big', { status: 413 });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.HOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = 'sha256=' + [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))].map(x => x.toString(16).padStart(2, '0')).join('');
  const sig = request.headers.get('X-Hub-Signature-256') || '';
  let same = sig.length === mac.length; for (let i = 0; i < mac.length; i++) same = same && sig.charCodeAt(i) === mac.charCodeAt(i);
  if (!same) return new Response('bad signature', { status: 401 });
  const ev = request.headers.get('X-GitHub-Event') || '';
  if (ev === 'ping') return new Response('pong');
  if (ev !== 'push') return new Response('ignored');
  let p; try { p = JSON.parse(raw); } catch (e) { return new Response('bad json', { status: 400 }); }
  if (p.ref !== 'refs/heads/' + BRANCH || !/^[0-9a-f]{40}$/.test(p.after || '')) return new Response('ignored');
  ctx.waitUntil(run(env, p.after));   // read the exact pushed commit, so a just-pushed file is never served stale
  return new Response('started');
}
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(request, env, ctx) {   // /hook for GitHub, otherwise a read-only status page
    if (new URL(request.url).pathname === '/hook') return hook(request, env, ctx);
    const out = {};
    for (const s of SITES) { const db = env[s.db]; if (!db) { out[s.name] = 'no database'; continue; }
      const g = await db.prepare("SELECT v FROM appmeta WHERE k = 'ghlast'").first().catch(() => null), b = await db.prepare("SELECT v FROM appmeta WHERE k = 'ghbuild'").first().catch(() => null);
      out[s.name] = { installed: b ? b.v : null, lastCheck: g ? JSON.parse(g.v) : null }; }
    return new Response(JSON.stringify({ updater: UPDATER, repo: REPO, sites: out }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
};
