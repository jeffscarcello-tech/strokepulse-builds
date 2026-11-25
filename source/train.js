/* StrokePulse — rowers, goals & training plans, fitness & fatigue, strength shape, stroke curve,
   where-to-improve tips, trophies, weekly challenges, leaderboard and team goals (build __BUILD__). */
'use strict';
(function(){
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const $t = id => document.getElementById(id);
const DAY = 864e5, SB = () => +S.splitBase;
const km = m => (m >= 100000 ? Math.round(m / 1000) : (m / 1000).toFixed(m >= 10000 ? 0 : 1)) + (imp() ? '' : ' km');
const kmTxt = m => imp() ? (m / 1609.344).toFixed(m >= 16093 ? 0 : 1) + ' mi' : km(m);
const sTxt = s => s == null || !isFinite(s) ? '–' : fmtTime(s, true);
const sg1 = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1);

const css = document.createElement('style');
css.textContent = `
.pchip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px 6px 6px;border-radius:999px;background:var(--panel);border:1px solid var(--line);font-weight:800;font-size:15px;color:var(--fg)}
.av{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:12px;font-weight:900;color:#000;flex:none}
.tabs{display:flex;gap:6px;padding:10px 12px 0}
.tabs button{flex:1;height:40px;border-radius:10px;background:var(--panel);font-weight:800;color:var(--dim);font-size:15px}
.tabs button.on{background:var(--acc);color:#fff}
.bignum{font-size:44px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1}
.pbar{height:10px;border-radius:5px;background:var(--line);overflow:hidden;display:flex}
.pbar > i{display:block;height:100%}
.tip{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.tip:last-child{border-bottom:0}
.tip .ic{font-size:22px;line-height:1.2;flex:none}
.tip b{display:block;margin-bottom:2px}
.tip p{color:var(--dim);font-size:14px;line-height:1.35}
.wkc{border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px}
.wkc.now{border-color:#ff9f1c}
.wkc .h{display:flex;justify-content:space-between;align-items:center}
.wkc .s{font-size:12px;letter-spacing:1px;color:var(--dim);text-transform:uppercase}
.ses{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}
.ses .dt{width:10px;height:10px;border-radius:50%;flex:none}
.ses .x{flex:1}
.ses .x small{display:block;color:var(--dim);font-size:13px;margin-top:2px}
.ses button{padding:7px 10px;border-radius:8px;background:var(--acc);color:#fff;font-weight:800;font-size:13px}
.ses.done .x{opacity:.55}
.lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--dim);margin-top:8px;letter-spacing:.5px}
.lg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}
.ach{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.ach > div{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px;position:relative}
.ach .ai{font-size:26px}
.ach .an{font-weight:800;margin-top:2px}
.ach .ad{font-size:12px;color:var(--dim);margin:2px 0 6px;min-height:30px}
.ach .tier{position:absolute;top:8px;right:8px;font-size:11px;font-weight:900;padding:2px 7px;border-radius:999px;color:#000}
.ach .locked{filter:grayscale(1);opacity:.45}
.mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 14px}
.mgrid button{min-width:0;padding:9px 4px;border-radius:10px;font-weight:800;font-size:13px;background:var(--bg);color:var(--dim);border:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mgrid button.on{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.lanes{display:flex;flex-direction:column;gap:10px}
.lane{position:relative;padding:12px 12px 12px 14px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01));border:1px solid var(--line);overflow:hidden}
.lane::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--rc)}
.lane.me{border-color:rgba(255,159,28,.55);box-shadow:0 0 0 1px rgba(255,159,28,.25),0 6px 20px rgba(255,159,28,.10)}
.lane .lh{display:flex;align-items:center;gap:10px}
.lane .rk{font-size:13px;font-weight:900;color:var(--dim);width:22px;text-align:center;flex:none;font-variant-numeric:tabular-nums}
.lane.lead .rk{color:#2ed47a}
.lane .av{width:36px;height:36px;font-size:13px;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--rc)}
.lane .who{flex:1;min-width:0}
.lane .ln{font-weight:850;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.lane .sub{font-size:12px;color:var(--dim)}
.lane .rt{text-align:right;flex:none}
.lane .lv{font-weight:900;font-size:19px;font-variant-numeric:tabular-nums;letter-spacing:-.3px;display:block}
.lane .gp{display:inline-block;margin-top:3px;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--bg);color:var(--dim);border:1px solid var(--line)}
.lane.lead .gp{background:rgba(46,212,122,.15);color:#2ed47a;border-color:rgba(46,212,122,.4)}
.lane .water{position:relative;height:38px;margin-top:10px;border-radius:12px;overflow:hidden;
  background:radial-gradient(ellipse 18px 3px at 50% 50%,rgba(255,255,255,.07),transparent) 0 0/36px 12px,linear-gradient(180deg,#123a5e,#0b2540 55%,#0d2f4d)}
.lane .water::before,.lane .marks::before{content:"";position:absolute;left:14px;right:14px;height:6px;background:radial-gradient(circle,rgba(255,255,255,.9) 1.8px,transparent 2.3px) 0 0/30px 6px;opacity:.55}
.lane .water::before{top:2px}
.lane .marks::before{bottom:2px}
.lane .water::after{content:"";position:absolute;right:0;top:0;bottom:0;width:10px;background:conic-gradient(#fff 25%,#1a1a1a 0 50%,#fff 0 75%,#1a1a1a 0) 0 0/10px 10px;opacity:.9}
.lane .marks{position:absolute;inset:0;background:linear-gradient(90deg,transparent calc(25% - 1px),rgba(255,255,255,.10) 0 calc(25% + 1px),transparent 0 calc(50% - 1px),rgba(255,255,255,.10) 0 calc(50% + 1px),transparent 0 calc(75% - 1px),rgba(255,255,255,.10) 0 calc(75% + 1px),transparent 0)}
body.glare .lane .water{background:linear-gradient(180deg,#d6ecff,#b9dbfb)}
.lane .wake{position:absolute;left:0;top:50%;height:6px;margin-top:-3px;border-radius:3px;opacity:.9}
.lane .boatp{position:absolute;top:50%;transform:translateY(-50%);transition:left .6s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.you{font-size:11px;font-weight:900;color:#ff9f1c;margin-left:6px}
.newach{background:linear-gradient(90deg,#ffd400,#ff9f1c);color:#000;border-radius:12px;padding:12px;margin-bottom:12px;font-weight:800}
.frm label{display:block;font-size:13px;color:var(--dim);margin:10px 0 4px}
.frm input,.frm select{width:100%;height:46px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:17px;padding:0 10px}
`;
document.head.appendChild(css);

/* ================= rowers (profiles on this phone) ================= */
const PCOL = ['#2f9bff', '#ff9f1c', '#2ed47a', '#e879f9', '#ffd400', '#ff6b6b', '#22d3ee', '#a78bfa'];
function profiles(){ let l = LS.get('sp_profiles', null); if(!Array.isArray(l) || !l.length){ l = [{ id:'p' + Date.now().toString(36), name:'Me', kg:+S.weightKg || 0, c:PCOL[0] }]; LS.set('sp_profiles', l); } return l; }
function cur(){ const l = profiles(), id = LS.get('sp_prof', null); return l.find(p => p.id === id) || l[0]; }
function owner(s){ const l = profiles(); return s.who && l.some(p => p.id === s.who) ? s.who : l[0].id; }
const mine = s => owner(s) === cur().id;
const sessionsOf = pid => LS.get('sp_index', []).filter(s => owner(s) === pid);
function kg(){ const w = +cur().kg || 0; return w >= 25 && w <= 250 ? w : 70; }
function setKg(v){ const l = profiles(), p = l.find(x => x.id === cur().id); p.kg = v; LS.set('sp_profiles', l); invalidate(); }
const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const avatar = (p, size) => '<span class="av" style="background:' + (p.c || PCOL[0]) + (size ? ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px' : '') + '">' + esc(initials(p.name)) + '</span>';
const chip = () => { const p = cur(); return '<button class="pchip" data-prof>' + avatar(p) + esc(p.name) + ' ▾</button>'; };
function invalidate(){ const idx = LS.get('sp_index', []); idx.forEach(s => { delete s.cv; delete s.tv; }); LS.set('sp_index', idx); }
function profileSheet(){
  if(window.run && !run.armed){ toast('Finish the session first'); return; }
  const l = profiles(), c = cur();
  openSheet('<h2 style="margin-bottom:6px">Who is rowing?</h2><p class="muted" style="margin-bottom:8px">Sessions, goals and trophies are kept for each rower on this phone.</p>' +
    l.map(p => '<button class="opt' + (p.id === c.id ? ' on' : '') + '" data-pid="' + p.id + '" style="display:flex;align-items:center;gap:10px">' + avatar(p) + esc(p.name) + (p.id === c.id ? ' ✓' : '') + '</button>').join('') +
    '<div class="frm"><label>Add a rower</label><div style="display:flex;gap:8px"><input id="pfNew" placeholder="Name" maxlength="24"><button class="big" id="pfAdd" style="width:90px;margin:0;height:46px">Add</button></div>' +
    '<label>Rename ' + esc(c.name) + '</label><div style="display:flex;gap:8px"><input id="pfRen" value="' + esc(c.name) + '" maxlength="24"><button class="big alt" id="pfRenB" style="width:90px;margin:0;height:46px">Save</button></div></div>' +
    '<button class="big alt" id="pfCrew" style="margin-top:14px">👥 Crews — join or invite</button>' +
    (l.length > 1 ? '<button class="big red" id="pfDel" style="margin-top:14px">Remove ' + esc(c.name) + '</button>' : ''),
    el => {
      el.querySelectorAll('[data-pid]').forEach(b => b.onclick = () => { LS.set('sp_prof', b.dataset.pid); closeSheet(); toast('Rowing as ' + cur().name); refresh(); });
      $t('pfAdd').onclick = () => { const n = $t('pfNew').value.trim(); if(!n) return; const L2 = profiles(); const p = { id:'p' + Date.now().toString(36), name:n, kg:0, c:PCOL[L2.length % PCOL.length] }; L2.push(p); LS.set('sp_profiles', L2); LS.set('sp_prof', p.id); closeSheet(); toast('Added ' + n + ' — now rowing as ' + n); refresh(); };
      $t('pfRenB').onclick = () => { const n = $t('pfRen').value.trim(); if(!n) return; const L2 = profiles(); L2.find(x => x.id === c.id).name = n; LS.set('sp_profiles', L2); closeSheet(); refresh(); };
      $t('pfCrew').onclick = () => { closeSheet(); setTimeout(() => crewSheet(), 50); };
      if($t('pfDel')) $t('pfDel').onclick = () => { if(!confirm('Remove ' + c.name + '? Their sessions move to ' + l.find(x => x.id !== c.id).name + '.')) return;
        const L2 = profiles().filter(x => x.id !== c.id); const to = L2[0].id; const idx = LS.get('sp_index', []); idx.forEach(s => { if(s.who === c.id) s.who = to; }); LS.set('sp_index', idx);
        LS.set('sp_profiles', L2); LS.set('sp_prof', to); closeSheet(); refresh(); };
    });
}
document.addEventListener('click', e => { if(e.target.closest('[data-prof]')) profileSheet(); });
function brand(){ const b = document.querySelector('#scr-live .status .brand'); if(!b) return; const l = profiles(); b.textContent = l.length > 1 ? cur().name.toUpperCase() : 'STROKEPULSE'; b.style.cursor = 'pointer'; b.onclick = () => profileSheet(); }
function refresh(){
  brand();
  const on = document.querySelector('.screen.on'); if(!on) return;
  if(on.id === 'scr-history') renderHistory(); else if(on.id === 'scr-progress') renderProgress(); else if(on.id === 'scr-menu') renderMenu(); else if(on.id === 'scr-settings') renderSettings();
}

/* ================= per-session numbers (cached on the History summary) ================= */
const DURS = [15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
const DLAB = ['15s', '30s', '1m', '2m', '3m', '5m', '10m', '15m', '20m', '30m', '45m', '1h'];
function bestOver(runs, D){
  let best = 0;
  for(const r of runs){ let i = 0; for(let j = 0; j < r.length; j++){ while(i < j && r[j][0] - r[i + 1][0] >= D) i++; const dt = r[j][0] - r[i][0]; if(dt >= D){ const v = (r[j][3] - r[i][3]) / dt; if(v > best && v < 8) best = v; } } }
  return best || null;
}
function sessionLoad(smp){ let L = 0; for(let i = 1; i < smp.length; i++){ const dt = Math.max(0, Math.min(5, smp[i][0] - smp[i - 1][0])), m = ANA.met(smp[i][5], smp[i][4]); L += dt * (m / 11) * (m / 11) / 36; } return L; }
function ensure(){
  ANA.ensureCache();
  const idx = LS.get('sp_index', []); let ch = false;
  for(const s of idx){
    if(s.tv === 1) continue;
    const data = LS.get('sp_s_' + s.id, null); if(!data) continue;
    const smp = data.samples || [], runs = ANA.workRuns(smp), bd = {};
    DURS.forEach(D => { const v = bestOver(runs, D); if(v) bd[D] = +v.toFixed(3); });
    const P = ANA.pieces(data), st = ANA.steadiness(data);
    s.bd = bd; s.load = Math.round(sessionLoad(smp)); s.st = Math.max(st ? st.score : 0, ...P.map(p => p.steady || 0));
    s.neg = P.filter(p => p.h1 && p.h2 && p.h2 < p.h1 - 1).length;
    s.wx = data.weather ? { ws:data.weather.ws, t:data.weather.t } : null; s.tv = 1; ch = true;
  }
  if(ch) LS.set('sp_index', idx);
  return idx;
}
const dayKey = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function weekStart(t){ const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
const thisWeek = () => weekStart(Date.now());
const inRange = (s, a, b) => s.start >= a && s.start < b;

/* ================= stroke curve (boat acceleration through one stroke) ================= */
const CN = 40;
const MODEL = Array.from({ length:CN }, (_, i) => { const x = i / CN;
  if(x < 0.08) return -0.9 + (x / 0.08) * 0.9;                 // coming out of the catch
  if(x < 0.42) return Math.sin((x - 0.08) / 0.34 * Math.PI);   // drive
  if(x < 0.55) return 0.15 * Math.sin((x - 0.42) / 0.13 * Math.PI);
  return -0.15 - 0.75 * Math.pow((x - 0.55) / 0.45, 2); });     // recovery, slowing into the next catch
function corr(a, b){ const n = a.length; let ma = 0, mb = 0; for(let i = 0; i < n; i++){ ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let x = 0, y = 0, z = 0; for(let i = 0; i < n; i++){ x += (a[i] - ma) * (b[i] - mb); y += (a[i] - ma) ** 2; z += (b[i] - mb) ** 2; } return y && z ? x / Math.sqrt(y * z) : 0; }
/* the phone can be mounted any way round, so try both signs and every starting point */
function align(a){ let best = { r:-2, c:a }; for(const sgn of [1, -1]) for(let k = 0; k < CN; k++){ const c = a.map((_, i) => sgn * a[(i + k) % CN]); const r = corr(c, MODEL); if(r > best.r) best = { r, c }; } return best; }
function curveStats(a){
  const A = align(a), c = A.c, mx = Math.max(...c), mn = Math.min(...c), range = mx - mn || 1;
  let rough = 0; for(let i = 1; i < CN - 1; i++) rough += Math.abs(c[i + 1] - 2 * c[i] + c[i - 1]); rough /= (CN - 2) * range;
  return { c, match:Math.max(0, Math.round(A.r * 100)), smooth:Math.max(0, Math.min(10, 10 - rough * 60)), peak:Math.round(c.indexOf(mx) / CN * 100), check:mx > 0 ? -mn / mx : 0, mx, mn };
}
function drawCurve(cv, curves, labels){
  const [x, w, h] = canvasFit2(cv), L = 10, R = w - 10, T = 14, B = h - 22;
  const all = curves.flatMap(c => c.c.map(v => v / (c.mx || 1))).concat(MODEL); const mn = Math.min(...all), mx = Math.max(...all);
  const X = i => L + (R - L) * i / (CN - 1), Y = v => T + (B - T) * (1 - (v - mn) / (mx - mn || 1));
  x.strokeStyle = cssVar('--line'); x.lineWidth = 1; x.setLineDash([3, 4]); [0, .25, .5, .75, 1].forEach(f => { x.beginPath(); x.moveTo(L + (R - L) * f, T); x.lineTo(L + (R - L) * f, B); x.stroke(); });
  x.setLineDash([]); x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(R, Y(0)); x.stroke();
  x.fillStyle = cssVar('--dim'); x.font = '11px -apple-system,sans-serif'; x.textAlign = 'center'; ['catch', '25%', '50%', '75%', 'catch'].forEach((t, i) => { x.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center'; x.fillText(t, L + (R - L) * i / 4, h - 6); }); x.textAlign = 'center';
  x.strokeStyle = '#ff9f1c'; x.setLineDash([6, 5]); x.lineWidth = 2; x.beginPath(); MODEL.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v))); x.stroke(); x.setLineDash([]);
  curves.forEach((c, k) => { x.strokeStyle = k ? 'rgba(160,170,180,.5)' : cssVar('--fg'); x.lineWidth = k ? 1.5 : 3; x.beginPath(); c.c.forEach((v, i) => { const y = Y(v / (c.mx || 1)); i ? x.lineTo(X(i), y) : x.moveTo(X(i), y); }); x.stroke(); });
  const p = curves[0]; if(p){ const i = p.c.indexOf(p.mx); x.strokeStyle = cssVar('--fg'); x.lineWidth = 1.5; x.beginPath(); x.moveTo(X(i), T); x.lineTo(X(i), B); x.stroke(); x.fillStyle = cssVar('--fg'); x.font = 'bold 11px -apple-system,sans-serif'; x.fillText('PEAK ' + p.peak + '%', Math.min(R - 30, Math.max(L + 30, X(i))), T - 2); }
}
function canvasFit2(c){ const r = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; if(c.width !== Math.round(w * r) || c.height !== Math.round(h * r)){ c.width = Math.round(w * r); c.height = Math.round(h * r); } const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h); return [x, w, h]; }
function curveCardHtml(title, st, note){
  return '<div class="card"><h2>' + title + '</h2><div class="grid3">' + stat('Match', st.match + '<span class="muted" style="font-size:13px"> %</span>') + stat('Smoothness', st.smooth.toFixed(1) + '<span class="muted" style="font-size:13px"> /10</span>') + stat('Peak at', st.peak + '<span class="muted" style="font-size:13px"> %</span>') + '</div>' +
    '<canvas class="crv" style="width:100%;height:190px;display:block;margin-top:10px"></canvas>' +
    '<div class="lg"><span><i style="background:var(--fg)"></i>Your boat</span><span><i style="background:#ff9f1c"></i>Model stroke</span></div>' +
    '<p class="muted" style="margin-top:8px;font-size:13px">How the boat speeds up and slows down through one stroke, catch to catch, from the phone’s motion sensor (not oar force). ' + (note || '') + ' A deep dip at the catch means check; a bumpy line means the crew isn’t moving together.</p></div>';
}

/* ================= where to improve (after each session) ================= */
function improve(sm, data){
  const smp = data.samples || [], tips = [], good = [];
  const P = ANA.pieces(data).filter(p => !p.partial && p.split), st = ANA.steadiness(data), C = ANA.rateCurve([smp]);
  if(P.length >= 2){ const f = P[P.length - 1].split - P[0].split, avg = P.reduce((a, p) => a + p.split, 0) / P.length;
    if(f > 2) tips.push(['📉', 'Pieces faded ' + f.toFixed(1) + ' s', 'Piece 1 was ' + sTxt(P[0].split) + ', the last ' + sTxt(P[P.length - 1].split) + '. Start the first piece near ' + sTxt(avg) + ' so every piece can match it.']);
    else if(f < -1) good.push(['💪', 'Got faster through the pieces', 'The last piece was ' + (-f).toFixed(1) + ' s quicker than the first.']);
    else good.push(['✅', 'Held pace across pieces', 'First to last within ' + Math.abs(f).toFixed(1) + ' s.']); }
  const fades = P.filter(p => p.h1 && p.h2).map(p => p.h2 - p.h1);
  if(fades.length){ const m = fades.reduce((a, b) => a + b, 0) / fades.length;
    if(m > 1.5) tips.push(['⏱', 'Second halves ' + m.toFixed(1) + ' s slower', 'Practise negative splits: first half 1 s slower than target, then build every 250 m.']);
    else if(m < -0.5) good.push(['🚀', 'Negative splits', 'Second halves were ' + (-m).toFixed(1) + ' s faster on average.']); }
  if(C.slope != null && C.hi - C.lo >= 4){
    const lo = C.pts.slice(0, 2), hi = C.pts.slice(-2), dl = lo.reduce((a, p) => a + p.dps, 0) / lo.length, dh = hi.reduce((a, p) => a + p.dps, 0) / hi.length, drop = (1 - dh / dl) * 100;
    if(C.slope > -0.5) tips.push(['📏', 'Extra rate isn’t buying speed', 'Going from ' + C.lo + ' to ' + C.hi + ' spm gained only ' + Math.max(0, -C.slope).toFixed(1) + ' s per stroke. Try rate ladders (20-24-28) holding the same run per stroke at each step.']);
    else if(drop > 15) tips.push(['📏', 'Length drops ' + Math.round(drop) + '% at high rate', 'Distance per stroke falls from ' + dl.toFixed(1) + ' m to ' + dh.toFixed(1) + ' m. Keep the reach and the finish long as the rate climbs.']); }
  if(st){ if(st.score < 60) tips.push(['🎯', 'Uneven pace (consistency ' + st.score + ')', 'Split swung ±' + st.sdS.toFixed(1) + ' s' + (st.sdR > 1.2 ? ' and rate ±' + st.sdR.toFixed(1) + ' spm' : '') + '. Aim for the same pressure every stroke; the rate beeper helps hold rhythm.']);
    else if(st.score >= 80) good.push(['🎯', 'Very steady (' + st.score + ')', 'Split stayed within ±' + st.sdS.toFixed(1) + ' s.']); }
  // slow to get going
  const ups = []; for(const [a, b] of pieceRanges(data)){ const w = smp.filter(z => z[0] >= a && z[0] <= b && !z[7]); if(w.length < 40) continue; const avg = w.reduce((s, z) => s + z[4], 0) / w.length; const k = w.findIndex(z => z[4] >= avg * 0.95); if(k >= 0) ups.push(w[k][0] - a); }
  if(ups.length){ const m = ups.reduce((a, b) => a + b, 0) / ups.length; if(m > 25) tips.push(['🏁', 'Slow to get up to speed (' + Math.round(m) + ' s)', 'Practise starts: 3 × (¾, ½, ¾, full, full) then 10 high strokes, settling into pace by 15 strokes.']); }
  if(data.curve && data.curve.n >= 30){ const cs = curveStats(data.curve.a); if(cs.check > 1.1) tips.push(['🛶', 'Big check at the catch', 'The boat slows hard at each catch. Slow the slide into the catch and let the boat run under you.']); if(cs.smooth < 6) tips.push(['〰️', 'Rough stroke curve (' + cs.smooth.toFixed(1) + '/10)', 'The boat surges unevenly — usually timing. Pause drills and square-blade rowing help the crew move together.']); }
  const G = goalOf(cur().id).race; if(G){ const gs = SB() * G.time / G.dist, best = P.length ? Math.min(...P.map(p => p.split)) : null; if(best) (best <= gs ? good : tips).push(['🏆', 'Goal pace ' + sTxt(gs), best <= gs ? 'Your best piece (' + sTxt(best) + ') was at or under goal pace.' : 'Your best piece was ' + sTxt(best) + ' — ' + (best - gs).toFixed(1) + ' s off goal pace.']); }
  if(data.weather){ const wt = ANA.windText(data.weather, smp); if(/headwind/.test(wt)) tips.push(['💨', wt, 'Splits are slower into a headwind — compare with calm days carefully.']); }
  return { tips:tips.slice(0, 4), good:good.slice(0, 2) };
}
function pieceRanges(data){ const w = (data.laps || []).filter(l => l.type === 'work'); if(w.length) return w.map(l => [l.at - l.t, l.at]); const smp = data.samples || []; return smp.length ? [[smp[0][0], smp[smp.length - 1][0]]] : []; }
function improveHtml(sm, data){
  const I = improve(sm, data); const row = t => '<div class="tip"><span class="ic">' + t[0] + '</span><div><b>' + esc(t[1]) + '</b><p>' + esc(t[2]) + '</p></div></div>';
  return '<div class="card"><h2>Where to improve</h2>' + (I.tips.length ? I.tips.map(row).join('') : '<p class="muted">Nothing stands out — a solid session.</p>') + (I.good.length ? '<h2 style="margin-top:14px">What went well</h2>' + I.good.map(row).join('') : '') + '</div>';
}

/* ================= goals & training plans ================= */
const goalOf = pid => LS.get('sp_goal_' + pid, {});
const setGoal = (pid, g) => LS.set('sp_goal_' + pid, g);
const TYPES = { rec:{ c:'#2ed47a', l:'Recovery' }, ss:{ c:'#22c3ee', l:'Steady state' }, int:{ c:'#ff9f1c', l:'Interval' }, race:{ c:'#ff4d6d', l:'Race piece' } };
/* predicted time for distance D from the rower's bests (Paul's law: +5 s/500 m per doubling of distance) */
function predict(L, D){
  let best = null, from = '';
  for(const [k, d] of [['b500', 500], ['b1k', 1000], ['b2k', 2000]]){ const v = Math.min(...L.map(s => s[k] || Infinity)); if(!isFinite(v)) continue; const sp = 500 * v / d + 5 * Math.log2(D / d), t = sp * D / 500; if(best == null || t < best){ best = t; from = d; } }
  return best == null ? null : { t:best, from };
}
function recentWeekly(L){ const w0 = thisWeek(), a = L.filter(s => inRange(s, w0 - 28 * DAY, w0)); return { m:a.reduce((x, s) => x + s.dist, 0) / 4, n:a.length / 4 }; }
function makePlan(g, L){
  const r = g.race, gs = SB() * r.time / r.dist, days = Math.max(3, Math.min(7, +r.days || 5));
  const w0 = thisWeek(), wEnd = weekStart(new Date(r.by + 'T12:00').getTime()); let nW = Math.round((wEnd - w0) / (7 * DAY)) + 1; nW = Math.max(1, Math.min(16, nW));
  const base = Math.max(recentWeekly(L).m, days * 4500) * Math.max(0.7, Math.min(1.3, +r.adj || 1));
  const R = (a, b) => 'rate ' + a + '–' + b;
  const T = {
    rec:() => ({ t:'rec', n:'Recovery row', d:'30 min easy, ' + R(16, 18) + ', split around ' + sTxt(gs + 30), m:5000 }),
    ss:m => ({ t:'ss', n:'Steady state ' + kmTxt(m), d:R(18, 22) + ', split ' + sTxt(gs + 18) + '–' + sTxt(gs + 22) + '. Long and relaxed.', m }),
    int:k => [
      { t:'int', n:'4 × 1000 m', d:'At ' + sTxt(gs + 4) + ', ' + R(26, 28) + ', 3 min rest', m:7000, wk:{ mode:'intervals', type:'dist', val:1000, reps:4, rest:180, tr:[26, 28], ts:[gs + 2, gs + 6] } },
      { t:'int', n:'8 × 500 m', d:'At ' + sTxt(gs + 1) + ', ' + R(28, 30) + ', 2 min rest', m:7000, wk:{ mode:'intervals', type:'dist', val:500, reps:8, rest:120, tr:[28, 30], ts:[gs - 1, gs + 3] } },
      { t:'int', n:'3 × 2000 m', d:'At ' + sTxt(gs + 7) + ', ' + R(24, 26) + ', 4 min rest', m:9000, wk:{ mode:'intervals', type:'dist', val:2000, reps:3, rest:240, tr:[24, 26], ts:[gs + 5, gs + 9] } },
      { t:'int', n:'5 × 4 min', d:'At ' + sTxt(gs + 5) + ', ' + R(24, 26) + ', 2 min rest', m:8000, wk:{ mode:'intervals', type:'time', val:240, reps:5, rest:120, tr:[24, 26], ts:[gs + 3, gs + 7] } }][k % 4],
    race:k => [
      { t:'race', n:'3 × 750 m race pace', d:'At goal pace ' + sTxt(gs) + ', ' + R(32, 34) + ', 5 min rest', m:5300, wk:{ mode:'intervals', type:'dist', val:750, reps:3, rest:300, tr:[32, 34], ts:[gs - 1, gs + 1] } },
      { t:'race', n:'6 × 1 min on', d:'At ' + sTxt(gs - 3) + ', ' + R(34, 36) + ', 1 min easy between', m:5000, wk:{ mode:'intervals', type:'time', val:60, reps:6, rest:60, tr:[34, 36], ts:[gs - 5, gs - 1] } },
      { t:'race', n:'2 × 1000 m race pace', d:'At ' + sTxt(gs - 1) + ', ' + R(31, 33) + ', 6 min rest', m:5000, wk:{ mode:'intervals', type:'dist', val:1000, reps:2, rest:360, tr:[31, 33], ts:[gs - 2, gs] } }][k % 3]
  };
  const ORDER = { 3:['ss', 'int', 'race'], 4:['ss', 'int', 'rec', 'race'], 5:['ss', 'int', 'rec', 'ss', 'race'], 6:['ss', 'int', 'rec', 'ss', 'int', 'race'], 7:['ss', 'int', 'rec', 'ss', 'int', 'rec', 'race'] };
  const weeks = [];
  for(let i = 0; i < nW; i++){
    const last = i === nW - 1 && nW > 1, deload = !last && nW > 3 && i % 4 === 3, pre = i === nW - 2 && nW > 2;
    const mult = last ? 0.6 : deload ? 0.8 : pre ? 0.9 : Math.min(1.35, 1 + 0.07 * (i - Math.floor(i / 4)));
    const target = base * mult; let ses;
    if(last){ ses = [T.rec(), T.ss(6000), T.race(0)]; ses = ses.slice(0, Math.max(1, days - 1)); ses.push({ t:'race', n:'Goal test: ' + fmtDist(r.dist) + distUnit(r.dist), d:'Race it. Target ' + fmtTime(r.time) + ' (' + sTxt(gs) + ').', m:r.dist + 3000, wk:{ mode:'intervals', type:'dist', val:r.dist, reps:1, rest:0, tr:[30, 36], ts:[gs - 1, gs + 1] } }); }
    else {
      let ni = 0; ses = ORDER[days].map(t => t === 'int' ? T.int(i * 2 + ni++) : t === 'race' ? T.race(i) : t === 'rec' ? T.rec() : null);
      const fixed = ses.filter(Boolean).reduce((a, s) => a + s.m, 0), nss = ses.filter(s => !s).length;
      const each = Math.max(6000, Math.min(18000, Math.round((target - fixed) / Math.max(1, nss) / 500) * 500));
      ses = ses.map(s => s || T.ss(each));
      // weekly check-ins can tilt the mix: more speed work, or more long steady rows
      if(r.focus === 'speed' && !last && !deload){ const k = ses.map(x => x.t).lastIndexOf('ss'); if(k > 0 && ses.filter(x => x.t === 'ss').length > 1) ses[k] = Object.assign(T.race(i + 1), { n:T.race(i + 1).n + ' (extra speed)' }); }
      if(r.focus === 'endurance' && !last && !deload){ const k = ses.map(x => x.t).lastIndexOf('int'); if(k >= 0 && ses.filter(x => x.t === 'int').length > 1) ses[k] = T.ss(Math.min(18000, each + 2000)); else { const j = ses.findIndex(x => x.t === 'ss'); if(j >= 0) ses[j] = T.ss(Math.min(20000, each + 3000)); } }
    }
    const m = ses.reduce((a, s) => a + s.m, 0);
    weeks.push({ i, start:w0 + i * 7 * DAY, label:last ? 'Race week' : deload ? 'Lighter week' : i < nW / 2 ? 'Base' : 'Build', ses, m });
  }
  return { weeks, gs, days };
}
function goalAdvice(L, g){
  const out = [], r = g.race; if(!r) return out;
  const gs = SB() * r.time / r.dist, pr = predict(L, r.dist), weeks = Math.max(1, Math.round((new Date(r.by + 'T12:00') - Date.now()) / (7 * DAY)));
  if(pr){ const gap = (pr.t - r.time) * SB() / r.dist;
    if(gap <= 0) out.push(['🎉', 'You’re already on pace', 'Your bests predict ' + fmtTime(pr.t) + '. Consider a tougher target.']);
    else { const pw = gap / weeks; out.push([pw > 1 ? '⚠️' : '📆', 'Need ' + gap.toFixed(1) + ' s' + splitLabel() + ' in ' + weeks + ' week' + (weeks > 1 ? 's' : ''), 'That’s ' + pw.toFixed(1) + ' s per week. ' + (pw > 1 ? 'Ambitious — most crews gain under 1 s a week. A later date or ' + fmtTime(pr.t - weeks * r.dist / SB()) + ' is more realistic.' : 'Achievable with consistent training.')]); } }
  else out.push(['📈', 'Row a few hard pieces', 'Once you have a best 500 m or 1 km, StrokePulse can predict your ' + fmtDist(r.dist) + distUnit(r.dist) + ' time.']);
  const sh = shape(L);
  if(sh.short != null && sh.long != null){
    if(sh.long - sh.short > 0.03) out.push(['🫁', 'Endurance is your limiter', 'Your long efforts are weaker than your sprints. Make 60–70% of your metres steady state at ' + R2(18, 22) + '.']);
    else if(sh.short - sh.long > 0.03) out.push(['⚡', 'Top speed is your limiter', 'Your endurance is strong for your speed. Add race-pace work and 1-minute pieces at rate 34+.']); }
  const C = ANA.rateCurve(L.slice(0, 20).map(s => (LS.get('sp_s_' + s.id, null) || {}).samples).filter(Boolean));
  if(C.slope != null && C.hi - C.lo >= 4 && C.slope > -0.6) out.push(['📏', 'Rate isn’t turning into speed', 'Practise rate ladders, keeping the same run per stroke as the rate climbs.']);
  const rw = recentWeekly(L); if(rw.n + 0.5 < (+r.days || 5)) out.push(['🗓', 'Train more often', 'You’ve averaged ' + rw.n.toFixed(1) + ' sessions a week lately; the plan needs ' + r.days + '.']);
  const F = fitness(L); if(F.form < -25) out.push(['😴', 'You’re carrying fatigue', 'Form is ' + Math.round(F.form) + '. Take an easy day before the next hard session.']);
  return out;
}
const R2 = (a, b) => 'rate ' + a + '–' + b;

/* ================= fitness & fatigue ================= */
function fitness(L){
  const loads = {}; for(const s of L){ const k = dayKey(s.start); loads[k] = (loads[k] || 0) + (s.load || 0); }
  if(!L.length) return { days:[], ctl:0, atl:0, form:0 };
  const first = new Date(Math.min(...L.map(s => s.start))); first.setHours(12, 0, 0, 0);
  const days = []; let ctl = 0, atl = 0;
  for(let t = first.getTime(); t <= Date.now() + 1000; t += DAY){ const l = loads[dayKey(t)] || 0; ctl += (l - ctl) / 42; atl += (l - atl) / 7; days.push({ t, l, ctl, atl }); }
  return { days, ctl, atl, form:ctl - atl };
}
function formWord(f){ return f > 5 ? ['Fresh', 'Good day for a test or race.'] : f > -10 ? ['Balanced', 'Ready for normal training.'] : f > -30 ? ['Building', 'Productive training — fitness is growing.'] : ['Overreaching', 'Plan an easy day or two.']; }

/* ================= strength shape ================= */
function shape(L){
  const best = {}; for(const s of L) for(const [d, v] of Object.entries(s.bd || {})) if(!best[d] || v > best[d]) best[d] = v;
  const eq = {}; for(const D of DURS){ const v = best[D]; if(!v) continue; const dist = v * D; eq[D] = SB() / v + 5 * Math.log2(2000 / dist) * (SB() / 500); }
  const vals = Object.values(eq); const top = vals.length ? Math.min(...vals) : null; const rel = {}; for(const D of DURS) if(eq[D]) rel[D] = top / eq[D];
  const avg = ks => { const a = ks.map(k => rel[k]).filter(Boolean); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const sAvg = avg([15, 30, 60, 120]), lAvg = avg([600, 900, 1200, 1800, 2700, 3600]);
  return { best, rel, short:sAvg == null ? null : 1 - sAvg, long:lAvg == null ? null : 1 - lAvg };
}
function drawRadar(cv, sh){
  const [x, w, h] = canvasFit2(cv), cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 34, n = DURS.length;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n, rad = D => sh.rel[D] ? Math.max(0.08, Math.min(1, (sh.rel[D] - 0.85) / 0.15)) : 0;
  x.strokeStyle = cssVar('--line'); x.lineWidth = 1; for(const f of [0.33, 0.66, 1]){ x.beginPath(); x.arc(cx, cy, R * f, 0, 7); x.stroke(); }
  x.fillStyle = cssVar('--dim'); x.font = '11px -apple-system,sans-serif'; x.textAlign = 'center';
  DURS.forEach((D, i) => { const a = ang(i); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); x.fillText(DLAB[i], cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18) + 4); });
  const pts = DURS.map((D, i) => [cx + Math.cos(ang(i)) * R * rad(D), cy + Math.sin(ang(i)) * R * rad(D), D]).filter(p => sh.rel[p[2]]);
  if(pts.length >= 3){
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(47,155,255,.55)'); g.addColorStop(0.6, 'rgba(46,212,122,.35)'); g.addColorStop(1, 'rgba(255,159,28,.45)');
    x.fillStyle = g; x.strokeStyle = '#ffb020'; x.lineWidth = 2; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill(); x.stroke(); }
  pts.forEach(p => { const r = sh.rel[p[2]]; x.fillStyle = r > 0.97 ? '#2ed47a' : r > 0.92 ? '#ffd400' : '#ff6b6b'; x.beginPath(); x.arc(p[0], p[1], 4, 0, 7); x.fill(); });
}

/* ================= trophies ================= */
const TIER = [['Bronze', '#d08b4f'], ['Silver', '#c0c8d0'], ['Gold', '#ffd400'], ['Platinum', '#9ee7ff'], ['Diamond', '#b98bff'], ['Legend', '#ff6b6b']];
function streakDays(L){ const ks = [...new Set(L.map(s => { const d = new Date(s.start); d.setHours(12, 0, 0, 0); return d.getTime(); }))].sort((a, b) => a - b); let best = 0, run = 0, prev = 0; for(const k of ks){ run = prev && Math.round((k - prev) / DAY) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; } return best; }
function weekMap(L){ const m = {}; for(const s of L){ const w = weekStart(s.start); const o = m[w] || (m[w] = { m:0, n:0 }); o.m += s.dist; o.n++; } return m; }
function streakWeeks(L){ const m = weekMap(L), ws = Object.keys(m).map(Number).sort((a, b) => a - b); let best = 0, run = 0, prev = 0; for(const w of ws){ if(m[w].n < 3){ run = 0; prev = w; continue; } run = prev && Math.round((w - prev) / (7 * DAY)) === 1 && run ? run + 1 : 1; best = Math.max(best, run); prev = w; } return best; }
function pbCount(L){ let n = 0; const b = {}; for(const s of L.slice().sort((a, c) => a.start - c.start)) for(const k of ['b500', 'b1k', 'b2k']) if(s[k]){ if(b[k] && s[k] < b[k]) n++; if(!b[k] || s[k] < b[k]) b[k] = s[k]; } return n; }
function improveSec(L){ const o = L.slice().sort((a, c) => a.start - c.start).filter(s => s.b500); if(o.length < 3) return 0; const first = Math.min(...o.slice(0, 3).map(s => s.b500)), best = Math.min(...o.map(s => s.b500)); return Math.max(0, first - best); }
const ACH = [
  { k:'total', ic:'🌊', n:'Distance club', d:t => 'Row ' + kmTxt(t) + ' in total', tiers:[10000, 50000, 100000, 250000, 500000, 1000000], v:L => L.reduce((a, s) => a + s.dist, 0), f:kmTxt },
  { k:'long', ic:'🛶', n:'Long haul', d:t => 'One session of ' + kmTxt(t), tiers:[5000, 10000, 15000, 21097], v:L => Math.max(0, ...L.map(s => s.dist)), f:kmTxt },
  { k:'count', ic:'📅', n:'Regular', d:t => t + ' sessions', tiers:[5, 10, 25, 50, 100, 200], v:L => L.length },
  { k:'b500', ic:'⚡', n:'500 m speed', d:t => 'Best 500 m under ' + fmtTime(t), tiers:[150, 135, 120, 110, 100, 95], low:true, v:L => Math.min(...L.map(s => s.b500 || Infinity)), f:v => isFinite(v) ? fmtTime(v, true) : '–' },
  { k:'b2k', ic:'🏁', n:'2k', d:t => '2,000 m under ' + fmtTime(t), tiers:[540, 480, 450, 420, 400, 380], low:true, v:L => Math.min(...L.map(s => s.b2k || Infinity)), f:v => isFinite(v) ? fmtTime(v, true) : '–' },
  { k:'streak', ic:'🔥', n:'Day streak', d:t => t + ' days in a row', tiers:[3, 5, 7, 10, 14], v:streakDays },
  { k:'weeks', ic:'🗓', n:'Committed', d:t => t + ' weeks in a row with 3+ sessions', tiers:[2, 4, 8, 12, 20], v:streakWeeks },
  { k:'week', ic:'📈', n:'Big week', d:t => kmTxt(t) + ' in one week', tiers:[20000, 40000, 60000, 80000, 100000], v:L => Math.max(0, ...Object.values(weekMap(L)).map(w => w.m)), f:kmTxt },
  { k:'steady', ic:'🎯', n:'Rock steady', d:t => 'Consistency ' + t + '+ in a piece', tiers:[70, 80, 88, 94], v:L => Math.max(0, ...L.map(s => s.st || 0)) },
  { k:'neg', ic:'🚀', n:'Negative split', d:t => t + ' pieces with a faster second half', tiers:[1, 5, 15, 40], v:L => L.reduce((a, s) => a + (s.neg || 0), 0) },
  { k:'pb', ic:'🏆', n:'PB breaker', d:t => 'Beat a personal best ' + t + ' times', tiers:[1, 5, 10, 25], v:pbCount },
  { k:'improve', ic:'📉', n:'Getting faster', d:t => 'Best 500 m ' + t + ' s faster than your first sessions', tiers:[2, 5, 10, 15, 20], v:improveSec, f:v => v.toFixed(1) + ' s' },
  { k:'intervals', ic:'⏱', n:'Interval grinder', d:t => t + ' interval sessions', tiers:[5, 15, 40, 100], v:L => L.filter(s => s.mode === 'intervals').length },
  { k:'early', ic:'🌅', n:'Dawn patrol', d:t => t + ' sessions started 4–7 am', tiers:[1, 5, 20, 50], v:L => L.filter(s => { const h = new Date(s.start).getHours(); return h >= 4 && h < 7; }).length },
  { k:'wx', ic:'💨', n:'All-weather', d:t => t + ' sessions in wind 20+ km/h or under 5 °C', tiers:[1, 5, 15], v:L => L.filter(s => s.wx && (s.wx.ws >= 20 || s.wx.t <= 5)).length },
  { k:'cal', ic:'🍝', n:'Fuel burner', d:t => Math.round(t).toLocaleString() + ' kcal in total', tiers:[2000, 10000, 25000, 50000, 100000], v:L => L.reduce((a, s) => a + (s.kcal || 0), 0), f:v => Math.round(v).toLocaleString() + ' kcal' }
];
function achieve(L){ return ACH.map(a => { const v = a.v(L); let t = -1; a.tiers.forEach((x, i) => { if(a.low ? v <= x : v >= x) t = i; }); const next = a.tiers[t + 1]; let p = 1; if(next != null){ const prev = t >= 0 ? a.tiers[t] : (a.low ? next * 1.25 : 0); p = a.low ? (isFinite(v) ? Math.max(0, Math.min(1, (prev - v) / (prev - next))) : 0) : Math.max(0, Math.min(1, (v - prev) / (next - prev))); } return { a, v, t, next, p }; }); }
function afterSave(id){
  ensure(); const pid = cur().id, L = sessionsOf(pid), R = achieve(L), seen = LS.get('sp_ach_' + pid, {}), got = [];
  for(const r of R) if(r.t >= 0 && (seen[r.a.k] == null || seen[r.a.k] < r.t)){ got.push(r); seen[r.a.k] = r.t; }
  LS.set('sp_ach_' + pid, seen);
  setTimeout(() => pushCrews(pid), 1500);
  if(got.length){ LS.set('sp_newach', { id, list:got.map(r => r.a.ic + ' ' + r.a.n + ' — ' + TIER[r.t][0]) }); toast('🏅 New trophy: ' + got[0].a.n); }
}

/* ================= weekly challenges ================= */
function challenges(L){
  const w0 = thisWeek(), now = L.filter(s => s.start >= w0), prev = L.filter(s => inRange(s, w0 - 28 * DAY, w0)), rw = recentWeekly(L);
  const out = [];
  const vT = Math.max(10000, Math.round(rw.m * 1.1 / 1000) * 1000), vN = now.reduce((a, s) => a + s.dist, 0);
  out.push({ ic:'📈', n:'Row ' + kmTxt(vT), d:'10% more than your recent weekly average', p:vN / vT, v:kmTxt(vN) + ' / ' + kmTxt(vT) });
  const nT = Math.max(3, Math.min(6, Math.round(rw.n) + 1)); out.push({ ic:'📅', n:nT + ' sessions', d:'One more than your usual week', p:now.length / nT, v:now.length + ' / ' + nT });
  const b30 = Math.min(...L.filter(s => s.start >= Date.now() - 30 * DAY && s.start < w0).map(s => s.b500 || Infinity)), bNow = Math.min(...now.map(s => s.b500 || Infinity));
  if(isFinite(b30)) out.push({ ic:'⚡', n:'500 m within 2 s of ' + sTxt(b30), d:'Your best from the last month', p:isFinite(bNow) ? (bNow <= b30 + 2 ? 1 : Math.max(0, 1 - (bNow - b30 - 2) / 10)) : 0, v:isFinite(bNow) ? 'best ' + sTxt(bNow) : 'not yet' });
  const stT = Math.min(90, Math.max(70, Math.max(0, ...prev.map(s => s.st || 0)) + 3)), stN = Math.max(0, ...now.map(s => s.st || 0));
  out.push({ ic:'🎯', n:'Consistency ' + stT + '+', d:'Hold one piece or stretch this steady', p:stN / stT, v:stN ? 'best ' + stN : 'not yet' });
  const avgD = L.length ? L.slice(0, 20).reduce((a, s) => a + s.dist, 0) / Math.min(20, L.length) : 6000, lT = Math.round(avgD * 1.3 / 500) * 500, lN = Math.max(0, ...now.map(s => s.dist));
  out.push({ ic:'🛶', n:'One row of ' + kmTxt(lT), d:'30% longer than your usual session', p:lN / lT, v:lN ? 'longest ' + kmTxt(lN) : 'not yet' });
  return out.map(c => Object.assign(c, { p:Math.max(0, Math.min(1, c.p || 0)) }));
}
const pbarHtml = (p, c) => '<div class="pbar"><i style="width:' + Math.round(p * 100) + '%;background:' + (c || (p >= 1 ? 'var(--good)' : 'var(--acc)')) + '"></i></div>';

/* ================= leaderboard & team goals (rowers on this phone; crews online come next) ================= */
const BOARDS = [
  ['m', 'Metres', L => L.reduce((a, s) => a + s.dist, 0), kmTxt],
  ['n', 'Sessions', L => L.length, v => String(v)],
  ['d', 'Active days', L => new Set(L.map(s => dayKey(s.start))).size, v => String(v)],
  ['h', 'Hours', L => L.reduce((a, s) => a + s.time, 0) / 3600, v => v.toFixed(1) + ' h'],
  ['b5', 'Best 500 m', L => Math.min(...L.map(s => s.b500 || Infinity)), sTxt, true],
  ['b2', 'Best 2k', L => Math.min(...L.map(s => s.b2k || Infinity)), sTxt, true],
  ['k', 'Calories', L => L.reduce((a, s) => a + (s.kcal || 0), 0), v => Math.round(v).toLocaleString()],
  ['st', 'Consistency', L => Math.max(0, ...L.map(s => s.st || 0)), v => v ? String(v) : '–'],
  ['im', 'Most improved', L => { const o = L.filter(s => s.b500).sort((a, b) => a.start - b.start); return o.length >= 2 ? o[0].b500 - Math.min(...o.map(s => s.b500)) : 0; }, v => v ? '−' + v.toFixed(1) + ' s' : '–']
];
const JOURNEY = [[42195, 'Marathon'], [100000, 'Century'], [200000, '200 km'], [416000, 'Length of Lake Winnipeg'], [1000000, '1,000 km'], [2500000, '2,500 km'], [5000000, '5,000 km']];
function rows(period, all){
  const now = Date.now(), from = period === 'w' ? thisWeek() : period === 'm' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : 0;
  return profiles().map(p => ({ p, L:all.filter(s => owner(s) === p.id && s.start >= from && s.start <= now) }));
}


/* ================= crews (online): invite code → shared boards and team goals across phones ================= */
const crewsOf = p => (p.crews || []);
function saveProfile(p){ const l = profiles(); const i = l.findIndex(x => x.id === p.id); if(i >= 0){ l[i] = p; LS.set('sp_profiles', l); } }
async function crewApi(op, body, c){
  const h = { 'Content-Type':'application/json' }; if(c) h['X-Member'] = c.mid + ':' + c.token;
  const r = await fetch('/api/crew/' + op + (op === 'board' ? '?crew=' + c.id : ''), op === 'board' ? { headers:h, cache:'no-store' } : { method:'POST', headers:h, body:JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({})); if(!r.ok) throw Object.assign(new Error(j.error || 'net'), { code:j.error, status:r.status }); return j;
}
const shareFields = s => ({ id:s.id, start:s.start, dist:s.dist, time:s.time, strokes:s.strokes, kcal:s.kcal, b500:s.b500, b1k:s.b1k, b2k:s.b2k, st:s.st, mode:s.mode, wkDesc:s.wkDesc });
async function pushCrews(pid){
  const p = profiles().find(x => x.id === (pid || cur().id)); if(!p || !crewsOf(p).length || !navigator.onLine) return;
  ensure(); const since = Date.now() - 400 * DAY, list = sessionsOf(p.id).filter(s => s.start >= since).map(shareFields);
  for(const c of crewsOf(p)){ try{ await crewApi('push', { crew:c.id, replace:true, since, sessions:list, name:p.name, color:p.c }, c); c.pushed = Date.now(); }
    catch(e){ if(e.status === 403){ p.crews = crewsOf(p).filter(x => x.id !== c.id); toast('You were removed from ' + c.name); } } }
  saveProfile(p);
}
async function crewBoard(c){
  try{ const j = await crewApi('board', null, c); LS.set('sp_crewb_' + c.id, Object.assign(j, { at:Date.now() })); return j; }
  catch(e){ if(e.status === 403){ const p = cur(); p.crews = crewsOf(p).filter(x => x.id !== c.id); saveProfile(p); toast('Not in ' + c.name + ' any more'); throw e; } return LS.get('sp_crewb_' + c.id, null); }
}
function inviteLink(c){ return location.origin + '/#join=' + c.code; }
async function shareInvite(c){
  const url = inviteLink(c), text = 'Join our crew "' + c.name + '" on StrokePulse: ' + url + '  (code ' + c.code + ')';
  try{ if(navigator.share){ await navigator.share({ title:'StrokePulse crew', text, url }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(text); toast('Invite copied — paste it in a text'); }catch(e){ prompt('Copy this invite:', text); }
}
function crewSheet(prefill){
  const p = cur();
  openSheet('<h2 style="margin-bottom:6px">Crews</h2><p class="muted" style="margin-bottom:10px">A crew shares distance, times, bests and calories so you can compete and set team goals. GPS routes, recordings and notes are never shared.</p>' +
    '<div class="row" style="border:0"><span>Joining as</span>' + chip() + '</div>' +
    '<div class="frm"><label>Join with an invite code</label><div style="display:flex;gap:8px"><input id="crCode" maxlength="7" placeholder="ABC123" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:3px;font-weight:800" value="' + esc(prefill || '') + '"><button class="big" id="crJoin" style="width:96px;margin:0;height:46px">Join</button></div>' +
    '<label style="margin-top:16px">…or start a new crew</label><div style="display:flex;gap:8px"><input id="crName" maxlength="24" placeholder="e.g. Selkirk Girls 8+"><button class="big alt" id="crMake" style="width:96px;margin:0;height:46px">Create</button></div></div>' +
    (crewsOf(p).length ? '<h2 style="margin:16px 0 4px">' + esc(p.name) + '’s crews</h2>' + crewsOf(p).map(c => '<div class="row"><span><b>' + esc(c.name) + '</b> <span class="muted">· ' + c.code + '</span></span><span style="display:flex;gap:6px"><button class="pchip" data-inv="' + c.id + '">Invite</button><button class="pchip" data-leave="' + c.id + '" style="color:var(--bad)">Leave</button></span></div>').join('') : ''),
    el => {
      const done = (j, made) => { const P = cur(); P.crews = crewsOf(P).filter(x => x.id !== j.crew.id).concat({ id:j.crew.id, name:j.crew.name, code:j.crew.code, mid:j.mid, token:j.token, owner:!!made }); saveProfile(P); BS = j.crew.id; closeSheet(); toast(made ? 'Crew created — now invite your crew' : 'Joined ' + j.crew.name); pushCrews(P.id).then(() => { if($t('scr-progress') && $t('scr-progress').classList.contains('on')) renderProgress(); }); open('board'); if(made) setTimeout(() => shareInvite(P.crews[P.crews.length - 1]), 400); };
      $t('crJoin').onclick = async () => { const code = $t('crCode').value.trim().toUpperCase(); if(code.length < 6){ toast('Enter the 6-letter code'); return; } if(crewsOf(cur()).some(c => c.code === code)){ toast('Already in that crew'); return; }
        try{ done(await crewApi('join', { code, name:cur().name, color:cur().c })); }catch(e){ toast(e.code === 'no_crew' ? 'No crew with that code' : e.code === 'crew_full' ? 'That crew is full' : 'Couldn’t join — check your connection'); } };
      $t('crMake').onclick = async () => { const n = $t('crName').value.trim(); if(!n){ toast('Give the crew a name'); return; }
        try{ done(await crewApi('create', { crew:n, name:cur().name, color:cur().c }), true); }catch(e){ toast('Couldn’t create — check your connection'); } };
      el.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => shareInvite(crewsOf(cur()).find(c => c.id === b.dataset.inv)));
      el.querySelectorAll('[data-leave]').forEach(b => b.onclick = async () => { const P = cur(), c = crewsOf(P).find(x => x.id === b.dataset.leave); if(!confirm('Leave ' + c.name + '? Your shared numbers are removed from it.')) return;
        try{ await crewApi('leave', { crew:c.id }, c); }catch(e){} P.crews = crewsOf(P).filter(x => x.id !== c.id); saveProfile(P); if(BS === c.id) BS = 'phone'; closeSheet(); renderProgress(); });
    });
}
/* invite links open straight into the join sheet */
function checkJoinLink(){ const m = /^#join=([A-Za-z0-9]{6})$/.exec(location.hash); if(!m) return; history.replaceState(null, '', location.pathname); setTimeout(() => { open('board'); crewSheet(m[1].toUpperCase()); }, 600); }
let BS = LS.get('sp_bscope', null);

/* ================= weekly check-in: progress vs the on-track line, and the plan adjusted to match ================= */
function recentPredict(L, D){ const rec = L.filter(s => s.start >= Date.now() - 42 * DAY); return predict(rec.length >= 2 ? rec : L, D); }
function onTrackAt(r, t){ const t0 = r.set || Date.now(), t1 = new Date(r.by + 'T12:00').getTime(), s0 = r.startT || r.time; const f = Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1))); return s0 + (r.time - s0) * f; }
function reportWeek(){ const d = new Date(); return d.getDay() === 0 ? thisWeek() : thisWeek() - 7 * DAY; }   // Sunday: this week so far; other days: last week
function buildCheckin(g, L, wk){
  const r = g.race, end = wk + 7 * DAY, inW = L.filter(s => inRange(s, wk, end)), m = inW.reduce((a, s) => a + s.dist, 0);
  const planned = r.next && r.next.w === wk ? r.next : (() => { const p0 = makePlan(g, L).weeks[0]; return { n:p0.ses.length, m:p0.m }; })();
  const upto = L.filter(s => s.start < end), pr = recentPredict(upto, r.dist), need = onTrackAt(r, Math.min(end, Date.now()));
  const prevKeys = Object.keys(r.checks || {}).map(Number).filter(k => k < wk).sort((a, b) => a - b), prev = prevKeys.length ? r.checks[prevKeys[prevKeys.length - 1]] : null;
  const per = sec => sec * SB() / r.dist;   // race seconds → seconds per 500 m
  const behind = pr ? per(pr.t - need) : null, comp = planned.n ? inW.length / planned.n : 1, vol = planned.m ? m / planned.m : 1;
  // where will the trend land on race day?
  const pts = prevKeys.map(k => [k, r.checks[k].pred]).filter(x => x[1]).concat(pr ? [[wk, pr.t]] : []);
  let proj = null; if(pts.length >= 2){ const n = pts.length, mx = pts.reduce((a, x) => a + x[0], 0) / n, my = pts.reduce((a, x) => a + x[1], 0) / n; let sxy = 0, sxx = 0; pts.forEach(x => { sxy += (x[0] - mx) * (x[1] - my); sxx += (x[0] - mx) ** 2; }); const sl = sxx ? sxy / sxx : 0; const tBy = new Date(r.by + 'T12:00').getTime(), wl = Math.max(0, (tBy - end) / (7 * DAY)), last = pts[pts.length - 1][1]; proj = my + sl * (tBy - mx);
    proj = Math.min(last + wl * r.dist / SB() * 0.5, Math.max(proj, last - wl * r.dist / SB() * 1.0, r.time * 0.9)); }   // realistic: at most ~1 s/500 m better per week
  const F = fitness(upto), sh = shape(upto);
  let status = behind == null ? 'nodata' : behind <= -1 ? 'ahead' : behind <= 0.8 ? 'on' : behind <= 2.5 ? 'close' : 'behind';
  const tips = [], changes = []; let adj = +r.adj || 1, focus = r.focus || null;
  if(comp < 0.6){ tips.push(['🗓', 'Only ' + inW.length + ' of ' + planned.n + ' sessions', 'Getting the sessions in matters more than anything else. Pick fixed days and protect them.']); if(comp < 0.4 && adj > 0.8){ adj = Math.max(0.8, adj - 0.1); changes.push('Weekly distance lowered 10% so the plan fits your schedule'); } }
  if(F.form < -25){ adj = Math.max(0.75, adj - 0.1); changes.push('Lighter week: distance down 10% — you’re carrying fatigue (form ' + Math.round(F.form) + ')'); }
  else if((status === 'behind' || status === 'close') && comp >= 0.8){
    if(adj < 1.25){ adj = Math.min(1.25, adj + 0.05); changes.push('Weekly distance up 5%'); }
    const lim = sh.short != null && sh.long != null ? (sh.long - sh.short > 0.02 ? 'endurance' : sh.short - sh.long > 0.02 ? 'speed' : null) : null;
    const f2 = lim || (focus === 'speed' ? 'speed' : 'speed');
    if(f2 !== focus){ focus = f2; changes.push(focus === 'speed' ? 'One steady row swapped for extra race-pace work' : 'One interval swapped for a longer steady row to build your base'); }
    tips.push(['📈', 'Do the plan, then a bit more', 'You did the work but the pace isn’t there yet. The plan now has ' + (focus === 'speed' ? 'more race-pace work' : 'more long steady rowing') + '.']); }
  else if(status === 'ahead'){ if(focus){ focus = null; changes.push('Back to the standard mix'); } tips.push(['🎉', 'Ahead of schedule', 'Your form predicts ' + fmtTime(pr.t) + '.' + (proj && proj < r.time - 2 ? ' At this rate you could reach about ' + fmtTime(Math.round(proj)) + ' — consider a tougher target with Edit goal.' : ' Keep it up — you’re ahead of the on-track line.')]); }
  else if(status === 'on'){ tips.push(['✅', 'Right on track', 'Keep doing exactly this.']); }
  if(status === 'behind' && proj && proj > r.time + 3){ tips.push(['🎯', 'At this rate: ' + fmtTime(Math.round(proj)) + ' on race day', 'That’s ' + Math.round(proj - r.time) + ' s off the goal. Either push the date back, or aim for ' + fmtTime(Math.round(proj - 2)) + ' — then raise it again when you catch up.']); }
  if(vol > 1.3) tips.push(['⚠️', 'Lots of extra distance', 'You rowed ' + Math.round(vol * 100) + '% of the planned distance. More isn’t always better — keep the easy days easy.']);
  if(!inW.length) tips.push(['🛶', 'No rows this week', 'Start with the first session of this week’s plan — even a short one.']);
  return { w:wk, at:Date.now(), n:inW.length, pn:planned.n, m, pm:planned.m, pred:pr ? pr.t : null, need, behind, status, proj, tips, changes, adj, focus, form:F.form, prevPred:prev ? prev.pred : null };
}
const STAT = { ahead:['Ahead of schedule', '#2ed47a'], on:['On track', '#2ed47a'], close:['Slightly behind', '#ffd400'], behind:['Behind schedule', '#ff6b6b'], nodata:['Not enough data yet', 'var(--dim)'] };
function checkin(force){
  const p = cur(), g = goalOf(p.id), r = g.race; if(!r) return false;
  if(window.run && !run.armed) return false;
  const wk = reportWeek(); r.checks = r.checks || {};
  if(!force && (r.checks[wk] || (r.set || 0) > wk + 6 * DAY || (r.set || 0) > Date.now() - 2 * DAY)) return false;
  ensure(); const L = sessionsOf(p.id), c = buildCheckin(g, L, wk);
  r.checks[wk] = c; r.adj = c.adj; r.focus = c.focus;
  const nx = makePlan(g, L).weeks[0]; r.next = { w:reportWeek() === thisWeek() ? thisWeek() + 7 * DAY : thisWeek(), n:nx.ses.length, m:nx.m };
  setGoal(p.id, g); showCheckin(wk); return true;
}
function showCheckin(wk){
  const p = cur(), g = goalOf(p.id), r = g.race; if(!r || !r.checks || !r.checks[wk]) return; const c = r.checks[wk], st = STAT[c.status] || STAT.nodata;
  const d1 = new Date(wk), d2 = new Date(wk + 6 * DAY), f = d => d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  const row = t => '<div class="tip"><span class="ic">' + t[0] + '</span><div><b>' + esc(t[1]) + '</b><p>' + esc(t[2]) + '</p></div></div>';
  openSheet('<div class="muted" style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase">' + esc(p.name) + ' · weekly check-in · ' + f(d1) + '–' + f(d2) + '</div>' +
    '<div style="font-size:26px;font-weight:900;margin:4px 0 2px;color:' + st[1] + '">' + st[0] + '</div>' +
    '<div class="muted" style="margin-bottom:10px">Goal: ' + fmtTime(r.time) + ' for ' + r.dist.toLocaleString() + ' m by ' + new Date(r.by + 'T12:00').toLocaleDateString(undefined, { month:'short', day:'numeric' }) + '</div>' +
    '<div class="grid3">' + stat('Sessions', c.n + ' / ' + c.pn) + stat('Distance', kmTxt(c.m)) + stat('Predicted', c.pred ? fmtTime(c.pred) : '–') + '</div>' +
    '<div style="margin-top:8px">' + pbarHtml(c.pn ? c.n / c.pn : 0) + '</div>' +
    (c.pred && c.prevPred ? '<p class="muted" style="margin-top:6px;font-size:13px">' + (c.pred <= c.prevPred ? '▼ ' + (c.prevPred - c.pred).toFixed(1) + ' s faster' : '▲ ' + (c.pred - c.prevPred).toFixed(1) + ' s slower') + ' than last check-in · on-track pace for now: ' + fmtTime(c.need) + '</p>' : c.pred ? '<p class="muted" style="margin-top:6px;font-size:13px">On-track time for now: ' + fmtTime(c.need) + '</p>' : '') +
    '<canvas id="ciSheet" style="width:100%;height:170px;display:block;margin-top:10px"></canvas><div class="lg"><span><i style="background:var(--dim)"></i>On-track line</span><span><i style="background:#2f9bff"></i>Your predicted time</span><span><i style="background:#ff9f1c"></i>Where you’re heading</span></div>' +
    (c.changes.length ? '<h2 style="margin:14px 0 4px;font-size:12px;letter-spacing:2px;color:#ff9f1c">PLAN CHANGES FOR THIS WEEK</h2>' + c.changes.map(x => '<div class="row" style="padding:6px 0">🔧 ' + esc(x) + '</div>').join('') : '') +
    (c.tips.length ? '<h2 style="margin:14px 0 4px;font-size:12px;letter-spacing:2px;color:#ff9f1c">SUGGESTIONS</h2>' + c.tips.map(row).join('') : '') +
    '<button class="big" id="ciOk" style="margin-top:14px">See this week’s plan</button>',
    el => { drawTrack2($t('ciSheet'), g, sessionsOf(p.id), wk); $t('ciOk').onclick = () => { closeSheet(); EDIT = false; open('goals'); }; });
}
/* predicted race time week by week against the straight on-track line, plus the trend to race day */
function drawTrack2(cv, g, L, upto){
  const r = g.race, ks = Object.keys(r.checks || {}).map(Number).filter(k => !upto || k <= upto).sort((a, b) => a - b), pts = ks.map(k => [k + 6 * DAY, r.checks[k].pred]).filter(x => x[1]);
  const t0 = r.set || Date.now(), t1 = new Date(r.by + 'T12:00').getTime(), s0 = r.startT || r.time;
  const last = upto ? r.checks[upto] : (ks.length ? r.checks[ks[ks.length - 1]] : null);
  const vals = [s0, r.time].concat(pts.map(x => x[1])).concat(last && last.proj ? [last.proj] : []); let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(2, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const [x, w, h] = canvasFit2(cv), Lx = 42, Rx = w - 8, T = 8, B = h - 20, X = t => Lx + (Rx - Lx) * (t - t0) / ((t1 - t0) || 1), Y = v => T + (B - T) * (v - lo) / (hi - lo);   // faster = higher
  x.font = '11px -apple-system,sans-serif'; x.fillStyle = cssVar('--dim'); x.strokeStyle = cssVar('--line'); x.lineWidth = 1; x.textAlign = 'right';
  [s0, r.time].forEach(v => { x.fillText(fmtTime(v), Lx - 4, Y(v) + 4); x.beginPath(); x.moveTo(Lx, Y(v)); x.lineTo(Rx, Y(v)); x.stroke(); });
  x.textAlign = 'left'; x.fillText('goal set', Lx, h - 5); x.textAlign = 'right'; x.fillText('race day', Rx, h - 5);
  x.strokeStyle = cssVar('--dim'); x.setLineDash([5, 5]); x.lineWidth = 2; x.beginPath(); x.moveTo(X(t0), Y(s0)); x.lineTo(X(t1), Y(r.time)); x.stroke(); x.setLineDash([]);
  x.fillStyle = '#2ed47a'; x.beginPath(); x.arc(X(t1), Y(r.time), 5, 0, 7); x.fill();
  if(last && last.proj && pts.length){ const p = pts[pts.length - 1]; x.strokeStyle = '#ff9f1c'; x.setLineDash([2, 4]); x.lineWidth = 2; x.beginPath(); x.moveTo(X(p[0]), Y(p[1])); x.lineTo(X(t1), Y(last.proj)); x.stroke(); x.setLineDash([]); x.fillStyle = '#ff9f1c'; x.beginPath(); x.arc(X(t1), Y(last.proj), 4, 0, 7); x.fill(); }
  x.strokeStyle = '#2f9bff'; x.lineWidth = 2.5; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.stroke();
  pts.forEach(p => { x.fillStyle = '#2f9bff'; x.beginPath(); x.arc(X(p[0]), Y(p[1]), 4, 0, 7); x.fill(); });
}
function checkinsCard(g, L){
  const r = g.race, ks = Object.keys(r.checks || {}).map(Number).sort((a, b) => b - a);
  return '<div class="card"><h2>Weekly check-ins</h2>' + (ks.length ? '<canvas id="ciChart" style="width:100%;height:170px;display:block"></canvas><div class="lg"><span><i style="background:var(--dim)"></i>On-track line</span><span><i style="background:#2f9bff"></i>Predicted time</span><span><i style="background:#ff9f1c"></i>Heading for</span></div>' +
    ks.slice(0, 12).map(k => { const c = r.checks[k], st = STAT[c.status] || STAT.nodata; return '<div class="row" data-ci="' + k + '" style="cursor:pointer"><span>' + new Date(k).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + ' · <b style="color:' + st[1] + '">' + st[0] + '</b></span><span class="muted">' + (c.pred ? fmtTime(c.pred) : '–') + ' ›</span></div>'; }).join('')
    : '<p class="muted">Every Sunday (or the next time you open the app) you get a check-in: how the week went, whether you’re on track for race day, and the plan adjusted to match.</p>') +
    '<button class="big alt" id="ciNow" style="margin-top:10px">Check in now</button></div>';
}

/* ================= the Progress screen ================= */
let EDIT = false, TAB = 'goals', BP = 'w', BM = 'm', FR = 30;
function mountScreen(){
  if($t('scr-progress')) return;
  const sec = document.createElement('section'); sec.className = 'screen'; sec.id = 'scr-progress';
  sec.innerHTML = '<div class="top"><button class="iconbtn" data-go="menu">‹ Back</button><h1 style="flex:1">Progress</h1><span id="prChip"></span></div>' +
    '<div class="tabs" id="prTabs"><button data-v="goals">Goals</button><button data-v="fit">Fitness</button><button data-v="ach">Trophies</button><button data-v="board">Board</button></div><div class="body" id="prBody"></div>';
  document.body.insertBefore(sec, $t('sheet'));
  sec.querySelectorAll('#prTabs button').forEach(b => b.onclick = () => { TAB = b.dataset.v; renderProgress(); $t('prBody').scrollTop = 0; });
}
function open(tab){ mountScreen(); if(tab) TAB = tab; go('progress'); renderProgress(); }
function renderProgress(){
  mountScreen(); const all = ensure(), p = cur(), L = all.filter(s => owner(s) === p.id);
  $t('prChip').innerHTML = chip();
  document.querySelectorAll('#prTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === TAB));
  const box = $t('prBody');
  if(TAB === 'goals') goalsTab(box, L, p);
  else if(TAB === 'fit') fitTab(box, L);
  else if(TAB === 'ach') achTab(box, L, p);
  else boardTab(box, all, p);
}
function goalsTab(box, L, p){
  const g = goalOf(p.id);
  let h = '';
  if(!g.race || EDIT){
    const e = EDIT && g.race ? g.race : null, pr2 = predict(L, e ? e.dist : 2000);
    h += '<div class="card"><h2>' + (e ? 'Edit your goal' : 'Set a race goal') + '</h2><p class="muted">' + (e ? 'Change anything — your progress and check-ins are kept, and the plan is rebuilt.' : 'Pick a distance, your target time and the date. You get a week-by-week plan built around your own pace.') + '</p><div class="frm">' +
      '<label>Distance</label><select id="gDist">' + [500, 1000, 1500, 2000, 5000, 6000].map(d => '<option value="' + d + '"' + (d === (e ? e.dist : 2000) ? ' selected' : '') + '>' + d.toLocaleString() + ' m</option>').join('') + '</select>' +
      '<label>Target time (m:ss)</label><input id="gTime" inputmode="decimal" value="' + (e ? fmtTime(e.time) : '') + '" placeholder="' + (pr2 ? fmtTime(Math.round(pr2.t - 10)) : '7:30') + '">' +
      '<label>By (race or test day)</label><input id="gBy" type="date" value="' + (e ? e.by : new Date(Date.now() + 56 * DAY).toISOString().slice(0, 10)) + '">' +
      '<label>Sessions per week</label><select id="gDays">' + [3, 4, 5, 6, 7].map(d => '<option' + (d === (e ? +e.days : 5) ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></div>' +
      '<button class="big" id="gSet" style="margin-top:14px">' + (e ? 'Save changes' : 'Make my plan') + '</button>' + (e ? '<button class="big alt" id="gCancel">Cancel</button>' : '') + '</div>';
  } else {
    const r = g.race, gs = SB() * r.time / r.dist, pr = predict(L, r.dist), plan = makePlan(g, L), w0 = thisWeek();
    const name = 'Sub-' + fmtTime(r.time) + ' ' + (r.dist % 1000 === 0 ? r.dist / 1000 + 'k' : r.dist + ' m');
    const start = r.startT || (pr ? pr.t : null), prog = start && pr && start > r.time ? Math.max(0, Math.min(1, (start - pr.t) / (start - r.time))) : pr && pr.t <= r.time ? 1 : 0;
    h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="muted" style="font-size:13px">' + esc(p.name) + ' · goal</span><span style="color:var(--good);font-weight:800;font-size:13px">● Active plan</span></div>' +
      '<div style="font-size:30px;font-weight:900;margin:6px 0">' + esc(name) + '</div>' +
      '<div class="grid3">' + stat('Goal pace', sTxt(gs)) + stat('Now', pr ? fmtTime(pr.t) : '–') + stat('Race day', new Date(r.by + 'T12:00').toLocaleDateString(undefined, { month:'short', day:'numeric' })) + '</div>' +
      '<div style="margin-top:12px">' + pbarHtml(prog, '#ff9f1c') + '<p class="muted" style="margin-top:6px;font-size:13px">' + (pr ? 'Predicted from your best ' + pr.from + ' m. ' : '') + Math.round(prog * 100) + '% of the way from where you started.</p></div></div>';
    const adv = goalAdvice(L, g);
    if(adv.length) h += '<div class="card"><h2>How to get there</h2>' + adv.map(t => '<div class="tip"><span class="ic">' + t[0] + '</span><div><b>' + esc(t[1]) + '</b><p>' + esc(t[2]) + '</p></div></div>').join('') + '</div>';
    // this week
    const wk = plan.weeks[0], done = L.filter(s => s.start >= w0), doneM = done.reduce((a, s) => a + s.dist, 0);
    h += '<div class="card"><h2>This week</h2><div class="grid3">' + stat('Sessions', done.length + ' / ' + wk.ses.length) + stat('Distance', kmTxt(doneM)) + stat('Planned', kmTxt(wk.m)) + '</div><div style="margin-top:10px">' + pbarHtml(doneM / wk.m) + '</div></div>';
    h += '<div class="card"><h2>Week by week</h2><canvas id="gBars" style="width:100%;height:170px;display:block"></canvas><div class="lg">' + Object.values(TYPES).map(t => '<span><i style="background:' + t.c + '"></i>' + t.l.toUpperCase() + '</span>').join('') + '</div>' +
      plan.weeks.map((w, i) => { const dn = L.filter(s => inRange(s, w.start, w.start + 7 * DAY)).length;
        return '<div class="wkc' + (i === 0 ? ' now' : '') + '"><div class="h"><div><div class="s">Week ' + (i + 1) + ' · ' + new Date(w.start).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + '</div><b style="font-size:18px">' + w.label + '</b><div class="s" style="margin-top:2px">' + w.ses.length + ' sessions · ' + kmTxt(w.m) + (i === 0 || w.start < w0 ? ' · ' + dn + ' done' : '') + '</div></div><span class="muted">' + (i === 0 ? '▾' : '▸') + '</span></div>' +
          '<div class="wkb" style="display:' + (i === 0 ? 'block' : 'none') + '">' + w.ses.map((s, k) => '<div class="ses' + (i === 0 && k < dn ? ' done' : '') + '"><span class="dt" style="background:' + TYPES[s.t].c + '"></span><div class="x"><b>' + esc(s.n) + '</b><small>' + esc(s.d) + '</small></div>' + (s.wk ? '<button data-w="' + i + '" data-k="' + k + '">Load</button>' : '') + '</div>').join('') + '</div></div>'; }).join('') +
      '<p class="muted" style="margin-top:10px;font-size:13px">“Load” sets up the workout and its rate and split targets, ready to press START. Every 4th week is lighter so your body can absorb the work; race week tapers.</p></div>';
    h += checkinsCard(g, L);
    h += '<div style="display:flex;gap:8px;margin-bottom:12px"><button class="big alt" id="gEdit" style="margin:0;flex:1">✏️ Edit goal</button><button class="big red" id="gClear" style="margin:0;flex:1">Remove</button></div>';
    box.innerHTML = h + otherGoals(L, g);
    drawPlanBars($t('gBars'), plan);
    box.querySelectorAll('.wkc .h').forEach(hd => hd.onclick = () => { const b = hd.nextElementSibling; b.style.display = b.style.display === 'none' ? 'block' : 'none'; });
    box.querySelectorAll('.ses button').forEach(b => b.onclick = e => { e.stopPropagation(); const s = plan.weeks[+b.dataset.w].ses[+b.dataset.k]; Object.assign(S.wk, JSON.parse(JSON.stringify(s.wk)), { ts:s.wk.ts.map(v => Math.round(v * 10) / 10) }); saveSettings(); toast('Loaded ' + s.n + ' — press START'); go('live'); if(typeof renderLive === 'function') renderLive(); });
    $t('gClear').onclick = () => { if(!confirm('Remove the goal and plan?')) return; delete g.race; setGoal(p.id, g); renderProgress(); };
    $t('gEdit').onclick = () => { EDIT = true; renderProgress(); $t('prBody').scrollTop = 0; };
    if($t('ciChart')) drawTrack2($t('ciChart'), g, L);
    box.querySelectorAll('[data-ci]').forEach(b => b.onclick = () => showCheckin(+b.dataset.ci));
    if($t('ciNow')) $t('ciNow').onclick = () => checkin(true);
    wireOther(L, g, p); return;
  }
  box.innerHTML = h + otherGoals(L, g);
  $t('gSet').onclick = () => { const t = parseSplit($t('gTime').value), d = +$t('gDist').value, by = $t('gBy').value; if(!t || t < 60){ toast('Enter a target time like 7:00'); return; } if(!by || new Date(by + 'T12:00') < Date.now()){ toast('Pick a future date'); return; }
    const pr = predict(L, d), old = EDIT && g.race;
    g.race = old && old.dist === d ? Object.assign(old, { time:t, by, days:+$t('gDays').value }) : Object.assign({ dist:d, time:t, by, days:+$t('gDays').value, startT:pr ? pr.t : null, set:Date.now() }, old ? { checks:old.checks, adj:old.adj, focus:old.focus } : {});
    setGoal(p.id, g); EDIT = false; toast(old ? 'Goal updated — plan rebuilt' : 'Plan ready'); renderProgress(); };
  if($t('gCancel')) $t('gCancel').onclick = () => { EDIT = false; renderProgress(); };
  wireOther(L, g, p);
}
function otherGoals(L, g){
  const w0 = thisWeek(), now = L.filter(s => s.start >= w0), m = now.reduce((a, s) => a + s.dist, 0);
  return '<div class="card"><h2>Weekly goals</h2><div class="frm" style="display:flex;gap:8px"><div style="flex:1"><label>Distance per week (' + (imp() ? 'mi' : 'km') + ')</label><input id="gWk" type="number" inputmode="decimal" value="' + (g.weekM ? (imp() ? (g.weekM / 1609.344).toFixed(0) : g.weekM / 1000) : '') + '" placeholder="off"></div><div style="flex:1"><label>Sessions per week</label><input id="gWn" type="number" inputmode="numeric" value="' + (g.weekN || '') + '" placeholder="off"></div></div>' +
    (g.weekM ? '<div class="row" style="margin-top:10px"><span>Distance this week</span><b>' + kmTxt(m) + ' / ' + kmTxt(g.weekM) + '</b></div>' + pbarHtml(m / g.weekM) : '') +
    (g.weekN ? '<div class="row" style="margin-top:10px"><span>Sessions this week</span><b>' + now.length + ' / ' + g.weekN + '</b></div>' + pbarHtml(now.length / g.weekN) : '') +
    '<p class="muted" style="margin-top:8px;font-size:13px">Weeks run Monday to Sunday.</p></div>';
}
function wireOther(L, g, p){
  const sv = () => { const a = parseFloat($t('gWk').value), b = parseInt($t('gWn').value); g.weekM = a > 0 ? Math.round(a * (imp() ? 1609.344 : 1000)) : 0; g.weekN = b > 0 ? b : 0; setGoal(p.id, g); renderProgress(); };
  $t('gWk').onchange = sv; $t('gWn').onchange = sv;
}
function drawPlanBars(c, plan){
  const [x, w, h] = canvasFit2(c), n = plan.weeks.length, B = h - 20, mx = Math.max(...plan.weeks.map(k => k.m)), bw = Math.min(46, (w - 10) / n - 6);
  plan.weeks.forEach((wk, i) => { const cx = 5 + (i + 0.5) * (w - 10) / n; let y = B; for(const t of ['rec', 'ss', 'int', 'race']){ const m = wk.ses.filter(s => s.t === t).reduce((a, s) => a + s.m, 0); if(!m) continue; const hh = (B - 8) * m / mx; x.fillStyle = TYPES[t].c; x.beginPath(); x.roundRect ? x.roundRect(cx - bw / 2, y - hh + 1.5, bw, hh - 3, 3) : x.rect(cx - bw / 2, y - hh + 1.5, bw, hh - 3); x.fill(); y -= hh; }
    x.fillStyle = cssVar('--dim'); x.font = '11px -apple-system,sans-serif'; x.textAlign = 'center'; x.fillText(String(i + 1), cx, h - 5); });
}
function fitTab(box, L){
  if(!L.length){ box.innerHTML = '<div class="card"><p>Row a few sessions and your fitness, strength shape and stroke curve appear here.</p></div>'; return; }
  const F = fitness(L), d = F.days.slice(-FR), d0 = d[0] || { ctl:0, atl:0 }, fw = formWord(F.form);
  let h = '<div class="card"><h2>Fitness · Fatigue</h2><div class="bignum"><span style="color:#5aa9ff">' + Math.round(F.ctl) + '</span><span>/</span><span style="color:#ff6b6b">' + Math.round(F.atl) + '</span></div>' +
    '<p class="muted" style="margin-top:6px">Fitness ' + (F.ctl >= d0.ctl ? '↑' : '↓') + Math.abs(Math.round(F.ctl - d0.ctl)) + ' · Fatigue ' + (F.atl >= d0.atl ? '↑' : '↓') + Math.abs(Math.round(F.atl - d0.atl)) + ' / ' + FR + 'd</p>' +
    '<p style="margin-top:8px"><b>Form ' + (F.form > 0 ? '+' : '') + Math.round(F.form) + ' · ' + fw[0] + '.</b> <span class="muted">' + fw[1] + '</span></p>' +
    '<div class="seg" id="fR" style="margin-top:10px"><button data-v="30">30 days</button><button data-v="90">90 days</button><button data-v="365">Year</button></div>' +
    '<canvas id="fC" style="width:100%;height:190px;display:block;margin-top:10px"></canvas><div class="lg"><span><i style="background:#5aa9ff"></i>Fitness (42-day)</span><span><i style="background:#ff6b6b"></i>Fatigue (7-day)</span><span><i style="background:var(--dim)"></i>Daily load</span></div>' +
    '<p class="muted" style="margin-top:8px;font-size:13px">Every session adds training load (longer and higher-rate = more). Fitness is your load averaged over 6 weeks, fatigue over 1 week. Fitness above fatigue = fresh; well below = tired. Build fitness slowly, then rest before races.</p></div>';
  const wm = weekMap(L), w0 = thisWeek(), weeks = []; for(let i = 11; i >= 0; i--){ const s = w0 - i * 7 * DAY; weeks.push({ s, m:(wm[s] || { m:0 }).m }); }
  h += '<div class="card"><h2>Weekly distance</h2><div class="bignum" style="color:#5aa9ff">' + kmTxt(weeks[11].m) + '</div><p class="muted">this week · ' + kmTxt(weeks.slice(0, 11).reduce((a, w) => a + w.m, 0) / 11) + ' average over the 11 before</p><canvas id="fW" style="width:100%;height:120px;display:block;margin-top:10px"></canvas></div>';
  const sh = shape(L), have = Object.keys(sh.rel).length;
  const strong = DURS.filter(D => sh.rel[D]).sort((a, b) => sh.rel[b] - sh.rel[a]), weak = strong.slice().reverse();
  h += '<div class="card"><h2>Strength shape</h2><p class="muted" style="font-size:13px">Your best pace held for each length of effort, scaled by Paul’s law so short and long efforts compare fairly. The fullest point is your peak; the rest show how close you get to it.</p>' +
    (have >= 3 ? '<canvas id="fS" style="width:100%;height:300px;display:block;margin-top:6px"></canvas>' +
      '<p style="margin-top:6px"><b>Strongest:</b> ' + strong.slice(0, 2).map(D => DLAB[DURS.indexOf(D)]).join(', ') + ' · <b>Weakest:</b> ' + weak.slice(0, 2).map(D => DLAB[DURS.indexOf(D)]).join(', ') + '</p>' +
      (sh.long != null && sh.short != null ? '<p class="muted" style="margin-top:4px;font-size:13px">' + (sh.long > sh.short + 0.02 ? 'Long efforts lag your sprints — more steady state builds the base.' : sh.short > sh.long + 0.02 ? 'Sprints lag your endurance — add race-pace and short, fast pieces.' : 'Well balanced between speed and endurance.') + '</p>' : '') +
      '<table style="margin-top:8px"><tr><th>Effort</th><th>Best pace</th><th>Distance</th></tr>' + DURS.filter(D => sh.best[D]).map(D => '<tr><td>' + DLAB[DURS.indexOf(D)] + '</td><td>' + sTxt(SB() / sh.best[D]) + '</td><td>' + fmtDist(sh.best[D] * D) + distUnit(sh.best[D] * D) + '</td></tr>').join('') + '</table>'
      : '<p style="margin-top:8px">Needs efforts of a few different lengths — keep rowing and it fills in.</p>') + '</div>';
  const withC = L.map(s => ({ s, d:LS.get('sp_s_' + s.id, null) })).filter(o => o.d && o.d.curve && o.d.curve.n >= 20).slice(0, 10);
  if(withC.length){ const avg = new Array(CN).fill(0); withC.forEach(o => { const c = align(o.d.curve.a).c, m = Math.max(...c) || 1; c.forEach((v, i) => avg[i] += v / m / withC.length); });
    h += curveCardHtml('Stroke curve', curveStats(avg), 'Average of your last ' + withC.length + ' session' + (withC.length > 1 ? 's' : '') + ' (grey lines are single sessions).'); }
  else h += '<div class="card"><h2>Stroke curve</h2><p class="muted">Appears after a session with the phone’s motion sensor on (not demo mode). Mount the phone firmly in the boat.</p></div>';
  box.innerHTML = h;
  segBind($t('fR'), String(FR), v => { FR = +v; renderProgress(); });
  drawFit($t('fC'), d); drawWeeks($t('fW'), weeks);
  if($t('fS')) drawRadar($t('fS'), sh);
  const cv = box.querySelector('.crv'); if(cv){ const st = curveStats(withC.reduce((a, o) => { const c = align(o.d.curve.a).c, m = Math.max(...c) || 1; c.forEach((v, i) => a[i] += v / m / withC.length); return a; }, new Array(CN).fill(0))); drawCurve(cv, [st].concat(withC.slice(0, 4).map(o => curveStats(o.d.curve.a)))); }
}
function drawFit(c, d){
  const [x, w, h] = canvasFit2(c), L = 30, R = w - 8, T = 8, B = h - 20; if(!d.length) return;
  const mx = Math.max(20, ...d.map(k => Math.max(k.ctl, k.atl))) * 1.15, mxL = Math.max(1, ...d.map(k => k.l)), X = i => L + (R - L) * (d.length > 1 ? i / (d.length - 1) : 0), Y = v => B - (B - T) * v / mx;
  x.font = '11px -apple-system,sans-serif'; x.fillStyle = cssVar('--dim'); x.strokeStyle = cssVar('--line'); x.lineWidth = 1; x.textAlign = 'right';
  for(const f of [0, 0.5, 1]){ const v = Math.round(mx * f / 1.15); x.fillText(v, L - 4, Y(v) + 4); x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(R, Y(v)); x.stroke(); }
  d.forEach((k, i) => { if(!k.l) return; x.fillStyle = 'rgba(138,151,166,.35)'; const bh = (B - T) * 0.35 * k.l / mxL; x.fillRect(X(i) - 2, B - bh, 4, bh); });
  const g = x.createLinearGradient(0, T, 0, B); g.addColorStop(0, 'rgba(90,169,255,.45)'); g.addColorStop(1, 'rgba(90,169,255,0)');
  x.beginPath(); d.forEach((k, i) => i ? x.lineTo(X(i), Y(k.ctl)) : x.moveTo(X(i), Y(k.ctl))); x.lineTo(X(d.length - 1), B); x.lineTo(X(0), B); x.closePath(); x.fillStyle = g; x.fill();
  x.strokeStyle = '#5aa9ff'; x.lineWidth = 2.5; x.beginPath(); d.forEach((k, i) => i ? x.lineTo(X(i), Y(k.ctl)) : x.moveTo(X(i), Y(k.ctl))); x.stroke();
  x.strokeStyle = '#ff6b6b'; x.setLineDash([4, 4]); x.lineWidth = 2; x.beginPath(); d.forEach((k, i) => i ? x.lineTo(X(i), Y(k.atl)) : x.moveTo(X(i), Y(k.atl))); x.stroke(); x.setLineDash([]);
  x.textAlign = 'left'; x.fillStyle = cssVar('--dim'); x.fillText(new Date(d[0].t).toLocaleDateString(undefined, { month:'short', day:'numeric' }), L, h - 5); x.textAlign = 'right'; x.fillText('today', R, h - 5);
}
function drawWeeks(c, weeks){ const [x, w, h] = canvasFit2(c), mx = Math.max(1, ...weeks.map(k => k.m)), bw = (w - 8) / weeks.length;
  weeks.forEach((k, i) => { const bh = (h - 18) * k.m / mx; x.fillStyle = i === weeks.length - 1 ? '#5aa9ff' : 'rgba(90,169,255,.45)'; x.fillRect(4 + i * bw + 3, h - 16 - bh, bw - 6, bh); });
  x.fillStyle = cssVar('--dim'); x.font = '10px -apple-system,sans-serif'; x.textAlign = 'center'; [0, 6, 11].forEach(i => x.fillText(new Date(weeks[i].s).toLocaleDateString(undefined, { month:'short', day:'numeric' }), 4 + (i + 0.5) * bw, h - 3)); }
function achTab(box, L, p){
  const R = achieve(L), earned = R.reduce((a, r) => a + (r.t + 1), 0), total = ACH.reduce((a, x) => a + x.tiers.length, 0), C = challenges(L);
  const cDone = C.filter(c => c.p >= 1).length;
  let h = '<div class="card"><h2>This week’s challenges</h2><p class="muted" style="font-size:13px;margin-bottom:6px">Set from your own recent training — a step up, not a leap. New ones every Monday.</p>' +
    C.map(c => '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="row" style="padding:0;border:0"><span>' + c.ic + ' <b>' + esc(c.n) + '</b>' + (c.p >= 1 ? ' ✅' : '') + '</span><span class="muted" style="font-size:13px">' + esc(c.v) + '</span></div><div class="muted" style="font-size:12px;margin:2px 0 6px">' + esc(c.d) + '</div>' + pbarHtml(c.p) + '</div>').join('') +
    '<p style="margin-top:10px"><b>' + cDone + ' of ' + C.length + '</b> done this week</p></div>';
  h += '<div class="card"><h2>Trophies · ' + earned + ' of ' + total + '</h2><div class="ach">' + R.map(r => { const a = r.a, f = a.f || (v => String(v));
    return '<div><div class="' + (r.t < 0 ? 'locked' : '') + '"><div class="ai">' + a.ic + '</div><div class="an">' + a.n + '</div></div>' + (r.t >= 0 ? '<span class="tier" style="background:' + TIER[r.t][1] + '">' + TIER[r.t][0] + '</span>' : '') +
      '<div class="ad">' + (r.next != null ? 'Next: ' + esc(a.d(r.next)) : 'Maxed out!') + '</div>' + pbarHtml(r.p, r.t >= 0 ? TIER[Math.min(r.t + 1, TIER.length - 1)][1] : null) + '<div class="muted" style="font-size:11px;margin-top:4px">Now: ' + esc(f(r.v)) + '</div></div>'; }).join('') + '</div></div>';
  box.innerHTML = h;
}
function boardTab(box, all, me){
  const myCrews = crewsOf(me); if(BS !== 'phone' && !myCrews.some(c => c.id === BS)) BS = myCrews.length ? myCrews[0].id : 'phone'; LS.set('sp_bscope', BS);
  const scope = '<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px">' + [['phone', '📱 This phone']].concat(myCrews.map(c => [c.id, '👥 ' + c.name])).map(x => '<button data-bs="' + x[0] + '" style="flex:none;padding:9px 14px;border-radius:999px;font-weight:800;font-size:14px;' + (x[0] === BS ? 'background:var(--acc);color:#fff' : 'background:var(--panel);color:var(--dim);border:1px solid var(--line)') + '">' + esc(x[1]) + '</button>').join('') + '<button id="bsAdd" style="flex:none;padding:9px 14px;border-radius:999px;font-weight:800;font-size:14px;background:var(--panel);color:#ff9f1c;border:1px dashed #ff9f1c">＋ Crew</button></div>';
  const wire = () => { box.querySelectorAll('[data-bs]').forEach(b => b.onclick = () => { BS = b.dataset.bs; renderProgress(); }); $t('bsAdd').onclick = () => crewSheet(); };
  if(BS !== 'phone'){
    const c = myCrews.find(x => x.id === BS), cached = LS.get('sp_crewb_' + c.id, null);
    const paint = j => { if(!box.isConnected || BS !== c.id || TAB !== 'board') return; if(!j){ box.innerHTML = scope + '<div class="card"><p>Couldn’t reach the crew — check your connection.</p></div>'; wire(); return; }
      const members = j.members.map(m => ({ id:m.mid, name:m.name, c:m.color, sessions:m.sessions || [] }));
      const ctx = { crew:c, info:j.crew, members, meId:j.me, owner:j.crew.owner === j.me };
      boardBody(box, scope, ctx); wire(); };
    if(cached) paint(cached); else box.innerHTML = scope + '<div class="card"><p class="muted">Loading ' + esc(c.name) + '…</p></div>', wire();
    (Date.now() - (c.pushed || 0) > 60000 ? pushCrews(me.id) : Promise.resolve()).then(() => crewBoard(c)).then(paint).catch(() => {});
    return;
  }
  boardBody(box, scope, null, all, me); wire();
}
/* one board: rowers on this phone, or the members of a crew */
function boardBody(box, scope, ctx, all, me){
  const now = Date.now(), from = BP === 'w' ? thisWeek() : BP === 'm' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : 0;
  const people = ctx ? ctx.members.map(m => ({ p:{ id:m.id, name:m.name, c:m.c }, all:m.sessions })) : profiles().map(p => ({ p, all:all.filter(s => owner(s) === p.id) }));
  const meId = ctx ? ctx.meId : me.id;
  const B = BOARDS.find(b => b[0] === BM), R = people.map(x => { const L = x.all.filter(s => s.start >= from && s.start <= now); return { p:x.p, L, v:B[2](L), n:L.length }; });
  const valid = R.filter(r => B[4] ? isFinite(r.v) : true).sort((a, b) => B[4] ? a.v - b.v : b.v - a.v);
  let h = scope + (ctx ? '<div class="card" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b style="font-size:18px">' + esc(ctx.info.name) + '</b><div class="muted" style="font-size:13px">' + people.length + ' member' + (people.length === 1 ? '' : 's') + ' · code <b style="letter-spacing:2px">' + ctx.info.code + '</b></div></div><button class="big" id="crInv" style="width:auto;padding:0 16px;margin:0;height:44px;font-size:16px">Invite</button></div>' : '') + '<div class="card"><div class="seg" id="bP"><button data-v="w">Week</button><button data-v="m">Month</button><button data-v="a">All time</button></div>' +
    '<div class="mgrid" id="bM">' + BOARDS.map(b => '<button data-v="' + b[0] + '" class="' + (b[0] === BM ? 'on' : '') + '">' + b[1] + '</button>').join('') + '</div>';
  // race lanes: each person rows down their own lane; the boat's position shows how close they are to the leader
  const lead = valid[0], hiB = !B[4];
  const frac = r => { if(!lead || !isFinite(r.v)) return 0.04; if(hiB) return lead.v > 0 ? Math.max(0.04, r.v / lead.v) : 0.04; return Math.max(0.04, Math.min(1, 1 - (r.v - lead.v) / (lead.v * 0.12 || 1))); };
  const gap = r => { if(r === lead) return valid.length > 1 ? '🏁 Leading' : ''; const d = hiB ? lead.v - r.v : r.v - lead.v; return '−' + (hiB ? B[3](d) : d.toFixed(1) + ' s'); };
  /* a rowing shell from above: hull, crew and oars */
  const boat = c => '<svg viewBox="0 0 64 26" width="64" height="26"><g stroke="' + c + '" stroke-width="1.6" stroke-linecap="round" opacity=".9"><path d="M20 13 L14 2"/><path d="M28 13 L34 24"/><path d="M36 13 L30 2"/><path d="M44 13 L50 24"/></g><path d="M2 13 C16 8 48 8 62 13 C48 18 16 18 2 13Z" fill="' + c + '" stroke="#fff" stroke-width="1.2"/>' +
    [20, 28, 36, 44].map(x => '<circle cx="' + x + '" cy="13" r="2" fill="#fff"/>').join('') + '<circle cx="52" cy="13" r="1.4" fill="#0b2540"/></svg>';
  h += '<div class="lanes">' + (valid.length ? valid.map((r, i) => { const f = frac(r), me = r.p.id === meId, c = r.p.c || PCOL[0];
      return '<div class="lane' + (me ? ' me' : '') + (i === 0 && valid.length > 1 ? ' lead' : '') + '" style="--rc:' + c + '"><div class="lh"><span class="rk">' + (i + 1) + '</span>' + avatar(r.p) +
        '<span class="who"><span class="ln">' + esc(r.p.name) + (me ? '<span class="you">YOU</span>' : '') + '</span><span class="sub">' + r.n + ' session' + (r.n === 1 ? '' : 's') + '</span></span>' +
        '<span class="rt"><span class="lv">' + B[3](r.v) + '</span>' + (gap(r) ? '<span class="gp">' + esc(gap(r)) + '</span>' : '') + '</span>' +
        (ctx && ctx.owner && !me ? '<button class="pchip" data-kick="' + r.p.id + '" style="padding:3px 8px;font-size:12px">✕</button>' : '') + '</div>' +
        '<div class="water"><div class="marks"></div><div class="wake" style="width:' + (f * 100).toFixed(1) + '%;background:linear-gradient(90deg,transparent,' + c + '88)"></div><div class="boatp" style="left:max(4px, calc(' + (f * 100).toFixed(1) + '% - 74px))">' + boat(c) + '</div></div></div>'; }).join('') : '<p class="muted">No rows in this period yet.</p>') + '</div>' +
    (!ctx && profiles().length < 2 ? '<p class="muted" style="margin-top:10px">Add rowers with the name button at the top, or tap ＋ Crew to compete with your crew on their own phones.</p>' : '') + '</div>';
  // team goals
  const team = ctx ? { weekM:ctx.info.goal_m } : LS.get('sp_team', {}), n = people.length, wT = team.weekM || 20000 * n, w0 = thisWeek(), wk = people.map(x => ({ p:x.p, L:x.all.filter(s => s.start >= w0) }));
  all = people.flatMap(x => x.all);
  const tot = wk.reduce((a, r) => a + r.L.reduce((x, s) => x + s.dist, 0), 0);
  const allT = all.reduce((a, s) => a + s.dist, 0), jNext = JOURNEY.find(j => j[0] > allT), jPrev = JOURNEY.filter(j => j[0] <= allT).pop();
  let tw = 0; for(let i = 1; i < 60; i++){ const a = w0 - i * 7 * DAY; const m = all.filter(s => inRange(s, a, a + 7 * DAY)).reduce((x, s) => x + s.dist, 0); if(m >= wT) tw++; else break; }
  h += '<div class="card"><h2>Team goals</h2>' +
    '<div class="row" style="border:0;padding-bottom:4px"><span>🤝 <b>Together this week</b></span><b>' + kmTxt(tot) + ' / ' + kmTxt(wT) + '</b></div>' +
    '<div class="pbar">' + wk.map(r => { const m = r.L.reduce((x, s) => x + s.dist, 0); return '<i style="width:' + Math.min(100, m / wT * 100) + '%;background:' + (r.p.c || PCOL[0]) + '"></i>'; }).join('') + '</div>' +
    '<div class="lg">' + wk.map(r => '<span><i style="background:' + (r.p.c || PCOL[0]) + '"></i>' + esc(r.p.name) + ' ' + kmTxt(r.L.reduce((x, s) => x + s.dist, 0)) + '</span>').join('') + '</div>' +
    '<p class="muted" style="font-size:13px;margin-top:6px">Team streak: <b>' + tw + '</b> week' + (tw === 1 ? '' : 's') + ' in a row hitting the goal.</p>' +
    '<div class="row" style="border:0;padding:14px 0 4px"><span>📅 <b>Everyone rows 3 times</b></span><b>' + wk.filter(r => r.L.length >= 3).length + ' / ' + n + '</b></div>' +
    wk.map(r => '<div class="row" style="padding:4px 0;border:0"><span>' + avatar(r.p) + ' ' + esc(r.p.name) + '</span><span>' + [0, 1, 2].map(i => i < r.L.length ? '🟢' : '⚪').join('') + '</span></div>').join('') +
    '<div class="row" style="border:0;padding:14px 0 4px"><span>🗺 <b>Journey: ' + (jNext ? jNext[1] : 'Complete!') + '</b></span><b>' + kmTxt(allT) + (jNext ? ' / ' + kmTxt(jNext[0]) : '') + '</b></div>' + pbarHtml(jNext ? (allT - (jPrev ? jPrev[0] : 0)) / (jNext[0] - (jPrev ? jPrev[0] : 0)) : 1, '#ff9f1c') +
    '<p class="muted" style="font-size:13px;margin-top:6px">' + (ctx ? 'Everyone in the crew’s metres added together.' : 'All rowers’ metres added together, all time.') + (jPrev ? ' Done: ' + jPrev[1] + '.' : '') + '</p>' +
    '<div class="frm"><label>Team weekly goal (' + (imp() ? 'mi' : 'km') + ')</label><input id="tW" type="number" inputmode="decimal" value="' + (imp() ? (wT / 1609.344).toFixed(0) : wT / 1000) + '"></div></div>';
  box.innerHTML = h;
  segBind($t('bP'), BP, v => { BP = v; renderProgress(); });
  box.querySelectorAll('#bM button').forEach(b => b.onclick = () => { BM = b.dataset.v; renderProgress(); });
  $t('tW').onchange = async () => { const v = parseFloat($t('tW').value); team.weekM = v > 0 ? Math.round(v * (imp() ? 1609.344 : 1000)) : 0;
    if(ctx){ try{ await crewApi('goal', { crew:ctx.crew.id, goal_m:team.weekM }, ctx.crew); const cb = LS.get('sp_crewb_' + ctx.crew.id, null); if(cb){ cb.crew.goal_m = team.weekM; LS.set('sp_crewb_' + ctx.crew.id, cb); } toast('Team goal saved for everyone'); }catch(e){ toast('Couldn’t save — check your connection'); } }
    else LS.set('sp_team', team); renderProgress(); };
  if(ctx){ $t('crInv').onclick = () => shareInvite(ctx.crew);
    box.querySelectorAll('[data-kick]').forEach(b => b.onclick = async () => { const m = ctx.members.find(x => x.id === b.dataset.kick); if(!confirm('Remove ' + m.name + ' from ' + ctx.info.name + '?')) return; try{ await crewApi('remove', { crew:ctx.crew.id, mid:m.id }, ctx.crew); LS.del('sp_crewb_' + ctx.crew.id); renderProgress(); }catch(e){ toast('Couldn’t remove'); } }); }
}

/* ================= session detail additions ================= */
function detailExtra(id, sm, data, anchor){
  const nw = LS.get('sp_newach', null); let h = '';
  if(nw && nw.id === id) h += '<div class="newach">🏅 ' + (nw.list.length > 1 ? 'New trophies' : 'New trophy') + '!<br>' + nw.list.map(esc).join('<br>') + '</div>';
  h += improveHtml(sm, data);
  if(data.curve && data.curve.n >= 20){ const st = curveStats(data.curve.a); h += curveCardHtml('Stroke curve', st, 'Average of ' + data.curve.n + ' strokes.'); }
  const wrap = document.createElement('div'); wrap.innerHTML = h; anchor.parentNode.insertBefore(wrap, anchor);
  const cv = wrap.querySelector('.crv'); if(cv) drawCurve(cv, [curveStats(data.curve.a)]);
}

window.TRN = { checkin, showCheckin, buildCheckin, crewSheet, pushCrews, crewApi, profiles, cur, owner, mine, kg, setKg, chip, brand, profileSheet, open, renderProgress, afterSave, detailExtra, improve, makePlan, predict, fitness, shape, achieve, challenges, curveStats, align, ensure, sessionLoad };
brand(); checkJoinLink();
const autoCheck = () => { if(document.visibilityState !== 'visible' || location.hash.indexOf('#coach=') === 0) return; setTimeout(() => { try{ if(!document.querySelector('#sheet.on, .sheet.on')) checkin(false); }catch(e){} }, 1500); };
autoCheck(); document.addEventListener('visibilitychange', autoCheck); window.addEventListener('hashchange', checkJoinLink);
})();
