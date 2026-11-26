/* StrokePulse — Concept2 erg import (window.ERG)
   Connect a rower's Concept2 Logbook once; erg workouts rowed with ErgData then come into History
   next to on-water rows. Read-only. Each rower on the phone links their own Logbook. */
(function(){
'use strict';
const $e = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const pid = () => window.TRN ? TRN.cur().id : 'me';
const keyOf = p => 'sp_c2_' + (p || pid());
const st = p => LS.get(keyOf(p), null) || {};
const put = (o, p) => LS.set(keyOf(p), o);
const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
const api = (path, opt) => { const s = st(); return fetch('/api/c2/' + path, Object.assign({ cache:'no-store' }, opt || {}, { headers:{ 'X-C2-Link':s.lk || '' } })); };
let ready = null, busy = false;   // ready: null unknown, true set up on this site, false not yet

/* ---------- strokes → the app's 1-second samples [t, lat, lon, dist, speed, rate, strokes, rest, check] ---------- */
function build(w, strokes){
  const T = (w.time || 0) / 10, D = w.distance || 0;
  const iv = (w.workout && (w.workout.intervals || w.workout.splits)) || [];
  const isIv = /Interval/i.test(w.workout_type || '');
  // split the stroke list into pieces: time and distance restart at 0 for each interval
  const pieces = []; let cur = [];
  for(const k of strokes || []){ if(cur.length && (k[0] < cur[cur.length - 1][0] || k[1] < cur[cur.length - 1][1])){ pieces.push(cur); cur = []; } cur.push(k); }
  if(cur.length) pieces.push(cur);
  const samples = [], laps = []; let t0 = 0, d0 = 0, n0 = 0;
  const push = (t, d, v, rate, n, rest) => samples.push([t, null, null, +d.toFixed(1), +v.toFixed(2), rate, n, rest, 0]);
  if(!pieces.length || pieces.every(p => p.length < 2)){   // no stroke data: a steady row at the average pace
    const v = T > 0 ? D / T : 0, rate = w.stroke_rate || 0;
    for(let s = 0; s <= Math.floor(T); s++) push(s, Math.min(D, v * s), v, rate, Math.round(rate / 60 * s), 0);
    return { samples, laps, strokes:w.stroke_count || Math.round((w.stroke_rate || 0) * T / 60) };
  }
  pieces.forEach((p, i) => {
    const end = p[p.length - 1][0] / 10, dEnd = p[p.length - 1][1] / 10; let j = 0;
    for(let s = 0; s <= Math.floor(end); s++){
      while(j < p.length - 2 && p[j + 1][0] / 10 <= s) j++;
      const a = p[j], b = p[Math.min(j + 1, p.length - 1)], ta = a[0] / 10, tb = b[0] / 10;
      const f = tb > ta ? Math.min(1, Math.max(0, (s - ta) / (tb - ta))) : 0, d = a[1] / 10 + f * (b[1] - a[1]) / 10;
      const pace = (f < 0.5 ? a : b)[2] / 10;   // seconds per 500 m
      push(t0 + s, d0 + d, pace > 0 ? 500 / pace : 0, (f < 0.5 ? a : b)[3] || 0, n0 + j + 1, 0);
    }
    if(isIv || pieces.length > 1){
      const rate = p.reduce((x, k) => x + (k[3] || 0), 0) / p.length;
      laps.push({ n:laps.length + 1, type:'work', t:end, d:dEnd, s:p.length, at:t0 + end, rep:i + 1, rate });
    }
    t0 += Math.floor(end) + 1; d0 += dEnd; n0 += p.length;
    const rest = i < pieces.length - 1 ? Math.round(((iv[i] && iv[i].rest_time) || 0) / 10) : 0;
    if(rest > 0){ for(let s = 0; s < rest; s++) push(t0 + s, d0, 0.3, 0, n0, 1); laps.push({ n:laps.length + 1, type:'rest', t:rest, d:0, s:0, at:t0 + rest, rep:i + 1, rate:0 }); t0 += rest; }
  });
  return { samples, laps, strokes:n0 };
}
function desc(w, laps){
  const work = laps.filter(l => l.type === 'work');
  if(work.length > 1){
    const ds = work.map(l => Math.round(l.d / 50) * 50), same = ds.every(x => x === ds[0]);
    const ts = work.map(l => Math.round(l.t)), sameT = ts.every(x => Math.abs(x - ts[0]) <= 2);
    if(/Distance/i.test(w.workout_type || '') && same) return work.length + ' × ' + (ds[0] >= 1000 && ds[0] % 1000 === 0 ? ds[0] / 1000 + 'k' : ds[0] + 'm');
    if(/Time/i.test(w.workout_type || '') && sameT) return work.length + ' × ' + fmtTime(ts[0]);
    return work.length + ' intervals';
  }
  return 'Just Row';
}
function startOf(w){
  // Concept2 stores the workout time on the monitor; use UTC when it's there
  const raw = w.date_utc ? w.date_utc.replace(' ', 'T') + 'Z' : (w.date || '').replace(' ', 'T');
  const t = Date.parse(raw); return isFinite(t) ? t : Date.now();
}
function importOne(w, strokes, idx){
  const B = build(w, strokes), start = startOf(w);
  let id = start; while(idx.some(x => x.id === id)) id++;
  const wk = B.laps.some(l => l.type === 'work') ? { mode:'intervals', type:'dist', val:0, reps:B.laps.filter(l => l.type === 'work').length, rest:0 } : { mode:'justgo' };
  const r = { id, start, dist:w.distance || 0, strokes:B.strokes, samples:B.samples, laps:B.laps, wk, sport:'erg' };
  if(!r.samples.length) return null;
  const T = r.samples[r.samples.length - 1][0];
  const indoor = { c2:w.id, machine:'RowErg', hr:(w.heart_rate && (w.heart_rate.average || w.heart_rate.avg)) || null, drag:w.drag_factor || null, kcal:w.calories_total || null };
  LS.set('sp_s_' + id, { samples:r.samples, laps:r.laps, wk:r.wk, indoor });
  const sm = { id, who:pid(), start, dist:r.dist, time:T, strokes:r.strokes, sport:'erg', mode:wk.mode, cox:false, indoor:true, c2:w.id, wkDesc:'Erg · ' + desc(w, r.laps) };
  idx.unshift(sm);
  return sm;
}

/* ---------- import ---------- */
async function sync(say){
  const s = st(); if(!s.lk || !s.linked || busy || !navigator.onLine) return 0;
  busy = true; let added = 0;
  try{
    const from = s.last ? new Date(s.last - 3 * 864e5).toISOString().slice(0, 10) : '';
    const r = await api('results' + (from ? '?from=' + from : ''));
    if(r.status === 401 || r.status === 404){ s.linked = false; put(s); render(); if(say) toast('Concept2 needs connecting again'); return 0; }
    if(!r.ok) throw 0;
    const list = (await r.json()).results || [], done = new Set(s.ids || []);
    const todo = list.filter(w => !done.has(w.id)).sort((a, b) => startOf(a) - startOf(b)).slice(-60);
    const idx = LS.get('sp_index', []);
    for(const w of todo){
      let strokes = [];
      try{ const k = await api('strokes?id=' + w.id); if(k.ok) strokes = (await k.json()).strokes || []; }catch(e){}
      if(importOne(w, strokes, idx)) added++;
      done.add(w.id);
    }
    idx.sort((a, b) => b.start - a.start);
    LS.set('sp_index', idx);
    const s2 = st(); s2.ids = [...done].slice(-3000); s2.last = Math.max(s2.last || 0, ...list.map(startOf), 0); s2.checked = Date.now(); put(s2);
    if(added){ if(window.ANA && ANA.invalidate) ANA.invalidate(); if(typeof renderHistory === 'function' && $e('scr-history') && $e('scr-history').classList.contains('on')) renderHistory(); if(typeof syncNow === 'function') setTimeout(syncNow, 800); }
    if(say || added) toast(added ? added + ' erg workout' + (added > 1 ? 's' : '') + ' added from Concept2' : 'No new erg workouts');
  }catch(e){ if(say) toast('Couldn’t reach Concept2 — try again later'); }
  finally{ busy = false; render(); }
  return added;
}
async function status(){
  const s = st(); if(!s.lk) return;
  try{ const r = await api('status'); if(r.status === 503){ ready = false; return; } if(!r.ok) return; const j = await r.json(); ready = true;
    const was = s.linked; s.linked = j.linked; s.name = j.name; put(s);
    if(j.linked && !was){ toast('Concept2 connected' + (j.name ? ' — ' + j.name : '')); render(); sync(true); }
    else render();
  }catch(e){}
}
function connect(){
  if(ready === false){ toast('The Concept2 connection isn’t switched on yet'); return; }
  const s = st(); s.lk = s.lk || hex(32); s.pending = Date.now(); put(s);
  location.href = '/api/c2/start?lk=' + s.lk;
}
async function disconnect(){
  if(!confirm('Disconnect Concept2 for ' + (window.TRN ? TRN.cur().name : 'this rower') + '? Erg workouts already imported stay in History.')) return;
  try{ await api('unlink', { method:'POST' }); }catch(e){}
  const s = st(); delete s.lk; s.linked = false; delete s.name; put(s); render(); toast('Concept2 disconnected');
}

/* ---------- menu card ---------- */
function cardHtml(){
  const s = st();
  if(s.linked) return '<h2>Concept2 erg</h2><p class="muted" style="font-size:14px;line-height:1.45">Connected' + (s.name ? ' as <b style="color:var(--fg)">' + esc(s.name) + '</b>' : '') + '. Workouts you row with ErgData come into History.' + (s.checked ? '<br>Last checked ' + new Date(s.checked).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) + '.' : '') + '</p>' +
    '<div class="repbtns"><button class="big" id="c2Sync">Get new workouts</button><button class="big alt" id="c2Off">Disconnect</button></div>';
  return '<h2>Concept2 erg</h2><p class="muted" style="font-size:14px;line-height:1.45">Row indoors with ErgData as usual. Connect your Concept2 Logbook once and those erg workouts appear in History, Progress and goals with your on-water rows.</p>' +
    (ready === false ? '<p class="muted" style="font-size:13px">Not switched on for this site yet.</p>' : '<button class="big" id="c2On" style="margin-top:10px">Connect Concept2</button>');
}
function render(){
  const box = $e('c2Card'); if(!box) return;
  box.innerHTML = cardHtml();
  if($e('c2On')) $e('c2On').onclick = connect;
  if($e('c2Sync')) $e('c2Sync').onclick = () => sync(true);
  if($e('c2Off')) $e('c2Off').onclick = disconnect;
}
function detailHtml(data){
  const i = data && data.indoor; if(!i) return '';
  const bits = ['Concept2 ' + (i.machine || 'RowErg')]; if(i.hr) bits.push('avg HR ' + Math.round(i.hr)); if(i.drag) bits.push('drag ' + i.drag);
  return '<div class="pausebox" id="ergBox"><b>🏋 Indoor erg</b> · ' + esc(bits.join(' · ')) + '<div class="muted" style="font-size:12px;margin-top:4px">Imported from your Concept2 Logbook. No map or weather for indoor rows.</div></div>';
}

/* ---------- start ---------- */
function boot(){
  const m = location.hash.match(/^#c2=(\w+)/);
  if(m){ history.replaceState(null, '', location.pathname); if(m[1] === 'ok') status(); else if(m[1] !== 'notset') toast('Concept2 not connected'); }
  fetch('/api/config', { cache:'no-store' }).then(r => r.json()).then(j => { ready = !!j.c2; render(); }).catch(() => {});
  const s = st();
  if(s.lk && !s.linked && s.pending && Date.now() - s.pending < 3600e3) status();
  else if(s.linked && Date.now() - (s.checked || 0) > 3600e3) setTimeout(() => sync(false), 4000);
  render();
}
// coming back from the Concept2 page (it opens over the app): check whether the link went through
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible') return; const s = st();
  if(s.lk && !s.linked && s.pending && Date.now() - s.pending < 3600e3) status();
  else if(s.linked && Date.now() - (s.checked || 0) > 3600e3) sync(false);
});
window.ERG = { sync, status, connect, disconnect, render, detailHtml, build, importOne, boot, state:st };
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
