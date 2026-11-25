/* StrokePulse — session analytics (build __BUILD__)
   Map (speed-coloured track), calories, personal bests, segments, weather + wind, notes,
   and side-by-side comparison of 2–4 sessions. Shares the main app's globals. */
'use strict';
(function(){
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const $a = id => document.getElementById(id);
/* sample = [t, lat, lon, dist, speed m/s, rate, strokes, rest(0/1), check] */

const css = document.createElement('style');
css.textContent = `
.map{height:280px;border-radius:10px;overflow:hidden;position:relative;background:var(--bg)}
.mtype{margin-bottom:8px}
.mfoot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap}
.mfoot span{font-size:12px;font-variant-numeric:tabular-nums}
.gbtn{display:inline-block;padding:8px 12px;border-radius:10px;background:var(--acc);color:#fff;font-weight:800;font-size:14px;text-decoration:none}
.pin .pinb{width:28px;height:28px;border-radius:50% 50% 50% 0;background:#ea4335;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);margin-top:2px}
.map{height:300px}
@media (min-width:700px){.map{height:420px}}
.map .unlock{position:absolute;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;background:transparent}
.map .unlock span{background:rgba(0,0,0,.65);color:#fff;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px}
.map .done{position:absolute;right:8px;top:8px;z-index:600;display:none;background:var(--acc);color:#fff;font-weight:800;padding:8px 12px;border-radius:8px}
.legend{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--dim)}
.legend .bar{flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,#2f9bff,#2ed47a,#ffd400,#ff8c00,#ff3b30)}
.mc{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.mc button{padding:6px 10px;border-radius:999px;border:2px solid var(--mc);font-size:13px;font-weight:700;color:var(--dim);background:transparent}
.mc button.on{background:var(--mc);color:#000}
.mc button b{font-variant-numeric:tabular-nums;margin-left:3px}
.segbar{height:8px;border-radius:4px;background:var(--acc);min-width:4px}
tr.best td{color:var(--good);font-weight:800}
.wx{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:14px;color:var(--dim)}
.wx b{color:var(--fg)}
.pb{display:inline-block;background:#ffd400;color:#000;font-size:11px;font-weight:900;padding:1px 6px;border-radius:999px;margin-left:4px;vertical-align:middle}
.notes{width:100%;min-height:64px;margin-top:10px;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit;font-size:15px}
.htool{flex:1;min-width:0;height:46px;border-radius:12px;background:var(--card,var(--panel));border:1px solid var(--edge,var(--line));color:var(--fg);font-weight:800;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px}
.cmpbar{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:20;display:none;gap:8px}
.cmpbar.on{display:flex}
.cmpbar button{flex:1;height:56px;border-radius:14px;font-size:18px;font-weight:800}
.item.pick{outline:3px solid var(--acc)}
.item .tick{float:right;width:26px;height:26px;border-radius:50%;border:2px solid var(--dim);display:none;text-align:center;line-height:22px;font-weight:900}
.picking .item .tick{display:block}
.picking{padding-bottom:96px}
.item.pick .tick{background:var(--acc);border-color:var(--acc);color:#fff}
.cmphead{display:grid;gap:6px;margin-bottom:10px}
.cmphead div{border-left:5px solid var(--sc);padding:4px 8px;font-size:13px;font-weight:700;background:var(--panel);border-radius:6px}
.cmpt th,.cmpt td{font-size:14px}
.cmpt td.win{color:var(--good);font-weight:900}
`;
document.head.appendChild(css);

/* ================= numbers ================= */
const kg = () => { if(window.TRN) return TRN.kg(); const w = +S.weightKg || 0; return w >= 25 && w <= 250 ? w : 70; };
/* exercise intensity (MET) from stroke rate, falling back to boat speed — an estimate */
function met(rate, v){ if(rate >= 32) return 12.5; if(rate >= 28) return 11; if(rate >= 24) return 9.5; if(rate >= 20) return 8; if(rate >= 14) return 6; if(v > 0.8) return 4; return 2; }
function kcal(smp){ let k = 0, w = kg(); for(let i = 1; i < smp.length; i++){ const dt = Math.max(0, Math.min(5, smp[i][0] - smp[i - 1][0])); k += met(smp[i][5], smp[i][4]) * w * dt / 3600; } return k; }
/* fastest continuous stretch of D metres (time scaled to exactly D) */
function bestFor(smp, D){
  let i = 0, best = Infinity;
  for(let j = 0; j < smp.length; j++){
    while(i < j && smp[j][3] - smp[i + 1][3] >= D) i++;
    const dd = smp[j][3] - smp[i][3]; if(dd >= D){ const t = (smp[j][0] - smp[i][0]) * D / dd; if(t > 0 && t < best) best = t; }
  }
  return isFinite(best) ? best : null;
}
const BEST_D = [500, 1000, 2000];
/* stretches of continuous work (rests split them), so a best 1k never spans a rest */
function workRuns(smp){ const out = []; let cur = [], prev = null; for(const z of smp){ if(z[7]){ if(cur.length > 1) out.push(cur); cur = []; prev = z; } else { if(!cur.length && prev) cur.push(prev); cur.push(z); } } if(cur.length > 1) out.push(cur); return out; }
function bests(smp){ const o = {}, runs = workRuns(smp); for(const D of BEST_D){ let b = null; for(const r of runs){ const v = bestFor(r, D); if(v != null && (b == null || v < b)) b = v; } o[D] = b; } return o; }
/* time with rests taken out, so segments of an interval session show rowing time only */
function workClock(smp){ let off = 0, out = []; for(let i = 0; i < smp.length; i++){ const z = smp[i]; if(i && smp[i - 1][7]) off += z[0] - smp[i - 1][0]; if(z[7]) continue; const c = z.slice(); c[0] = z[0] - off; out.push(c); } return out; }
/* equal-distance segments with interpolated boundaries */
function segments(smp, len){
  smp = workClock(smp); const out = []; if(smp.length < 2) return out;
  const at = (d) => { for(let i = 1; i < smp.length; i++) if(smp[i][3] >= d){ const a = smp[i - 1], b = smp[i], f = b[3] > a[3] ? (d - a[3]) / (b[3] - a[3]) : 0; return { t:a[0] + (b[0] - a[0]) * f, n:a[6] + (b[6] - a[6]) * f }; } return null; };
  const total = smp[smp.length - 1][3]; let prev = { t:smp[0][0], n:smp[0][6] }, from = 0;
  for(let d = len; d <= total + 0.001; d += len){ const p = at(d); if(!p) break; const t = p.t - prev.t, n = p.n - prev.n; out.push({ from, to:d, t, split:t > 0 ? (+S.splitBase) * t / len : null, rate:t > 0 ? n / t * 60 : 0, dps:n > 0 ? len / n : 0 }); prev = p; from = d; }
  const rem = total - from; if(rem >= len * 0.3){ const last = smp[smp.length - 1], t = last[0] - prev.t, n = last[6] - prev.n; out.push({ from, to:total, t, split:t > 0 ? (+S.splitBase) * t / rem : null, rate:t > 0 ? n / t * 60 : 0, dps:n > 0 ? rem / n : 0, partial:true }); }
  return out;
}
/* overall stats for one session */
function summary(sm, data){
  const smp = data.samples || [], T = sm.time || (smp.length ? smp[smp.length - 1][0] : 0);
  const b = bests(smp), k = kcal(smp), work = smp.filter(s => !s[7]);
  const wl = (data.laps || []).filter(l => l.type === 'work'), wt = wl.reduce((a, l) => a + l.t, 0), wd = wl.reduce((a, l) => a + l.d, 0);
  return { T, dist:sm.dist, strokes:sm.strokes, avgSplit:wd > 5 ? (+S.splitBase) * wt / wd : T > 0 && sm.dist > 5 ? (+S.splitBase) * T / sm.dist : null, workOnly:wd > 5, avgRate:T > 0 ? sm.strokes / T * 60 : 0,
    dps:sm.strokes > 0 ? sm.dist / sm.strokes : 0, kcal:k, bests:b, steady:steadiness(data), maxRate:Math.max(0, ...work.map(s => s[5])), maxV:Math.max(0, ...work.map(s => s[4])) };
}
const fs = s => s == null || !isFinite(s) ? '–' : fmtTime(s, true);
const dpsTxt = v => !v ? '–' : (imp() ? (v * 3.28084).toFixed(1) + ' ft' : v.toFixed(1) + ' m');

/* ================= personal bests (cached on each History summary) ================= */
function ensureCache(){
  const idx = LS.get('sp_index', []); let changed = false;
  for(const s of idx){
    if(s.cv === 3) continue;
    const data = LS.get('sp_s_' + s.id, null); if(!data) continue;
    const b = bests(data.samples || []); s.b500 = b[500]; s.b1k = b[1000]; s.b2k = b[2000]; s.kcal = Math.round(kcal(data.samples || [])); s.cv = 3; changed = true;
  }
  if(changed) LS.set('sp_index', idx);
  const pb = { b500:null, b1k:null, b2k:null };
  for(const s of idx.filter(x => !window.TRN || TRN.mine(x))) for(const k of Object.keys(pb)) if(s[k] && (!pb[k] || s[k] < pb[k].v)) pb[k] = { v:s[k], id:s.id };
  return { idx, pb };
}
function pbBadges(s, pb){ const out = []; if(pb.b500 && pb.b500.id === s.id) out.push('PB 500m'); if(pb.b1k && pb.b1k.id === s.id) out.push('PB 1k'); if(pb.b2k && pb.b2k.id === s.id) out.push('PB 2k'); return out.map(t => '<span class="pb">' + t + '</span>').join(''); }

/* ================= weather + wind ================= */
const WX = { 0:'Clear', 1:'Mostly clear', 2:'Partly cloudy', 3:'Cloudy', 45:'Fog', 48:'Fog', 51:'Drizzle', 53:'Drizzle', 55:'Drizzle', 56:'Freezing drizzle', 57:'Freezing drizzle', 61:'Light rain', 63:'Rain', 65:'Heavy rain', 66:'Freezing rain', 67:'Freezing rain', 71:'Light snow', 73:'Snow', 75:'Heavy snow', 77:'Snow', 80:'Showers', 81:'Showers', 82:'Heavy showers', 85:'Snow showers', 86:'Snow showers', 95:'Thunderstorm', 96:'Thunderstorm', 99:'Thunderstorm' };
async function fetchWeather(sm, data, at){
  const p = at ? [0, at[0], at[1]] : (data.samples || []).find(s => s[1] != null); if(!p) return null;
  const day = new Date(sm.start), ds = day.getFullYear() + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate());
  const old = Date.now() - sm.start > 80 * 864e5;
  const url = 'https://' + (old ? 'archive-api' : 'api') + '.open-meteo.com/v1/' + (old ? 'archive' : 'forecast') + '?latitude=' + p[1].toFixed(4) + '&longitude=' + p[2].toFixed(4) +
    '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&start_date=' + ds + '&end_date=' + ds + '&timezone=auto&wind_speed_unit=kmh';
  const r = await fetch(url); if(!r.ok) throw new Error('wx ' + r.status); const j = await r.json(); const h = j.hourly; if(!h || !h.time) return null;
  const mid = sm.start + (sm.time || 0) * 500, local = new Date(mid + (j.utc_offset_seconds || 0) * 1000).toISOString().slice(0, 13);
  let i = h.time.findIndex(t => t.slice(0, 13) === local); if(i < 0) i = 0;
  return { t:h.temperature_2m[i], ws:h.wind_speed_10m[i], wg:h.wind_gusts_10m[i], wd:h.wind_direction_10m[i], code:h.weather_code[i], at:[+p[1].toFixed(5), +p[2].toFixed(5)] };
}
/* overall direction of travel (degrees) — null if the course doubles back */
function heading(smp){
  const pts = smp.filter(s => s[1] != null && !s[7]); let x = 0, y = 0, n = 0;
  for(let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i]; const dy = b[1] - a[1], dx = (b[2] - a[2]) * Math.cos(a[1] * Math.PI / 180); const m = Math.hypot(dx, dy); if(m < 2e-6) continue; x += dx / m; y += dy / m; n++; }
  if(!n || Math.hypot(x, y) / n < 0.45) return null;
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}
function windText(wx, smp){
  if(!wx || wx.ws == null) return '';
  const spd = S.units === 'imperial' ? Math.round(wx.ws * 0.6214) + ' mph' : Math.round(wx.ws) + ' km/h';
  if(wx.ws < 4) return 'Calm';
  const hd = heading(smp); if(hd == null) return spd + ' wind (out-and-back course)';
  const diff = Math.abs(((wx.wd - hd) % 360 + 540) % 360 - 180);   // 0 = wind blowing from straight ahead
  const side = (((wx.wd - hd) % 360) + 360) % 360 < 180 ? 'starboard' : 'port';
  return diff < 45 ? spd + ' headwind' : diff > 135 ? spd + ' tailwind' : spd + ' crosswind (from ' + side + ')';
}
function wxHtml(wx, smp){
  if(!wx) return '';
  const temp = S.units === 'imperial' ? Math.round(wx.t * 9 / 5 + 32) + '°F' : Math.round(wx.t) + '°C';
  return '<div class="wx"><span>🌡 <b>' + temp + '</b></span><span>' + esc(WX[wx.code] || '') + '</span><span>💨 <b>' + esc(windText(wx, smp)) + '</b></span>' +
    (wx.wg ? '<span>gusts ' + (S.units === 'imperial' ? Math.round(wx.wg * 0.6214) + ' mph' : Math.round(wx.wg) + ' km/h') + '</span>' : '') + (wx.at ? '<span style="font-size:12px">at 📍 ' + wx.at[0].toFixed(4) + ', ' + wx.at[1].toFixed(4) + '</span>' : '') + '</div>';
}

/* ================= map ================= */
let leafletP = null;
function leaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(leafletP) return leafletP;
  leafletP = new Promise((ok, bad) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/leaflet.css?v=__BUILD__'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = '/leaflet.js?v=__BUILD__'; s.onload = () => ok(window.L); s.onerror = () => { leafletP = null; bad(new Error('map')); }; document.head.appendChild(s);
  });
  return leafletP;
}
const RAMP = ['#2f9bff', '#2ed47a', '#ffd400', '#ff8c00', '#ff3b30'];
const SESS = ['#2f9bff', '#ff8c00', '#2ed47a', '#e879f9'];
let MAP = null;   // the detail page's map, so the cox replay can move the boat dot

/* Google Maps when the site has a key (from /api/config); otherwise the built-in map. Both offer Map / Satellite / Hybrid. */
let gkeyP = null, gmP = null;
function gkey(){
  if(gkeyP) return gkeyP;
  gkeyP = (async () => { let k = LS.get('sp_gkey', null); if(navigator.onLine && location.protocol === 'https:'){ try{ const r = await fetch('/api/config', { cache:'no-store' }); if(r.ok){ k = (await r.json()).gmaps || null; LS.set('sp_gkey', k); } }catch(e){} } return k; })();
  return gkeyP;
}
window.gm_authFailure = () => { LS.set('sp_gbad', Date.now()); toast('Google map key not accepted — showing the standard map'); };
function gmaps(key){
  if(window.google && google.maps && google.maps.Map) return Promise.resolve(google.maps);
  if(gmP) return gmP;
  gmP = new Promise((ok, bad) => {
    window.__spGm = () => ok(google.maps);
    const s = document.createElement('script'); s.async = true; s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=__spGm&v=weekly';
    s.onerror = () => { gmP = null; bad(new Error('gmaps')); }; document.head.appendChild(s);
    setTimeout(() => { if(!(window.google && google.maps && google.maps.Map)){ gmP = null; bad(new Error('gmaps timeout')); } }, 12000);
  });
  return gmP;
}
const MTYPES = [['roadmap', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid']];
const gUrl = (lat, lon) => 'https://www.google.com/maps/search/?api=1&query=' + lat.toFixed(6) + '%2C' + lon.toFixed(6);
/* speed-coloured stretches of one track, joined into as few lines as possible */
function speedRuns(t){
  const vs = t.filter(p => !p[7] && p[4] > 0.5).map(p => p[4]).sort((a, b) => a - b);
  const lo = vs[Math.floor(vs.length * 0.05)] || 0, hi = vs[Math.floor(vs.length * 0.95)] || 1, runs = [];
  for(let i = 1; i < t.length; i++){ const a = t[i - 1], b = t[i], f = Math.max(0, Math.min(0.999, (b[4] - lo) / ((hi - lo) || 1))), c = b[7] ? 'rest' : RAMP[Math.floor(f * RAMP.length)];
    const last = runs[runs.length - 1]; if(last && last.c === c) last.pts.push([b[1], b[2]]); else runs.push({ c, pts:[[a[1], a[2]], [b[1], b[2]]] }); }
  return { runs, lo, hi };
}
async function drawMap(el, sessions, opts){
  opts = opts || {};
  const tracks = sessions.map(s => (s.samples || []).filter(p => p[1] != null));
  if(!tracks.some(t => t.length > 1)){ el.closest('.card').style.display = 'none'; return null; }
  // view switch above the map, location + Google Maps button below it
  let type = LS.get('sp_mtype', 'roadmap'); if(!MTYPES.some(m => m[0] === type)) type = 'roadmap';
  const bar = document.createElement('div'); bar.className = 'seg mtype'; bar.innerHTML = MTYPES.map(m => '<button data-v="' + m[0] + '">' + m[1] + '</button>').join(''); el.parentNode.insertBefore(bar, el);
  const foot = document.createElement('div'); foot.className = 'mfoot'; foot.innerHTML = '<span class="muted" id="' + el.id + 'Loc"></span><a class="gbtn" target="_blank" rel="noopener">Open in Google Maps ↗</a>'; el.after(foot);
  const first = tracks.find(t => t.length > 1)[0]; let sel = opts.sel || [first[1], first[2]];
  const showSel = () => { foot.querySelector('span').textContent = '📍 ' + sel[0].toFixed(5) + ', ' + sel[1].toFixed(5) + (opts.onSelect ? ' · tap the map to move' : ''); foot.querySelector('a').href = gUrl(sel[0], sel[1]); };
  showSel();
  let M = null;
  const key = LS.get('sp_gbad', 0) > Date.now() - 864e5 ? null : await gkey();
  if(key && navigator.onLine){ try{ M = await googleMap(el, tracks, sessions.length, type, sel, opts); }catch(e){ M = null; el.innerHTML = ''; } }
  if(!M){ try{ M = await leafletMap(el, tracks, sessions.length, type, sel, opts); }catch(e){ el.innerHTML = '<canvas style="width:100%;height:100%" height="280"></canvas>'; try{ drawTrack(el.firstChild, sessions[0].samples || []); }catch(_){} bar.style.display = 'none'; return null; } }
  if(!el.isConnected) return null;
  segBind(bar, type, v => { type = v; LS.set('sp_mtype', v); M.setType(v); });
  M.onPick = (lat, lon) => { sel = [lat, lon]; M.select(lat, lon); showSel(); if(opts.onSelect) opts.onSelect(lat, lon); };
  M.track = tracks[0];
  return M;
}
async function googleMap(el, tracks, nSess, type, sel, opts){
  const gm = await gmaps(await gkey()); if(!el.isConnected) return null;
  el.innerHTML = '';
  const map = new gm.Map(el, { mapTypeId:type, gestureHandling:'cooperative', disableDefaultUI:true, zoomControl:true, fullscreenControl:true, clickableIcons:false, tilt:0 });
  const bounds = new gm.LatLngBounds(), ll = p => ({ lat:p[0], lng:p[1] });
  if(nSess === 1){ const SR = speedRuns(tracks[0]); for(const r of SR.runs) new gm.Polyline({ map, path:r.pts.map(ll), strokeColor:r.c === 'rest' ? '#8a97a6' : r.c, strokeOpacity:r.c === 'rest' ? 0.7 : 1, strokeWeight:r.c === 'rest' ? 3 : 5 });
    if(opts.legendEl) opts.legendEl.innerHTML = '<span>' + fs(SR.lo > 0 ? (+S.splitBase) / SR.lo : null) + '</span><span class="bar"></span><span>' + fs((+S.splitBase) / SR.hi) + '</span>'; }
  else tracks.forEach((t, k) => { if(t.length > 1) new gm.Polyline({ map, path:t.map(p => ({ lat:p[1], lng:p[2] })), strokeColor:SESS[k], strokeWeight:4, strokeOpacity:.95 }); });
  tracks.forEach(t => t.forEach(p => bounds.extend({ lat:p[1], lng:p[2] })));
  const dotIcon = (c, r) => ({ path:gm.SymbolPath.CIRCLE, scale:r, fillColor:c, fillOpacity:1, strokeColor:'#fff', strokeWeight:2 });
  tracks.forEach(t => { if(t.length < 2) return; const e = t[t.length - 1]; new gm.Marker({ map, position:{ lat:e[1], lng:e[2] }, icon:dotIcon('#ff4d4f', 7), title:'Finish', zIndex:5 }); });
  const pin = new gm.Marker({ map, position:ll(sel), title:'Selected location', zIndex:10 });
  map.fitBounds(bounds, 24);
  map.addListener('click', e => M.onPick && M.onPick(e.latLng.lat(), e.latLng.lng()));
  let dot = null, callMk = [];
  const M = { kind:'google', map,
    setType:t => map.setMapTypeId(t),
    select:(a, b) => { pin.setPosition({ lat:a, lng:b }); map.panTo({ lat:a, lng:b }); },
    dot:(a, b) => { if(!dot) dot = new gm.Marker({ map, position:{ lat:a, lng:b }, icon:dotIcon('#ffffff', 8), zIndex:20, clickable:false }); else dot.setPosition({ lat:a, lng:b }); },
    setCalls:list => { callMk.forEach(m => m.setMap(null)); callMk = list.map(c => new gm.Marker({ map, position:{ lat:c.lat, lng:c.lon }, icon:dotIcon(c.c, 5), title:c.text, zIndex:8 })); } };
  return M;
}
async function leafletMap(el, tracks, nSess, type, sel, opts){
  const L = await leaflet(); if(!el.isConnected) return null;
  el.innerHTML = '';
  const map = L.map(el, { zoomControl:true, attributionControl:true, dragging:false, touchZoom:false, scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false, tap:false });
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const layers = {
    roadmap:[L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' })],
    satellite:[L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Imagery © Esri' })],
    hybrid:[L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Imagery © Esri' }), L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 })] };
  let cur = null; const setType = t => { if(cur) cur.forEach(l => map.removeLayer(l)); cur = layers[t] || layers.roadmap; cur.forEach(l => l.addTo(map)); };
  setType(type);
  const all = [];
  if(nSess === 1){ const SR = speedRuns(tracks[0]); for(const r of SR.runs){ L.polyline(r.pts, r.c === 'rest' ? { color:'#8a97a6', weight:4, dashArray:'4 6' } : { color:r.c, weight:5 }).addTo(map); all.push(...r.pts); }
    if(opts.legendEl) opts.legendEl.innerHTML = '<span>' + fs(SR.lo > 0 ? (+S.splitBase) / SR.lo : null) + '</span><span class="bar"></span><span>' + fs((+S.splitBase) / SR.hi) + '</span>'; }
  else tracks.forEach((t, k) => { if(t.length < 2) return; const ll = t.map(p => [p[1], p[2]]); L.polyline(ll, { color:SESS[k], weight:4, opacity:.9 }).addTo(map); all.push(...ll); });
  tracks.forEach(t => { if(t.length < 2) return; const e = t[t.length - 1]; L.circleMarker([e[1], e[2]], { radius:6, color:'#fff', weight:2, fillColor:'#ff4d4f', fillOpacity:1 }).addTo(map).bindTooltip('Finish'); });
  const pin = L.marker(sel, { icon:L.divIcon({ className:'pin', html:'<div class="pinb"></div>', iconSize:[28, 38], iconAnchor:[14, 36] }), zIndexOffset:1000 }).addTo(map);
  map.fitBounds(L.latLngBounds(all), { padding:[18, 18] });
  // tap to move/zoom; "Done" goes back to scrolling the page
  const lock = document.createElement('div'); lock.className = 'unlock'; lock.innerHTML = '<span>Tap to move &amp; zoom the map</span>'; el.appendChild(lock);
  const done = document.createElement('button'); done.className = 'done'; done.textContent = 'Done'; el.appendChild(done);
  const on = v => { ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom'].forEach(h => map[h][v ? 'enable' : 'disable']()); lock.style.display = v ? 'none' : 'flex'; done.style.display = v ? 'block' : 'none'; };
  lock.onclick = e => { e.stopPropagation(); on(true); }; done.onclick = e => { e.stopPropagation(); on(false); };
  map.on('click', e => M.onPick && M.onPick(e.latlng.lat, e.latlng.lng));
  let dot = null; const calls = L.layerGroup().addTo(map);
  const M = { kind:'leaflet', map, setType,
    select:(a, b) => pin.setLatLng([a, b]),
    dot:(a, b) => { if(!dot) dot = L.circleMarker([a, b], { radius:8, color:'#000', weight:2, fillColor:'#fff', fillOpacity:1 }).addTo(map); else dot.setLatLng([a, b]); },
    setCalls:list => { calls.clearLayers(); list.forEach(c => L.circleMarker([c.lat, c.lon], { radius:5, color:'#000', weight:1, fillColor:c.c, fillOpacity:1 }).bindTooltip(esc(c.text)).addTo(calls)); } };
  return M;
}
function mapCursor(t){
  if(!MAP || !MAP.track || !MAP.track.length) return;
  let p = MAP.track[0]; for(const q of MAP.track){ if(q[0] > t) break; p = q; }
  MAP.dot(p[1], p[2]);
}
function mapCalls(calls){
  if(!MAP || !MAP.track) return; const out = [];
  for(const c of calls){ let p = null; for(const q of MAP.track){ if(q[0] > c.t) break; p = q; } if(p) out.push({ lat:p[1], lon:p[2], c:c.cat.c, text:c.text }); }
  MAP.setCalls(out);
}

/* ================= chart along distance ================= */
const MEAS = [
  { k:'split', lab:'Split', c:'#2f9bff', flip:true, get:z => z[4] > 0.5 ? (+S.splitBase) / z[4] : null, fmt:v => fmtTime(v, true) },
  { k:'speed', lab:'Speed', c:'#2ed47a', get:z => z[4] > 0.2 ? z[4] : null, fmt:v => fmtSpeed(v) + speedUnit() },
  { k:'rate', lab:'Rate', c:'#ffb020', get:z => z[5] > 0 ? z[5] : null, fmt:v => v.toFixed(1) },
  { k:'dps', lab:'Dist/stroke', c:'#a78bfa', get:z => z[5] > 8 && z[4] > 0.5 ? z[4] / (z[5] / 60) : null, fmt:v => dpsTxt(v) },
  { k:'kcal', lab:'Effort', c:'#ff6b6b', get:z => met(z[5], z[4]), fmt:v => v.toFixed(1) + ' MET' }
];
function smooth(smp, m){
  const raw = smp.map(z => { const v = z[7] ? null : m.get(z); return v == null || !isFinite(v) ? null : v; });
  return raw.map((v, i) => { if(v == null) return null; let a = 0, n = 0; for(let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) if(raw[j] != null){ a += raw[j]; n++; } return a / n; });
}
function niceStep(total){ for(const st of [50, 100, 250, 500, 1000, 2000, 5000]) if(total / st <= 8) return st; return 10000; }
function canvasFit(c){ const r = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; if(c.width !== Math.round(w * r) || c.height !== Math.round(h * r)){ c.width = Math.round(w * r); c.height = Math.round(h * r); } const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h); return [x, w, h]; }
/* single session: several measures at once. several sessions: one measure, one line per session */
function chart(el, sessions, opts){
  const multi = sessions.length > 1, key = multi ? 'sp_cmpm' : 'sp_chartm';
  let pick = LS.get(key, multi ? ['split'] : ['split', 'rate']); if(multi && pick.length !== 1) pick = ['split'];
  el.innerHTML = '<canvas style="width:100%;height:200px;display:block"></canvas><div class="mc">' + MEAS.map(m => '<button data-m="' + m.k + '" style="--mc:' + m.c + '">' + m.lab + '</button>').join('') + '</div>' +
    '<p class="muted">' + (multi ? 'Each line is one session, along the distance rowed. Pick what to compare.' : 'Along the distance rowed. Tap the buttons to choose the lines (split is drawn so higher = faster).') + '</p>';
  const c = el.querySelector('canvas');
  const series = sessions.map(s => { const o = {}; for(const m of MEAS) o[m.k] = smooth(s.samples || [], m); return o; });
  const draw = () => {
    const [x, w, h] = canvasFit(c); const total = Math.max(1, ...sessions.map(s => { const a = s.samples || []; return a.length ? a[a.length - 1][3] : 0; }));
    const L = 8, R = w - 8, TOP = 10, BOT = h - 22, X = d => L + (R - L) * Math.max(0, Math.min(1, d / total));
    const step = niceStep(total); x.font = '11px -apple-system,sans-serif'; x.textAlign = 'center'; x.lineWidth = 1;
    for(let d = 0; d <= total + 0.01; d += step){ const px = X(d); x.strokeStyle = cssVar('--line'); x.beginPath(); x.moveTo(px, TOP); x.lineTo(px, BOT); x.stroke(); x.fillStyle = cssVar('--dim'); x.fillText(fmtDist(d) + (d === 0 ? '' : distUnit(d)), Math.min(R - 14, Math.max(L + 8, px)), h - 6); }
    for(const m of MEAS){ if(!pick.includes(m.k)) continue;
      const vals = []; series.forEach(sr => sr[m.k].forEach(v => { if(v != null) vals.push(v); })); vals.sort((a, b) => a - b); if(!vals.length) continue;
      let lo = vals[Math.floor(vals.length * 0.03)], hi = vals[Math.floor(vals.length * 0.97)]; if(hi - lo < 1e-6){ lo -= 1; hi += 1; } const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
      sessions.forEach((s, k) => { const smp = s.samples || [], sr = series[k][m.k];
        x.strokeStyle = multi ? SESS[k] : m.c; x.lineWidth = 2.2; x.lineJoin = 'round'; x.beginPath(); let on = false;
        smp.forEach((z, i) => { const v = sr[i]; if(v == null){ on = false; return; } let f = (v - lo) / (hi - lo); if(m.flip) f = 1 - f; const px = X(z[3]), py = BOT - Math.max(0, Math.min(1, f)) * (BOT - TOP); if(!on){ x.moveTo(px, py); on = true; } else x.lineTo(px, py); });
        x.stroke(); });
    }
  };
  const paint = () => el.querySelectorAll('.mc button').forEach(b => b.classList.toggle('on', pick.includes(b.dataset.m)));
  el.querySelectorAll('.mc button').forEach(b => b.onclick = () => { const k = b.dataset.m; pick = multi ? [k] : (pick.includes(k) ? pick.filter(q => q !== k) : pick.concat(k)); LS.set(key, pick); paint(); draw(); });
  paint(); draw();
  window.addEventListener('resize', () => { if(c.isConnected) draw(); });
}

/* ================= segments ================= */
function segCard(el, smp){
  const lens = imp() ? [[402.336, '¼ mi'], [804.672, '½ mi'], [1609.344, '1 mi']] : [[100, '100 m'], [250, '250 m'], [500, '500 m'], [1000, '1 km']];
  let len = LS.get('sp_seglen', imp() ? 402.336 : 500); if(!lens.some(l => l[0] === len)) len = lens[imp() ? 0 : 2][0];
  const draw = () => {
    const sg = segments(smp, len); const full = sg.filter(s => !s.partial && s.split), best = full.length ? Math.min(...full.map(s => s.split)) : null, worst = full.length ? Math.max(...full.map(s => s.split)) : null;
    el.innerHTML = '<h2>Segments</h2><div class="seg" id="segLen">' + lens.map(l => '<button data-v="' + l[0] + '">' + l[1] + '</button>').join('') + '</div>' +
      (sg.length ? '<table style="margin-top:10px"><tr><th>To</th><th>Time</th><th>Split</th><th style="width:30%"></th><th>Rate</th><th>DPS</th></tr>' +
        sg.map(s => { const f = s.split && best && worst > best ? 1 - (s.split - best) / (worst - best) * 0.8 : 1; return '<tr class="' + (s.split === best && !s.partial ? 'best' : '') + '"><td>' + fmtDist(s.to) + distUnit(s.to) + (s.partial ? '*' : '') + '</td><td>' + fmtTime(s.t) + '</td><td>' + fs(s.split) + '</td><td><div class="segbar" style="width:' + Math.round(f * 100) + '%"></div></td><td>' + s.rate.toFixed(1) + '</td><td>' + (s.dps ? s.dps.toFixed(1) : '–') + '</td></tr>'; }).join('') +
        '</table><p class="muted" style="margin-top:6px">Green = fastest segment. Longer bar = faster.' + (sg.some(s => s.partial) ? ' * = last part, shorter than a full segment.' : '') + '</p>'
        : '<p class="muted" style="margin-top:10px">Not enough distance for this segment length.</p>');
    segBind(el.querySelector('#segLen'), String(len), v => { len = +v; LS.set('sp_seglen', len); draw(); });
  };
  draw();
}

/* ================= consistency ================= */
/* how steady split and rate were while working (skips the first 15 s of each stretch) */
function steadyStats(smp, ranges){
  const sp = [], rt = [];
  const v5 = smp.map((z, i) => { let a = 0, n = 0; for(let j = Math.max(0, i - 2); j <= Math.min(smp.length - 1, i + 2); j++){ a += smp[j][4]; n++; } return a / n; });
  for(const [a, b] of ranges){ for(let i = 0; i < smp.length; i++){ const z = smp[i]; if(z[0] < a + 15 || z[0] > b || z[7] || v5[i] < 1) continue; sp.push((+S.splitBase) / v5[i]); if(z[5] > 8) rt.push(z[5]); } }
  if(sp.length < 20) return null;
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
  const sdS = sd(sp), sdR = rt.length > 10 ? sd(rt) : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - 6 * sdS - 8 * sdR)));
  return { score, sdS, sdR };
}
const steadyWord = s => s >= 85 ? 'Very steady' : s >= 70 ? 'Steady' : s >= 50 ? 'Up and down' : 'Uneven';
function workRanges(data){
  const smp = data.samples || [], w = (data.laps || []).filter(l => l.type === 'work');
  if(w.length) return w.map(l => [l.at - l.t, l.at]);
  const out = []; let st = null; for(const z of smp){ if(!z[7] && st == null) st = z[0]; if(z[7] && st != null){ out.push([st, z[0]]); st = null; } }
  if(st != null && smp.length) out.push([st, smp[smp.length - 1][0]]);
  return out;
}
function steadiness(data){ return steadyStats(data.samples || [], workRanges(data)); }

/* ================= pieces ================= */
function distAtT(smp, t){ let p = null; for(const z of smp){ if(z[0] > t) break; p = z; } return p ? p[3] : 0; }
function timeAtD(smp, d){ for(let i = 1; i < smp.length; i++) if(smp[i][3] >= d){ const a = smp[i - 1], b = smp[i], f = b[3] > a[3] ? (d - a[3]) / (b[3] - a[3]) : 0; return a[0] + (b[0] - a[0]) * f; } return null; }
function pieces(data){
  const smp = data.samples || [];
  return (data.laps || []).filter(l => l.type === 'work' && l.t > 0).map(l => {
    const t0 = l.at - l.t, d0 = distAtT(smp, t0), mid = d0 + l.d / 2, tm = timeAtD(smp, mid);
    let h1 = null, h2 = null;
    if(tm != null && l.d > 60 && tm > t0 && tm < l.at){ h1 = (+S.splitBase) * (tm - t0) / (l.d / 2); h2 = (+S.splitBase) * (l.at - tm) / (l.d / 2); }
    const st = steadyStats(smp, [[t0, l.at]]);
    return { rep:l.rep, t:l.t, d:l.d, s:l.s, split:l.d > 5 ? (+S.splitBase) * l.t / l.d : null, rate:l.rate || (l.t > 0 ? l.s / l.t * 60 : 0), dps:l.s > 0 ? l.d / l.s : 0, h1, h2, steady:st ? st.score : null, partial:!!l.partial };
  });
}
function piecesCard(el, data){
  const P = pieces(data); if(!P.length){ el.remove(); return; }
  const full = P.filter(p => !p.partial && p.split), best = full.length ? Math.min(...full.map(p => p.split)) : null, worst = full.length ? Math.max(...full.map(p => p.split)) : null;
  const first = full[0], last = full[full.length - 1];
  let msg = '';
  if(full.length >= 2){ const f = last.split - first.split;
    msg = Math.abs(f) < 0.5 ? 'Held pace from first piece to last (' + sgn1(f) + ' s).' : f > 0 ? 'Faded ' + f.toFixed(1) + ' s' + splitLabel() + ' from piece ' + first.rep + ' to piece ' + last.rep + '.' : 'Got faster: ' + (-f).toFixed(1) + ' s' + splitLabel() + ' quicker by the last piece.'; }
  el.innerHTML = '<h2>Piece comparison</h2>' + (msg ? '<p style="margin-bottom:8px"><b>' + msg + '</b></p>' : '') +
    '<table><tr><th>#</th><th>Split</th><th style="width:22%"></th><th>Rate</th><th>DPS</th><th>2nd half</th><th>Steady</th></tr>' +
    P.map(p => { const f = p.split && best && worst > best ? 1 - (p.split - best) / (worst - best) * 0.8 : 1;
      const fade = p.h1 && p.h2 ? p.h2 - p.h1 : null;
      return '<tr class="' + (p.split === best && !p.partial && full.length > 1 ? 'best' : '') + '"><td>P' + p.rep + (p.partial ? '*' : '') + '</td><td>' + fs(p.split) + '</td><td><div class="segbar" style="width:' + Math.round(f * 100) + '%"></div></td><td>' + p.rate.toFixed(1) + '</td><td>' + (p.dps ? p.dps.toFixed(1) : '–') + '</td>' +
        '<td style="color:' + (fade == null ? 'var(--dim)' : fade > 1 ? 'var(--bad)' : fade < -1 ? 'var(--good)' : 'var(--fg)') + '">' + (fade == null ? '–' : sgn1(fade) + 's') + '</td><td>' + (p.steady == null ? '–' : p.steady) + '</td></tr>'; }).join('') +
    '</table><p class="muted" style="margin-top:6px">Green = fastest piece. 2nd half = how much slower (+) or faster (−) the second half of each piece was. Steady = 0–100, how even split and rate were.' + (P.some(p => p.partial) ? ' * = stopped early.' : '') + '</p>';
}
const sgn1 = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1);

/* ================= split vs rate ================= */
function rateCurve(list){
  const bins = {};
  for(const smp of list){
    const v5 = smp.map((z, i) => { let a = 0, n = 0; for(let j = Math.max(0, i - 2); j <= Math.min(smp.length - 1, i + 2); j++){ a += smp[j][4]; n++; } return a / n; });
    smp.forEach((z, i) => { if(z[7] || z[0] < 10 || v5[i] < 1 || z[5] < 14 || z[5] > 50) return; const k = Math.round(z[5]); const b = bins[k] || (bins[k] = { r:k, n:0, v:0 }); b.n++; b.v += v5[i]; });
  }
  const pts = Object.values(bins).filter(b => b.n >= 5).map(b => ({ r:b.r, n:b.n, v:b.v / b.n, split:(+S.splitBase) / (b.v / b.n), dps:(b.v / b.n) / (b.r / 60) })).sort((a, b) => a.r - b.r);
  if(pts.length < 3) return { pts, slope:null };
  let W = 0, mx = 0, my = 0; for(const p of pts){ W += p.n; mx += p.n * p.r; my += p.n * p.split; } mx /= W; my /= W;
  let sxy = 0, sxx = 0; for(const p of pts){ sxy += p.n * (p.r - mx) * (p.split - my); sxx += p.n * (p.r - mx) * (p.r - mx); }
  const slope = sxx > 0 ? sxy / sxx : null;
  return { pts, slope, icpt:my - (slope || 0) * mx, lo:pts[0].r, hi:pts[pts.length - 1].r };
}
function rateCard(el, smpThis){
  let mode = 'this';
  const draw = () => {
    let list = [smpThis];
    if(mode === 'all'){ list = LS.get('sp_index', []).slice(0, 30).map(s => (LS.get('sp_s_' + s.id, null) || {}).samples).filter(Boolean); }
    const C = rateCurve(list);
    let msg;
    if(C.slope == null || C.hi - C.lo < 4) msg = 'Not enough spread of stroke rates yet. Row a few minutes at different rates (say 20, 24, 28, 32) to measure this.';
    else if(C.slope >= 0) msg = 'Going up in rate did not make the boat faster here (' + C.lo + '–' + C.hi + ' spm). The crew loses length as the rate rises — work on keeping the stroke long.';
    else msg = 'Each extra stroke per minute bought about <b>' + (-C.slope).toFixed(1) + ' s' + splitLabel() + '</b> between ' + C.lo + ' and ' + C.hi + ' spm.';
    el.innerHTML = '<h2>Split vs rate</h2><div class="seg" id="srMode"><button data-v="this">This session</button><button data-v="all">All sessions</button></div>' +
      '<canvas style="width:100%;height:190px;display:block;margin-top:10px"></canvas><p style="margin-top:8px">' + msg + '</p>' +
      (C.pts.length ? '<table style="margin-top:8px"><tr><th>Rate</th><th>Split</th><th>DPS</th><th>Time at it</th></tr>' + C.pts.map(p => '<tr><td>' + p.r + '</td><td>' + fs(p.split) + '</td><td>' + dpsTxt(p.dps) + '</td><td>' + fmtTime(p.n) + '</td></tr>').join('') + '</table>' : '') +
      '<p class="muted" style="margin-top:6px">Dots = average split at each rate (bigger = more time spent there). The line is the trend. Flat line = extra rate is wasted.</p>';
    segBind(el.querySelector('#srMode'), mode, v => { mode = v; draw(); });
    const c = el.querySelector('canvas'); if(!C.pts.length) { c.style.display = 'none'; return; }
    const [x, w, h] = canvasFit(c), L = 40, R = w - 10, T = 10, B = h - 22;
    const rs = C.pts.map(p => p.r), sp = C.pts.map(p => p.split); let r0 = Math.min(...rs) - 1, r1 = Math.max(...rs) + 1, s0 = Math.min(...sp), s1 = Math.max(...sp); const pd = Math.max(1, (s1 - s0) * 0.15); s0 -= pd; s1 += pd;
    const X = r => L + (R - L) * (r - r0) / (r1 - r0), Y = s => T + (B - T) * (s - s0) / (s1 - s0);   // faster split drawn higher
    x.font = '11px -apple-system,sans-serif'; x.fillStyle = cssVar('--dim'); x.strokeStyle = cssVar('--line'); x.lineWidth = 1;
    for(let r = Math.ceil(r0); r <= r1; r += 2){ x.textAlign = 'center'; x.fillText(r, X(r), h - 6); }
    for(const s of [s0 + pd, (s0 + s1) / 2, s1 - pd]){ x.textAlign = 'right'; x.fillText(fmtTime(s, true), L - 4, Y(s) + 4); x.beginPath(); x.moveTo(L, Y(s)); x.lineTo(R, Y(s)); x.stroke(); }
    const mxN = Math.max(...C.pts.map(p => p.n));
    for(const p of C.pts){ x.fillStyle = '#2f9bff'; x.beginPath(); x.arc(X(p.r), Y(p.split), 3 + 6 * Math.sqrt(p.n / mxN), 0, 7); x.fill(); }
    if(C.slope != null){ x.strokeStyle = '#ffb020'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(C.lo), Y(C.icpt + C.slope * C.lo)); x.lineTo(X(C.hi), Y(C.icpt + C.slope * C.hi)); x.stroke(); }
  };
  draw();
}

/* ================= same workout over time ================= */
function sameWorkout(sm, data){
  const idx = LS.get('sp_index', []), jg = !data.wk || data.wk.mode !== 'intervals';
  return idx.filter(s => (!window.TRN || TRN.owner(s) === TRN.owner(sm)) && s.wkDesc === sm.wkDesc && (!jg || Math.abs(s.dist - sm.dist) <= Math.max(150, sm.dist * 0.15)) && s.time > 0 && s.dist > 50).sort((a, b) => a.start - b.start);
}
function sameCard(el, sm, data){
  const L = sameWorkout(sm, data); if(L.length < 2){ el.remove(); return; }
  const sp = s => (+S.splitBase) * s.time / s.dist, me = sp(sm), others = L.filter(s => s.id !== sm.id);
  const bestS = Math.min(...L.map(sp)), rank = L.map(sp).sort((a, b) => a - b).indexOf(me) + 1;
  const prev = others.filter(s => s.start < sm.start).pop();
  el.innerHTML = '<h2>Same workout over time</h2><p><b>' + esc(sm.wkDesc) + (data.wk && data.wk.mode === 'intervals' ? '' : ' · ~' + fmtDist(sm.dist) + distUnit(sm.dist)) + '</b> — ' + L.length + ' times. This one ranks <b>#' + rank + '</b>' + (prev ? ', ' + (me <= sp(prev) ? (sp(prev) - me).toFixed(1) + ' s faster' : (me - sp(prev)).toFixed(1) + ' s slower') + ' than last time' : '') + '.</p>' +
    '<canvas style="width:100%;height:120px;display:block;margin-top:10px"></canvas>' +
    L.slice().reverse().slice(0, 8).map(s => '<div class="row"><span>' + new Date(s.start).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + (s.id === sm.id ? ' (this one)' : '') + '</span><b style="color:' + (sp(s) === bestS ? 'var(--good)' : 'var(--fg)') + '">' + fs(sp(s)) + ' · ' + (s.strokes / s.time * 60).toFixed(1) + ' spm</b></div>').join('') +
    '<button class="big alt" id="sameCmp" style="margin-top:10px">Compare with the last ' + Math.min(3, others.length) + '</button>';
  el.querySelector('#sameCmp').onclick = () => openCompare([sm.id].concat(others.slice(-3).reverse().map(s => s.id)));
  const c = el.querySelector('canvas'), [x, w, h] = canvasFit(c), v = L.map(sp); let lo = Math.min(...v), hi = Math.max(...v); if(hi - lo < 1){ lo -= 1; hi += 1; }
  const X = i => 12 + (w - 24) * (L.length > 1 ? i / (L.length - 1) : 0.5), Y = s => 10 + (h - 20) * (s - lo) / (hi - lo);
  x.strokeStyle = '#2f9bff'; x.lineWidth = 2; x.beginPath(); v.forEach((s, i) => i ? x.lineTo(X(i), Y(s)) : x.moveTo(X(i), Y(s))); x.stroke();
  v.forEach((s, i) => { x.fillStyle = L[i].id === sm.id ? '#ffd400' : '#2f9bff'; x.beginPath(); x.arc(X(i), Y(s), L[i].id === sm.id ? 6 : 4, 0, 7); x.fill(); });
}

/* ================= cox report over the season ================= */
function coxSave(id, A){
  if(!A || !A.calls) return; const R = LS.get('sp_coxrep', {});
  const cats = {}; for(const c of A.cats) cats[c.k] = [c.n, c.ds, c.dr, c.m, c.c];
  const ph = {}; for(const c of A.calls){ const p = c.text.toLowerCase().replace(/[^a-z0-9' ]+/g, '').trim(); if(p.length < 2 || p.length > 40) continue; const o = ph[p] || (ph[p] = [0, 0, 0]); o[0]++; if(c.dSplit != null){ o[1] += c.dSplit; o[2]++; } }
  const sm = LS.get('sp_index', []).find(s => s.id === id);
  const calls = A.calls.slice(0, 300).map(c => [+c.start.toFixed(1), +c.t.toFixed(1), c.text.slice(0, 80), c.cat.k, c.cat.c, c.dSplit == null ? null : +c.dSplit.toFixed(1), Math.round(c.d || 0)]);
  R[id] = { start:sm ? sm.start : id, T:A.T, talk:A.talk, n:A.calls.length, cats, ph, calls, v:2 };
  LS.set('sp_coxrep', R);
}
async function coxReport(){
  let sec = $a('scr-coxrep');
  if(!sec){ sec = document.createElement('section'); sec.className = 'screen'; sec.id = 'scr-coxrep'; sec.innerHTML = '<div class="top"><button class="iconbtn" data-go="history">‹ Back</button><h1>Cox report</h1></div><div class="body" id="crBody"></div>'; document.body.insertBefore(sec, $a('sheet')); }
  go('coxrep');
  const box = $a('crBody'), idx = LS.get('sp_index', []).filter(s => s.cox);
  const render = () => {
    const R = LS.get('sp_coxrep', {}), have = idx.filter(s => R[s.id] && R[s.id].n).sort((a, b) => a.start - b.start);
    const missing = idx.filter(s => !R[s.id] || (!R[s.id].empty && R[s.id].v !== 2));
    if(!have.length){ box.innerHTML = '<div class="card"><p>' + (missing.length ? 'Building the report from ' + missing.length + ' recorded session(s)…' : 'No cox sessions with transcribed calls yet. Turn on Cox mode, row with the mic on, and the report builds itself.') + '</p></div>'; return; }
    let T = 0, talk = 0, n = 0; const cats = {}, ph = {};
    for(const s of have){ const r = R[s.id]; T += r.T; talk += r.talk; n += r.n;
      for(const [k, v] of Object.entries(r.cats)){ const o = cats[k] || (cats[k] = { k, n:0, ds:0, dr:0, m:0, c:v[4] }); o.n += v[0]; o.ds += v[1]; o.dr += v[2]; o.m += v[3]; }
      for(const [p, v] of Object.entries(r.ph)){ const o = ph[p] || (ph[p] = { p, n:0, ds:0, m:0 }); o.n += v[0]; o.ds += v[1]; o.m += v[2]; } }
    const C = Object.values(cats).sort((a, b) => (b.m ? -b.ds / b.m : -99) - (a.m ? -a.ds / a.m : -99));
    const judged = Object.values(ph).filter(o => o.m >= 2).map(o => Object.assign(o, { e:o.ds / o.m }));
    const good = judged.slice().sort((a, b) => a.e - b.e).slice(0, 6), bad = judged.slice().sort((a, b) => b.e - a.e).filter(o => o.e > 0).slice(0, 4);
    const mostUsed = Object.values(ph).sort((a, b) => b.n - a.n).slice(0, 6);
    const cpm = s => R[s.id].T ? R[s.id].n / (R[s.id].T / 60) : 0, maxC = Math.max(...have.map(cpm), 0.1);
    let h = '<div class="card"><div class="grid3">' + stat('Sessions', have.length) + stat('Calls', n) + stat('Calls / min', (T ? n / (T / 60) : 0).toFixed(1)) + '</div><div class="grid3" style="margin-top:10px">' + stat('Talk time', T ? Math.round(talk / T * 100) + '%' : '–') + stat('On the water', fmtTime(T)) + stat('Call types', C.length) + '</div>' +
      (missing.length ? '<p class="muted" style="margin-top:8px">Adding ' + missing.length + ' more session(s)…</p>' : '') + '</div>';
    h += '<div class="card"><h2>Session by session</h2><table><tr><th>Date</th><th>Calls</th><th>/min</th><th style="width:30%"></th><th>Talk</th></tr>' + have.slice().reverse().map(s => { const r = R[s.id];
      return '<tr data-sid="' + s.id + '" style="cursor:pointer"><td>' + new Date(s.start).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + '</td><td>' + r.n + '</td><td>' + cpm(s).toFixed(1) + '</td><td><div class="segbar" style="width:' + Math.round(cpm(s) / maxC * 100) + '%"></div></td><td>' + (r.T ? Math.round(r.talk / r.T * 100) : 0) + '%</td></tr>'; }).join('') + '</table></div>';
    h += '<div class="card"><h2>Which calls work best</h2><table><tr><th>Type</th><th>Calls</th><th>Split after</th><th>Rate after</th></tr>' + C.map((c, i) => '<tr data-cat="' + esc(c.k) + '" class="' + (i === 0 && c.m && c.ds < 0 ? 'best' : '') + '"><td><span class="chip" style="background:' + c.c + '">' + c.k + '</span></td><td>' + c.n + '</td><td>' + (c.m ? sgn1(c.ds / c.m) + 's' : '—') + '</td><td>' + (c.m ? sgn1(c.dr / c.m) : '—') + '</td></tr>').join('') +
      '</table><p class="muted" style="margin-top:6px">Across the whole season: change in the 20 s after each call vs the 20 s before. Negative split = faster. Best at the top.</p></div>';
    if(good.length) h += '<div class="card"><h2>Calls that move the boat</h2>' + good.map(o => '<div class="row" data-ph="' + esc(o.p) + '"><span>“' + esc(o.p) + '” <span class="muted">' + o.m + '×</span></span><b style="color:' + (o.e < 0 ? 'var(--good)' : 'var(--fg)') + '">' + sgn1(o.e) + 's</b></div>').join('') + '<p class="muted" style="margin-top:6px">Exact words used at least twice while the boat was moving.</p></div>';
    if(bad.length) h += '<div class="card"><h2>Calls that don’t seem to help</h2>' + bad.map(o => '<div class="row" data-ph="' + esc(o.p) + '"><span>“' + esc(o.p) + '” <span class="muted">' + o.m + '×</span></span><b style="color:var(--bad)">' + sgn1(o.e) + 's</b></div>').join('') + '</div>';
    h += '<div class="card"><h2>Most used</h2>' + mostUsed.map(o => '<div class="row" data-ph="' + esc(o.p) + '"><span>“' + esc(o.p) + '”</span><b>' + o.n + '×</b></div>').join('') + '</div>';
    box.innerHTML = h + '<p class="muted" style="text-align:center;margin-bottom:20px">Tap any session, call type or call to hear it.</p>';
    box.querySelectorAll('[data-sid]').forEach(r => r.onclick = () => openDetail(+r.dataset.sid));
    box.querySelectorAll('[data-cat]').forEach(r => r.onclick = () => callList(c => c[3] === r.dataset.cat, r.dataset.cat + ' calls', have));
    box.querySelectorAll('[data-ph]').forEach(r => { r.style.cursor = 'pointer'; r.onclick = () => callList(c => c[2].toLowerCase().replace(/[^a-z0-9' ]+/g, '').trim() === r.dataset.ph, '“' + r.dataset.ph + '”', have); });
  };
  render();
  const R = LS.get('sp_coxrep', {});
  for(const s of idx.filter(s => !R[s.id] || (!R[s.id].empty && R[s.id].v !== 2))){
    if(!$a('scr-coxrep').classList.contains('on')) break;
    try{ const A = window.COX && COX.analyseSession ? await COX.analyseSession(s.id) : null; if(A) coxSave(s.id, A); else { const R2 = LS.get('sp_coxrep', {}); R2[s.id] = { start:s.start, T:0, talk:0, n:0, cats:{}, ph:{}, empty:true }; LS.set('sp_coxrep', R2); } }catch(e){ break; }
    render();
  }
}

/* every matching call across the season; tap one to open that session at that moment */
function callList(match, title, have){
  const R = LS.get('sp_coxrep', {}), list = [];
  for(const s of have){ const r = R[s.id]; if(!r || !r.calls) continue; for(const c of r.calls) if(match(c)) list.push({ sid:s.id, start:s.start, c }); }
  list.sort((a, b) => (a.c[5] == null ? 99 : a.c[5]) - (b.c[5] == null ? 99 : b.c[5]));
  openSheet('<h2 style="margin-bottom:4px">' + esc(title) + '</h2><p class="muted" style="margin-bottom:8px">' + list.length + ' call' + (list.length === 1 ? '' : 's') + ', best effect first. Tap one to hear it.</p>' +
    (list.length ? list.slice(0, 150).map((o, i) => '<button class="opt" data-i="' + i + '" style="display:flex;gap:10px;align-items:center"><span style="flex:none;width:62px;font-size:13px;color:var(--dim)">' + new Date(o.start).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + '<br>' + fmtTime(Math.max(0, o.c[1])) + '</span><span style="flex:1;font-size:16px"><span class="chip" style="background:' + o.c[4] + '">' + esc(o.c[3]) + '</span> ' + esc(o.c[2]) + '</span><b style="flex:none;font-size:15px;color:' + (o.c[5] == null ? 'var(--dim)' : o.c[5] < -0.4 ? 'var(--good)' : o.c[5] > 0.4 ? 'var(--bad)' : 'var(--fg)') + '">' + (o.c[5] == null ? '—' : sgn1(o.c[5]) + 's') + '</b></button>').join('') : '<p>No calls yet.</p>'),
    el => el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const o = list[+b.dataset.i]; closeSheet(); window.__cxSeek = { id:o.sid, t:o.c[0] }; openDetail(o.sid); }));
}

/* ================= session detail ================= */
function detailHtml(sm, data){
  const A = summary(sm, data), b = A.bests;
  return '<div class="card"><div class="grid3">' +
    stat('Distance', fmtDist(sm.dist) + ' ' + distUnit(sm.dist)) + stat('Duration', fmtTime(A.T)) + stat('Avg ' + splitLabel() + (A.workOnly ? ' (work)' : ''), fs(A.avgSplit)) +
    stat('Strokes', sm.strokes) + stat('Avg Rate', A.avgRate.toFixed(1)) + stat('Avg DPS', dpsTxt(A.dps)) +
    stat('Calories', Math.round(A.kcal) + ' kcal') + stat('Max Rate', A.maxRate ? A.maxRate.toFixed(0) : '–') + stat('Workout', esc(sm.wkDesc)) + '</div>' +
    '<div class="grid3" style="margin-top:10px">' + stat('Consistency', A.steady ? A.steady.score + ' <span style="font-size:12px" class="muted">' + steadyWord(A.steady.score) + '</span>' : '–') + stat('Split ±', A.steady ? A.steady.sdS.toFixed(1) + ' s' : '–') + stat('Rate ±', A.steady && A.steady.sdR ? A.steady.sdR.toFixed(1) : '–') + '</div>' +
    '<div class="grid3" style="margin-top:10px">' + stat('Best 500 m', fs(b[500])) + stat('Best 1 km', fs(b[1000])) + stat('Best 2 km', fs(b[2000])) + '</div>' +
    '<div id="anaWx">' + wxHtml(data.weather, data.samples || []) + '</div>' +
    '<textarea class="notes" id="anaNotes" placeholder="Notes — who was in the boat, conditions, how it felt…">' + esc(data.notes || '') + '</textarea>' +
    '<p class="muted" style="margin-top:6px;font-size:12px">Calories are an estimate per rower from stroke rate and the rower’s weight (Menu).</p></div>' +
    '<div class="card"><h2>Map</h2><div class="map" id="anaMap"></div><div class="legend" id="anaLegend"></div></div>' +
    (data.cox ? '' : '<div class="card" id="anaChart"><h2>Chart</h2></div>');
}
function saveData(id, data){ LS.set('sp_s_' + id, data); const idx = LS.get('sp_index', []); const s = idx.find(x => x.id === id); if(s){ s.synced = false; LS.set('sp_index', idx); } if(typeof syncNow === 'function') setTimeout(syncNow, 300); }
async function detailWire(id, sm, data){
  MAP = null;
  const notes = $a('anaNotes'); if(notes) notes.addEventListener('change', () => { data.notes = notes.value.slice(0, 2000); saveData(id, data); toast('Note saved'); });
  if(!data.cox && $a('anaChart')){ const box = document.createElement('div'); $a('anaChart').appendChild(box); chart(box, [{ samples:data.samples || [] }]); }
  const anchor = $a('coxBox'), card = () => { const d = document.createElement('div'); d.className = 'card'; anchor.parentNode.insertBefore(d, anchor); return d; };
  if(window.TRN) TRN.detailExtra(id, sm, data, $a('anaMap').closest('.card'));
  piecesCard(card(), data); segCard(card(), data.samples || []); rateCard(card(), data.samples || []); sameCard(card(), sm, data);
  // weather follows the map: the pin starts at the session start; tap the map to move it and the weather updates for that spot
  let wxSeq = 0;
  const wxAt = async at => { const my = ++wxSeq; if(!navigator.onLine) return; try{ const wx = await fetchWeather(sm, data, at); if(wx && my === wxSeq){ data.weather = wx; saveData(id, data); if($a('anaWx')) $a('anaWx').innerHTML = wxHtml(wx, data.samples || []); } }catch(e){} };
  drawMap($a('anaMap'), [{ samples:data.samples || [] }], { legendEl:$a('anaLegend'), sel:data.weather && data.weather.at, onSelect:(a, b) => { if($a('anaWx')) $a('anaWx').innerHTML = '<div class="wx">Getting the weather there…</div>'; wxAt([a, b]); } })
    .then(m => { MAP = m; if(m && pendingCalls) mapCalls(pendingCalls); }).catch(() => {});
  if(!data.weather) wxAt(null);
}
let pendingCalls = null;

/* ================= History: PBs, calories, compare ================= */
let picking = false, picked = [];
function historyDecorate(){
  const box = $a('histList'); if(!box) return; const { idx, pb } = ensureCache();
  box.classList.toggle('picking', picking);
  let tools = $a('histTools');
  if(!tools){ tools = document.createElement('div'); tools.id = 'histTools'; tools.style.cssText = 'display:flex;gap:8px;padding:10px 12px 12px;background:var(--bg);border-bottom:1px solid var(--edge,var(--line));box-shadow:0 6px 14px rgba(0,0,0,.3);position:relative;z-index:3'; box.parentNode.insertBefore(tools, box); }
  const hasCox = idx.some(s => s.cox);
  if($a('hChip')) $a('hChip').innerHTML = window.TRN && TRN.profiles().length > 1 ? TRN.chip() : '';
  tools.innerHTML = (idx.filter(s => !window.TRN || TRN.mine(s)).length >= 2 ? '<button class="htool" id="cmpStart">⇄ Compare</button>' : '') + (hasCox ? '<button class="htool" id="coxRep">🎙 Cox report</button>' : '');
  tools.style.display = tools.innerHTML ? 'flex' : 'none';
  if($a('cmpStart')) $a('cmpStart').onclick = () => { picking = !picking; picked = []; historyDecorate(); renderBar(); };
  if($a('coxRep')) $a('coxRep').onclick = () => { picking = false; picked = []; renderBar(); coxReport(); };
  if($a('cmpStart')) $a('cmpStart').textContent = picking ? '✕ Cancel' : '⇄ Compare';
  box.querySelectorAll('.item').forEach(it => {
    const id = +it.dataset.id, s = idx.find(x => x.id === id); if(!s) return;
    if(!it.querySelector('.tick')){ const t = document.createElement('span'); t.className = 'tick'; t.textContent = '✓'; it.querySelector('.t1').prepend(t);
      const extra = document.createElement('div'); extra.className = 't2'; extra.innerHTML = (s.kcal ? s.kcal + ' kcal' : '') + (s.b500 ? ' · best 500 m ' + fs(s.b500) : '') + ' ' + pbBadges(s, pb); it.appendChild(extra); }
    it.classList.toggle('pick', picked.includes(id));
    it.onclick = e => { if(!picking){ openDetail(id); return; } e.preventDefault(); if(picked.includes(id)) picked = picked.filter(x => x !== id); else if(picked.length < 4) picked.push(id); else toast('Up to 4 sessions'); historyDecorate(); renderBar(); };
  });
  renderBar();
}
function renderBar(){
  let bar = $a('cmpBar');
  if(!bar){ bar = document.createElement('div'); bar.className = 'cmpbar'; bar.id = 'cmpBar'; bar.innerHTML = '<button class="big" id="cmpGo"></button>'; document.body.appendChild(bar); $a('cmpGo').onclick = () => { if(picked.length >= 2) openCompare(picked.slice()); else toast('Pick 2 to 4 sessions'); }; }
  const on = picking && $a('scr-history').classList.contains('on'); bar.classList.toggle('on', on);
  $a('cmpGo').textContent = picked.length >= 2 ? 'Compare ' + picked.length + ' sessions' : 'Pick 2 to 4 sessions'; $a('cmpGo').style.opacity = picked.length >= 2 ? '1' : '.6';
}
function openCompare(ids){
  let sec = $a('scr-compare');
  if(!sec){ sec = document.createElement('section'); sec.className = 'screen'; sec.id = 'scr-compare'; sec.innerHTML = '<div class="top"><button class="iconbtn" data-go="history">‹ Back</button><h1>Compare</h1></div><div class="body" id="cmpBody"></div>'; document.body.insertBefore(sec, $a('sheet')); }
  const idx = LS.get('sp_index', []);
  const S2 = ids.map((id, k) => { const sm = idx.find(x => x.id === id), data = LS.get('sp_s_' + id, null); return sm && data ? { id, sm, data, samples:data.samples || [], c:SESS[k], A:summary(sm, data) } : null; }).filter(Boolean);
  if(S2.length < 2){ toast('Those sessions aren’t on this phone'); return; }
  picking = false; picked = []; renderBar();
  go('compare');
  const name = s => { const d = new Date(s.sm.start); return d.toLocaleDateString(undefined, { month:'short', day:'numeric' }) + ' ' + clock12(d); };
  const rows = [
    ['Distance', s => s.sm.dist, v => fmtDist(v) + ' ' + distUnit(v), 0],
    ['Duration', s => s.A.T, v => fmtTime(v), 0],
    ['Avg ' + splitLabel(), s => s.A.avgSplit, fs, -1],
    ['Avg rate', s => s.A.avgRate, v => v.toFixed(1), 0],
    ['Avg DPS', s => s.A.dps, dpsTxt, 1],
    ['Strokes', s => s.sm.strokes, v => String(v), 0],
    ['Calories', s => s.A.kcal, v => Math.round(v) + '', 0],
    ['Best 500 m', s => s.A.bests[500], fs, -1],
    ['Best 1 km', s => s.A.bests[1000], fs, -1],
    ['Best 2 km', s => s.A.bests[2000], fs, -1],
    ['Consistency', s => s.A.steady ? s.A.steady.score : null, v => String(v), 1],
    ['+1 spm buys', s => { const C = rateCurve([s.samples]); return C.slope != null && C.hi - C.lo >= 4 ? -C.slope : null; }, v => v.toFixed(1) + ' s', 1],
    ['Weather', s => s.data.weather ? windText(s.data.weather, s.samples) : '', v => esc(v || '–'), 0]
  ];
  let h = '<div class="cmphead">' + S2.map(s => '<div style="--sc:' + s.c + '">' + name(s) + ' · ' + esc(s.sm.wkDesc) + '</div>').join('') + '</div>';
  h += '<div class="card"><h2>Stats</h2><table class="cmpt"><tr><th></th>' + S2.map((s, k) => '<th style="color:' + s.c + '">#' + (k + 1) + '</th>').join('') + '</tr>' +
    rows.map(([lab, get, f, better]) => { const vals = S2.map(get); const nums = vals.filter(v => typeof v === 'number' && isFinite(v) && v > 0); const win = better ? (better < 0 ? Math.min(...nums) : Math.max(...nums)) : null;
      return '<tr><td>' + lab + '</td>' + vals.map(v => '<td class="' + (better && v === win && nums.length > 1 ? 'win' : '') + '">' + (v == null || v === '' ? '–' : f(v)) + '</td>').join('') + '</tr>'; }).join('') +
    '</table><p class="muted" style="margin-top:6px">Green = best of the group.</p></div>';
  h += '<div class="card"><h2>Chart</h2><div id="cmpChart"></div></div>';
  const PP = S2.map(s => pieces(s.data)), np = Math.max(...PP.map(p => p.length));
  if(np){ h += '<div class="card"><h2>Pieces side by side</h2><table class="cmpt"><tr><th>#</th>' + S2.map((s, k) => '<th style="color:' + s.c + '">#' + (k + 1) + '</th>').join('') + '</tr>';
    for(let i = 0; i < np; i++){ const cells = PP.map(p => p[i]); const sp = cells.map(c => c && !c.partial ? c.split : null).filter(Boolean); const best = sp.length > 1 ? Math.min(...sp) : null;
      h += '<tr><td>P' + (i + 1) + '</td>' + cells.map(c => '<td class="' + (c && best && c.split === best ? 'win' : '') + '">' + (c ? fs(c.split) + '<br><span class="muted" style="font-size:11px">' + c.rate.toFixed(0) + ' spm' + (c.h1 && c.h2 ? ' · ' + sgn1(c.h2 - c.h1) + 's' : '') + '</span>' : '–') + '</td>').join('') + '</tr>'; }
    h += '</table><p class="muted" style="margin-top:6px">Split and rate for each piece; the last number is the 2nd-half fade. Green = fastest of the group for that piece.</p></div>'; }
  h += '<div class="card" id="cmpSeg"></div>';
  h += '<div class="card"><h2>Routes</h2><div class="map" id="cmpMap"></div></div>';
  $a('cmpBody').innerHTML = h; $a('cmpBody').scrollTop = 0;
  chart($a('cmpChart'), S2);
  // segments side by side
  const lens = imp() ? [[402.336, '¼ mi'], [804.672, '½ mi'], [1609.344, '1 mi']] : [[100, '100 m'], [250, '250 m'], [500, '500 m'], [1000, '1 km']];
  let len = LS.get('sp_seglen', imp() ? 402.336 : 500); if(!lens.some(l => l[0] === len)) len = lens[imp() ? 0 : 2][0];
  const segDraw = () => {
    const all = S2.map(s => segments(s.samples, len)); const n = Math.max(...all.map(a => a.length));
    let t = '<h2>Segments</h2><div class="seg" id="cmpLen">' + lens.map(l => '<button data-v="' + l[0] + '">' + l[1] + '</button>').join('') + '</div><table class="cmpt" style="margin-top:10px"><tr><th>To</th>' + S2.map((s, k) => '<th style="color:' + s.c + '">#' + (k + 1) + '</th>').join('') + '</tr>';
    for(let i = 0; i < n; i++){ const cells = all.map(a => a[i]); const sp = cells.map(c => c && !c.partial ? c.split : null).filter(Boolean); const best = sp.length > 1 ? Math.min(...sp) : null; const ref = cells.find(Boolean);
      t += '<tr><td>' + (ref ? fmtDist(ref.to) + distUnit(ref.to) : '') + '</td>' + cells.map(c => '<td class="' + (c && best && c.split === best ? 'win' : '') + '">' + (c ? fs(c.split) + '<br><span class="muted" style="font-size:11px">' + c.rate.toFixed(0) + ' spm</span>' : '–') + '</td>').join('') + '</tr>'; }
    $a('cmpSeg').innerHTML = t + '</table><p class="muted" style="margin-top:6px">Split for each segment; green = fastest of the group for that stretch.</p>';
    segBind($a('cmpLen'), String(len), v => { len = +v; LS.set('sp_seglen', len); segDraw(); });
  };
  segDraw();
  drawMap($a('cmpMap'), S2, {}).catch(() => {});
}

/* ================= exports ================= */
window.ANA = { ensureCache, workRuns, bestFor, kg, coxSave, coxReport, pieces, steadiness, rateCurve, sameWorkout, met, kcal, bests, segments, summary, heading, windText, detailHtml, detailWire, historyDecorate, openCompare, fetchWeather,
  cursor:t => mapCursor(t), calls:c => { pendingCalls = c; if(MAP) mapCalls(c); }, leaving:() => { picking = false; picked = []; renderBar(); } };
})();
