/* StrokePulse — crew lineups (build __BUILD__)
   Saved lineups, crew credit (one phone records, every rower gets the session), lineup history and fastest lineup,
   seat racing, attendance, boats & rigging, and sharing today's lineup with the crew. */
'use strict';
(function(){
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const $l = id => document.getElementById(id);
const DAY = 864e5;
const fs = s => s == null || !isFinite(s) ? '–' : fmtTime(s, true);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TYPES = { '8+':'Eight', '4+':'Coxed four', '4-':'Four', '4x':'Quad', '2-':'Pair', '2x':'Double', '1x':'Single' };
const size = t => +String(t)[0] || 8, coxed = t => /\+$/.test(t), sweep = t => /[+-]$/.test(t);
const seatLabel = (i, n) => n === 1 ? 'Sculler' : i === 0 ? 'Bow' : i === n - 1 ? 'Stroke' : String(i + 1);
const defSide = (i, n) => (i + 1) % 2 ? 'S' : 'P';   // standard rig: stroke on port, bow on starboard (eight/four)

const css = document.createElement('style');
css.textContent = `
.lutabs{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:10px 10px 12px;background:var(--bg);border-bottom:1px solid var(--edge,var(--line));box-shadow:0 6px 14px rgba(0,0,0,.3);position:relative;z-index:3}
.lutabs button{min-width:0;padding:6px 2px;border-radius:10px;background:var(--panel);font-weight:800;color:var(--dim);font-size:12px;line-height:1.1;border:1px solid var(--edge,var(--line));display:flex;flex-direction:column;align-items:center;gap:3px}
.lutabs button span{font-size:18px}
.lutabs button.on{background:var(--acc);color:#fff;border-color:transparent}
.boat8{position:relative;margin:6px 0 4px}
.seatrow{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line)}
.seatrow:first-child{border-top:0}
.seatrow .sl{width:54px;font-size:12px;font-weight:800;color:var(--dim);text-transform:uppercase;letter-spacing:.5px;flex:none}
.seatrow input{flex:1;min-width:0;height:42px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:16px;padding:0 10px}
.seatrow .side{flex:none;width:40px;height:42px;border-radius:10px;font-weight:900;border:1px solid var(--line);background:var(--bg);color:var(--dim)}
.seatrow .side.P{color:#ff6b6b;border-color:rgba(255,107,107,.5)}
.seatrow .side.S{color:#2ed47a;border-color:rgba(46,212,122,.5)}
.seatrow .lk{flex:none;width:40px;height:42px;border-radius:10px;border:1px solid var(--line);background:var(--bg);font-size:16px}
.seatrow .lk.on{border-color:var(--acc);background:rgba(47,155,255,.15)}
.lucard{border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;background:var(--bg)}
.lucard.act{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
.lucard .nm{font-weight:850;font-size:17px}
.lucard .who{color:var(--dim);font-size:13px;margin-top:4px;line-height:1.4}
.pill2{display:inline-block;font-size:11px;font-weight:900;padding:2px 8px;border-radius:999px;background:var(--acc);color:#fff;margin-left:6px;vertical-align:middle}
.shell{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.shell .r{display:flex;align-items:center;gap:6px;font-size:13px}
.shell .r .s{width:46px;color:var(--dim);font-weight:700;font-size:11px;text-transform:uppercase}
.shell .r .d{width:8px;height:8px;border-radius:50%}
.srt{width:100%;border-collapse:collapse}.srt td,.srt th{padding:6px 4px;text-align:left;font-size:14px}
.srt input{width:100%;height:40px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:16px;padding:0 8px;text-align:center}
.srt .pick{border:0;background:none;color:var(--acc);font-weight:800;font-size:12px;padding:2px 0}
.win{color:var(--good);font-weight:900}
`;
document.head.appendChild(css);

/* ================= storage ================= */
const lineups = () => LS.get('sp_lineups', []);
const saveLineups = l => LS.set('sp_lineups', l);
const boats = () => LS.get('sp_boats', []);
const saveBoats = b => LS.set('sp_boats', b);
const activeId = () => LS.get('sp_lu_active', null);
function active(){ const id = activeId(); return lineups().find(l => l.id === id) || null; }
function setActive(id){ LS.set('sp_lu_active', id || null); }
function blank(type){ const n = size(type || '8+'); return { id:uid(), name:'', type:type || '8+', boat:'', cox:{ n:'' }, seats:Array.from({ length:n }, (_, i) => ({ n:'', s:sweep(type || '8+') ? defSide(i, n) : '' })), upd:Date.now() }; }
/* first run: turn the old Crew Roster (Cox mode) into a saved lineup */
(function migrate(){
  if(LS.get('sp_lu_migrated', false)) return; LS.set('sp_lu_migrated', true);
  const cs = LS.get('sp_cox', {}); const c = cs.crew; if(!c || !c.names || !Object.values(c.names).some(Boolean)) return;
  const type = c.boat === '4' ? '4+' : '8+', L = blank(type), n = size(type);
  L.name = 'My crew'; L.cox.n = c.names.Cox || '';
  for(let i = 0; i < n; i++){ const lab = i === 0 ? 'Bow' : i === n - 1 ? 'Stroke' : String(i + 1); L.seats[i].n = c.names[lab] || ''; }
  saveLineups([L].concat(lineups())); setActive(L.id);
})();
const names = L => (coxed(L.type) && L.cox.n ? [L.cox.n] : []).concat(L.seats.map(s => s.n)).filter(Boolean);
const sig = L => L.type + '|' + L.seats.map(s => (s.n || '?').trim().toLowerCase()).join(',') + (coxed(L.type) ? '|c:' + (L.cox.n || '').trim().toLowerCase() : '');
const knownNames = () => { const set = new Set(); lineups().forEach(L => names(L).forEach(n => set.add(n))); crewMembers().forEach(m => set.add(m.name)); return [...set].sort((a, b) => a.localeCompare(b)); };
/* members of the current rower's online crews (from the last board fetched) */
function crewMembers(){
  const out = []; if(!window.TRN) return out;
  for(const c of (TRN.cur().crews || [])){ const b = LS.get('sp_crewb_' + c.id, null); if(!b) continue; for(const m of b.members) if(m.mid !== b.me) out.push({ key:c.id + ':' + m.mid, crew:c.id, crewName:c.name, mid:m.mid, name:m.name }); }
  return out;
}

/* ================= sessions: tag, cox-mode crew card, credit ================= */
/* what a recorded session remembers about who was in the boat */
function snapshot(){
  const L = active(); if(!L) return null;
  const b = boats().find(x => x.id === L.boat);
  return { id:L.id, name:L.name || TYPES[L.type], type:L.type, boat:b ? b.name : '', cox:coxed(L.type) ? L.cox.n || '' : '', seats:L.seats.map((s, i) => ({ l:seatLabel(i, L.seats.length), n:s.n || '', s:s.s || '' })), k:sig(L) };
}
function crewFor(){   // the format the Cox-mode crew card already understands
  const L = active(); if(!L) return null; const n = L.seats.length, labels = [];
  const out = { boat:String(n), names:{}, seats:labels };
  if(coxed(L.type)){ labels.push('Cox'); out.names.Cox = L.cox.n || ''; }
  for(let i = n - 1; i >= 0; i--){ const lab = seatLabel(i, n); labels.push(lab); out.names[lab] = L.seats[i].n || ''; }
  return Object.values(out.names).some(Boolean) ? out : null;
}
function sumTag(){ const L = active(); return L ? { k:sig(L), n:L.name || TYPES[L.type], t:L.type, names:names(L) } : undefined; }
/* after saving: give every linked rower credit for the session through their crew */
async function credit(id){
  const L = active(); if(!L || !window.TRN || !navigator.onLine) return;
  const keys = L.seats.map(s => s.m).concat(coxed(L.type) ? [L.cox.m] : []).filter(Boolean); if(!keys.length) return;
  TRN.ensure(); const sm = LS.get('sp_index', []).find(s => s.id === id); if(!sm) return;
  const kg = TRN.kg(), byCrew = {}; keys.forEach(k => { const [c, m] = k.split(':'); (byCrew[c] = byCrew[c] || []).push(m); });
  const mine = TRN.cur().crews || [];
  for(const [cid, mids] of Object.entries(byCrew)){ const c = mine.find(x => x.id === cid); if(!c) continue;
    const session = { id:sm.id, start:sm.start, dist:sm.dist, time:sm.time, strokes:sm.strokes, kcal:sm.kcal, kpk:sm.kcal ? sm.kcal / kg : 0, load:sm.load, st:sm.st, mode:sm.mode, wkDesc:sm.wkDesc, lu:L.name || TYPES[L.type] };
    try{ await TRN.crewApi('credit', { crew:cid, session, mids }, c); const ix = LS.get('sp_index', []), s2 = ix.find(s => s.id === id); if(s2){ s2.cred = (s2.cred || []).concat(cid); LS.set('sp_index', ix); } }catch(e){}
  }
}
async function uncredit(id, sm){
  if(!sm || !sm.cred || !window.TRN) return;
  for(const cid of sm.cred){ const c = (TRN.cur().crews || []).find(x => x.id === cid); if(c) try{ await TRN.crewApi('uncredit', { crew:cid, sid:id }, c); }catch(e){} }
}

/* ================= menu card (replaces the old Crew Roster) ================= */
function menuCardHtml(){
  const L = active(), all = lineups();
  return '<div class="card"><h2>Lineup</h2>' + (L ? '<div class="row" style="border:0;padding-bottom:0"><span><b style="font-size:17px">' + esc(L.name || TYPES[L.type]) + '</b> <span class="muted">· ' + esc(TYPES[L.type]) + '</span></span></div>' + shellHtml(L) : '<p class="muted">No lineup picked. Sessions you record will not list who was in the boat.</p>') +
    '<div style="display:flex;gap:8px;margin-top:12px"><button class="big alt" id="luPick" style="margin:0;flex:1">' + (all.length ? 'Change' : 'New lineup') + '</button>' + (L ? '<button class="big alt" id="luEdit" style="margin:0;flex:1">Edit</button>' : '') + '</div>' +
    '<p class="muted" style="margin-top:8px;font-size:13px">Saved lineups, boats, seat racing and attendance are under Crew.</p></div>';
}
function wireMenu(box){
  if($l('luPick')) $l('luPick').onclick = () => lineups().length ? pickSheet() : editLineup(null);
  if($l('luEdit')) $l('luEdit').onclick = () => editLineup(activeId());
}
function shellHtml(L){
  const n = L.seats.length, rows = [];
  if(coxed(L.type)) rows.push(['Cox', L.cox.n, '', L.cox.m]);
  for(let i = n - 1; i >= 0; i--) rows.push([seatLabel(i, n), L.seats[i].n, L.seats[i].s, L.seats[i].m]);
  return '<div class="shell">' + rows.map(r => '<div class="r"><span class="s">' + r[0] + '</span><span class="d" style="background:' + (r[2] === 'P' ? '#ff6b6b' : r[2] === 'S' ? '#2ed47a' : 'var(--line)') + '"></span><span>' + (r[1] ? esc(r[1]) : '<span class="muted">—</span>') + (r[3] ? ' <span title="Gets credit">👥</span>' : '') + '</span></div>').join('') + '</div>';
}
function pickSheet(){
  const all = lineups(), a = activeId();
  openSheet('<h2 style="margin-bottom:8px">Pick a lineup</h2>' + all.map(L => '<button class="opt' + (L.id === a ? ' on' : '') + '" data-lu="' + L.id + '">' + esc(L.name || TYPES[L.type]) + ' <span class="muted">· ' + TYPES[L.type] + '</span>' + (L.id === a ? ' ✓' : '') + '</button>').join('') +
    '<button class="opt" data-lu="">No lineup</button><button class="big" id="luNew" style="margin-top:12px">＋ New lineup</button>',
    el => { el.querySelectorAll('[data-lu]').forEach(b => b.onclick = () => { setActive(b.dataset.lu || null); closeSheet(); toast(b.dataset.lu ? 'Lineup set' : 'No lineup'); refresh(); });
      $l('luNew').onclick = () => { closeSheet(); setTimeout(() => editLineup(null), 60); }; });
}

/* ================= lineup editor ================= */
function editLineup(id){
  const orig = lineups().find(l => l.id === id); let L = orig ? JSON.parse(JSON.stringify(orig)) : blank('8+');
  const members = crewMembers(), dl = '<datalist id="luNames">' + knownNames().map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
  const draw = () => {
    const n = L.seats.length, rows = [];
    if(coxed(L.type)) rows.push('<div class="seatrow"><span class="sl">Cox</span><input data-cox list="luNames" value="' + esc(L.cox.n) + '" placeholder="Name" maxlength="24">' + (members.length ? '<button class="lk' + (L.cox.m ? ' on' : '') + '" data-lkc>👥</button>' : '') + '</div>');
    for(let i = n - 1; i >= 0; i--) rows.push('<div class="seatrow"><span class="sl">' + seatLabel(i, n) + '</span><input data-i="' + i + '" list="luNames" value="' + esc(L.seats[i].n) + '" placeholder="Name" maxlength="24">' +
      (sweep(L.type) && n > 1 ? '<button class="side ' + L.seats[i].s + '" data-side="' + i + '">' + (L.seats[i].s || '·') + '</button>' : '') + (members.length ? '<button class="lk' + (L.seats[i].m ? ' on' : '') + '" data-lk="' + i + '">👥</button>' : '') + '</div>');
    const bl = boats();
    openSheet('<h2 style="margin-bottom:6px">' + (orig ? 'Edit lineup' : 'New lineup') + '</h2>' + dl + '<div class="frm"><label>Name</label><input id="luName" value="' + esc(L.name) + '" placeholder="e.g. Varsity 8+" maxlength="24">' +
      '<label>Boat type</label><select id="luType">' + Object.entries(TYPES).map(([k, v]) => '<option value="' + k + '"' + (k === L.type ? ' selected' : '') + '>' + k + ' · ' + v + '</option>').join('') + '</select>' +
      (bl.length ? '<label>Boat</label><select id="luBoat"><option value="">—</option>' + bl.map(b => '<option value="' + b.id + '"' + (b.id === L.boat ? ' selected' : '') + '>' + esc(b.name) + ' (' + b.type + ')</option>').join('') + '</select>' : '') + '</div>' +
      '<p class="muted" style="margin:12px 0 4px;font-size:13px">Stroke at the top, bow at the bottom.' + (sweep(L.type) ? ' Tap P/S to switch a rower’s side.' : '') + (members.length ? ' 👥 links a seat to a crew member so they get credit for every session this lineup rows.' : ' Join a crew (name button → Crews) to give each rower credit for sessions.') + '</p>' +
      '<div class="boat8">' + rows.join('') + '</div>' +
      '<button class="big" id="luSave" style="margin-top:12px">Save' + (orig ? '' : ' and use it') + '</button>' +
      (orig ? '<div style="display:flex;gap:8px"><button class="big alt" id="luShare" style="margin:0;flex:1">Share with crew</button><button class="big alt" id="luCopy" style="margin:0;flex:1">Copy</button></div><button class="big red" id="luDel" style="margin-top:8px">Delete lineup</button>' : ''),
      el => {
        const keep = () => { L.name = $l('luName').value.trim(); el.querySelectorAll('[data-i]').forEach(i => L.seats[+i.dataset.i].n = i.value.trim()); const c = el.querySelector('[data-cox]'); if(c) L.cox.n = c.value.trim(); if($l('luBoat')) L.boat = $l('luBoat').value; };
        $l('luType').onchange = () => { keep(); const t = $l('luType').value, nn = size(t), old = L.seats; L.type = t; L.seats = Array.from({ length:nn }, (_, i) => ({ n:(old[i] || {}).n || '', m:(old[i] || {}).m, s:sweep(t) && nn > 1 ? ((old[i] || {}).s || defSide(i, nn)) : '' })); draw(); };
        el.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { keep(); const s = L.seats[+b.dataset.side]; s.s = s.s === 'P' ? 'S' : 'P'; draw(); });
        const link = (cur, done) => { keep(); openSheet('<h2>Who is this in your crew?</h2><p class="muted" style="margin-bottom:8px">They’ll get credit for every session this lineup rows.</p>' + members.map(m => '<button class="opt' + (cur === m.key ? ' on' : '') + '" data-k="' + m.key + '">' + esc(m.name) + ' <span class="muted">· ' + esc(m.crewName) + '</span></button>').join('') + '<button class="opt" data-k="">Not linked</button>',
          e2 => e2.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { done(b.dataset.k || undefined, (members.find(m => m.key === b.dataset.k) || {}).name); draw(); })); };
        el.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => { const s = L.seats[+b.dataset.lk]; link(s.m, (k, nm) => { s.m = k; if(nm && !s.n) s.n = nm; }); });
        if(el.querySelector('[data-lkc]')) el.querySelector('[data-lkc]').onclick = () => link(L.cox.m, (k, nm) => { L.cox.m = k; if(nm && !L.cox.n) L.cox.n = nm; });
        // typing a crew member's exact name links them automatically
        el.querySelectorAll('[data-i],[data-cox]').forEach(i => i.addEventListener('change', () => { const m = members.filter(x => x.name.toLowerCase() === i.value.trim().toLowerCase()); if(m.length === 1){ if(i.dataset.cox != null) L.cox.m = L.cox.m || m[0].key; else { const s = L.seats[+i.dataset.i]; s.m = s.m || m[0].key; } } }));
        $l('luSave').onclick = () => { keep(); L.upd = Date.now(); const all = lineups(), k = all.findIndex(x => x.id === L.id); if(k >= 0) all[k] = L; else all.unshift(L); saveLineups(all); if(!orig) setActive(L.id); closeSheet(); toast('Lineup saved'); refresh(); };
        if($l('luDel')) $l('luDel').onclick = () => { if(!confirm('Delete this lineup? Past sessions keep who rowed.')) return; saveLineups(lineups().filter(x => x.id !== L.id)); if(activeId() === L.id) setActive(null); closeSheet(); refresh(); };
        if($l('luCopy')) $l('luCopy').onclick = () => { keep(); const c = JSON.parse(JSON.stringify(L)); c.id = uid(); c.name = (L.name || TYPES[L.type]) + ' (copy)'; saveLineups([c].concat(lineups())); closeSheet(); setTimeout(() => editLineup(c.id), 60); };
        if($l('luShare')) $l('luShare').onclick = () => { keep(); shareSheet(L); };
      });
  };
  draw();
}
function shareSheet(L){
  const crews = window.TRN ? (TRN.cur().crews || []) : [];
  if(!crews.length){ toast('Join or start a crew first (name button → Crews)'); return; }
  const b = boats().find(x => x.id === L.boat);
  openSheet('<h2>Share today’s lineup</h2><p class="muted" style="margin-bottom:8px">Everyone in the crew sees it on their Board. Names and seats only.</p><div class="frm"><label>Note (optional)</label><input id="luNote" maxlength="200" placeholder="e.g. Dock at 6:15, 3 × 2k"></div>' +
    crews.map(c => '<button class="opt" data-c="' + c.id + '">Share with ' + esc(c.name) + '</button>').join(''),
    el => el.querySelectorAll('[data-c]').forEach(btn => btn.onclick = async () => { const c = crews.find(x => x.id === btn.dataset.c);
      const lineup = { name:L.name || TYPES[L.type], type:L.type, boat:b ? b.name : '', cox:L.cox.n || '', seats:L.seats.map((s, i) => ({ n:s.n || '', s:s.s || '' })).reverse(), note:$l('luNote').value.trim() };
      try{ await TRN.crewApi('lineup', { crew:c.id, lineup }, c); LS.del('sp_crewb_' + c.id); closeSheet(); toast('Shared with ' + c.name); }catch(e){ toast('Couldn’t share — check your connection'); } }));
}
/* a lineup someone shared, shown on the crew Board */
function sharedHtml(lu){
  if(!lu) return '';
  const n = lu.seats.length, when = new Date(lu.at).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  return '<div class="card"><h2>Today’s lineup</h2><div style="font-weight:850;font-size:18px">' + esc(lu.name) + (lu.boat ? ' <span class="muted" style="font-size:14px">· ' + esc(lu.boat) + '</span>' : '') + '</div><div class="muted" style="font-size:12px">' + esc(TYPES[lu.type] || lu.type) + ' · shared ' + when + '</div>' +
    (lu.note ? '<p style="margin-top:8px">📌 ' + esc(lu.note) + '</p>' : '') +
    '<div class="shell">' + (lu.cox ? '<div class="r"><span class="s">Cox</span><span class="d" style="background:var(--line)"></span><span>' + esc(lu.cox) + '</span></div>' : '') +
    lu.seats.map((s, i) => '<div class="r"><span class="s">' + seatLabel(n - 1 - i, n) + '</span><span class="d" style="background:' + (s.s === 'P' ? '#ff6b6b' : s.s === 'S' ? '#2ed47a' : 'var(--line)') + '"></span><span>' + (s.n ? esc(s.n) : '<span class="muted">—</span>') + '</span></div>').join('') + '</div></div>';
}

/* ================= Crew screen ================= */
let TAB = 'lineups', PER = 'm';
function mount(){
  if($l('scr-crew')) return;
  const sec = document.createElement('section'); sec.className = 'screen'; sec.id = 'scr-crew';
  sec.innerHTML = '<div class="top"><button class="iconbtn" data-go="menu">‹ Back</button><h1 style="flex:1">Crew</h1></div><div class="lutabs" id="luTabs">' +
    [['lineups', 'Lineups', '🚣'], ['fast', 'Fastest', '🏆'], ['race', 'Seat race', '⇄'], ['att', 'Attend', '📅'], ['boats', 'Boats', '🛶']].map(t => '<button data-v="' + t[0] + '"><span>' + t[2] + '</span>' + t[1] + '</button>').join('') + '</div><div class="body" id="luBody"></div>';
  document.body.insertBefore(sec, $l('sheet'));
  sec.querySelectorAll('#luTabs button').forEach(b => b.onclick = () => { TAB = b.dataset.v; render(); $l('luBody').scrollTop = 0; });
}
function open(tab){ mount(); if(tab) TAB = tab; go('crew'); render(); }
function refresh(){ const on = document.querySelector('.screen.on'); if(!on) return; if(on.id === 'scr-crew') render(); if(on.id === 'scr-menu') renderMenu(); }
function render(){
  mount(); document.querySelectorAll('#luTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === TAB));
  const box = $l('luBody');
  ({ lineups:tabLineups, fast:tabFast, race:tabRace, att:tabAtt, boats:tabBoats })[TAB](box);
}
function tabLineups(box){
  const all = lineups(), a = activeId(), st = lineupStats();
  box.innerHTML = '<button class="big" id="luAdd" style="margin-bottom:4px">＋ New lineup</button>' + (all.length ? all.map(L => { const s = st[sig(L)];
      return '<div class="lucard' + (L.id === a ? ' act' : '') + '" data-l="' + L.id + '"><div class="nm">' + esc(L.name || TYPES[L.type]) + (L.id === a ? '<span class="pill2">IN USE</span>' : '') + '</div><div class="who">' + esc(TYPES[L.type]) + (s ? ' · rowed ' + s.n + '× · avg ' + fs(s.split) + splitLabel() : ' · not rowed yet') + '</div>' + shellHtml(L) +
        '<div style="display:flex;gap:8px;margin-top:10px">' + (L.id === a ? '' : '<button class="big" data-use="' + L.id + '" style="margin:0;flex:1;height:44px;font-size:16px">Use</button>') + '<button class="big alt" data-ed="' + L.id + '" style="margin:0;flex:1;height:44px;font-size:16px">Edit</button></div></div>'; }).join('')
    : '<div class="card" style="margin-top:12px"><p>Save the lineups you use — each eight, four or double — and pick one before you row. Every session then remembers who sat where.</p></div>');
  $l('luAdd').onclick = () => editLineup(null);
  box.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { setActive(b.dataset.use); toast('Lineup set for your next row'); render(); });
  box.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editLineup(b.dataset.ed));
}
/* ---- fastest lineup ---- */
function lineupStats(){
  if(window.TRN) TRN.ensure();
  const out = {}; for(const s of LS.get('sp_index', [])){ if(!s.lu || !s.lu.k) continue;
    if(s.luv !== 1){ const d = LS.get('sp_s_' + s.id, null); if(d){ const A = ANA.summary(s, d); s.ws = A.avgSplit; s.wr = A.avgRate; s.luv = 1; const ix = LS.get('sp_index', []), t = ix.find(x => x.id === s.id); if(t){ t.ws = s.ws; t.wr = s.wr; t.luv = 1; LS.set('sp_index', ix); } } }
    const o = out[s.lu.k] || (out[s.lu.k] = { k:s.lu.k, name:s.lu.n, type:s.lu.t, names:s.lu.names || [], n:0, m:0, sp:[], rt:[], st:[], b500:null, last:0, id:s.id });
    o.n++; o.m += s.dist; if(s.ws) o.sp.push(s.ws); if(s.wr) o.rt.push(s.wr); if(s.st) o.st.push(s.st); if(s.b500 && (!o.b500 || s.b500 < o.b500)) o.b500 = s.b500; if(s.start > o.last){ o.last = s.start; o.id = s.id; } }
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  Object.values(out).forEach(o => { o.split = avg(o.sp); o.rate = avg(o.rt); o.steady = avg(o.st); });
  return out;
}
function tabFast(box){
  const st = Object.values(lineupStats()), types = [...new Set(st.map(o => o.type))];
  if(!st.length){ box.innerHTML = '<div class="card"><p>Pick a lineup before you row (Menu → Lineup). After a few sessions with different lineups, this shows which combination moves the boat fastest.</p></div>'; return; }
  box.innerHTML = types.map(t => { const g = st.filter(o => o.type === t && o.split).sort((a, b) => a.split - b.split), best = g[0];
    return '<div class="card"><h2>' + esc(TYPES[t] || t) + ' lineups</h2>' + (g.length ? g.map((o, i) => { const diff = best && o !== best ? o.names.map(n => n).filter(n => !best.names.includes(n)) : [];
      return '<div class="lucard' + (i === 0 ? ' act' : '') + '" data-open="' + o.id + '"><div class="nm">' + (i === 0 ? '🏆 ' : (i + 1) + '. ') + esc(o.name) + '</div><div class="grid3" style="margin-top:8px">' + stat('Avg ' + splitLabel(), fs(o.split)) + stat('Avg rate', o.rate ? o.rate.toFixed(1) : '–') + stat('Steady', o.steady ? Math.round(o.steady) : '–') + '</div>' +
        '<div class="who">' + o.n + ' session' + (o.n === 1 ? '' : 's') + ' · ' + fmtDist(o.m) + distUnit(o.m) + (o.b500 ? ' · best 500 ' + fs(o.b500) : '') + (i && best ? ' · <b>+' + (o.split - best.split).toFixed(1) + ' s</b> vs best' : '') + '</div>' +
        '<div class="who">' + esc(o.names.join(', ')) + '</div>' + (diff.length ? '<div class="who">Different from the fastest: <b>' + esc(diff.join(', ')) + '</b></div>' : '') + '</div>'; }).join('')
      : '<p class="muted">No timed sessions yet.</p>') + '<p class="muted" style="margin-top:10px;font-size:13px">Average work split (rests left out). Wind, water and workout type all matter — compare lineups over similar sessions, or settle it with seat racing.</p></div>'; }).join('');
  box.querySelectorAll('[data-open]').forEach(c => c.onclick = () => openDetail(+c.dataset.open));
}
/* ---- seat racing ---- */
const races = () => LS.get('sp_seatraces', []);
let RACE = null;
function newRace(){ return { id:uid(), at:Date.now(), A:'Boat A', B:'Boat B', x:'', y:'', d:1000, rounds:[{ a:null, b:null }, { a:null, b:null }] }; }
function raceResult(R){
  const m = R.rounds.map(r => r.a && r.b ? r.b - r.a : null);   // + = boat A ahead
  if(m[0] == null || m[1] == null) return null;
  let swing = m[0] - m[1];   // X started in A: if A gets slower once X leaves, X is the faster rower
  if(R.rounds[2] && m[2] != null) swing = (swing + (m[2] - m[1])) / 2;   // swapped back: average both changes
  const per500 = swing * 500 / (R.d || 1000);
  return { m, swing, per500, winner:swing > 0 ? R.x : R.y, loser:swing > 0 ? R.y : R.x, by:Math.abs(swing) };
}
function tabRace(box){
  if(!RACE) RACE = newRace(); const R = RACE, res = raceResult(R), dl = '<datalist id="luNames2">' + knownNames().map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
  const row = (r, i) => { const xA = i % 2 === 0; return '<tr><td><b>' + (i + 1) + '</b><div class="muted" style="font-size:11px">' + (i === 0 ? 'start' : 'after swap') + '</div><div class="muted" style="font-size:11px">' + esc(xA ? R.x || 'X' : R.y || 'Y') + ' in ' + esc(R.A) + '</div></td>' +
    '<td><input data-r="' + i + '" data-k="a" inputmode="decimal" placeholder="m:ss.s" value="' + (r.a ? fmtTime(r.a, true) : '') + '"><button class="pick" data-pk="' + i + ':a">from a session</button></td>' +
    '<td><input data-r="' + i + '" data-k="b" inputmode="decimal" placeholder="m:ss.s" value="' + (r.b ? fmtTime(r.b, true) : '') + '"><button class="pick" data-pk="' + i + ':b">from a session</button></td>' +
    '<td style="text-align:right;font-variant-numeric:tabular-nums">' + (r.a && r.b ? (r.b - r.a > 0 ? 'A +' : 'B +') + Math.abs(r.b - r.a).toFixed(1) + 's' : '') + '</td></tr>'; };
  let h = dl + '<div class="card"><h2>Seat race</h2><p class="muted" style="font-size:13px;margin-bottom:6px">Two boats row the same piece. Swap one rower from each boat and row it again. The change in the gap shows who moves a boat faster.</p><div class="frm">' +
    '<div style="display:flex;gap:8px"><div style="flex:1"><label>Boat A</label><input id="srA" value="' + esc(R.A) + '"></div><div style="flex:1"><label>Boat B</label><input id="srB" value="' + esc(R.B) + '"></div></div>' +
    '<div style="display:flex;gap:8px"><div style="flex:1"><label>Rower X (starts in A)</label><input id="srX" list="luNames2" value="' + esc(R.x) + '" placeholder="Name"></div><div style="flex:1"><label>Rower Y (starts in B)</label><input id="srY" list="luNames2" value="' + esc(R.y) + '" placeholder="Name"></div></div>' +
    '<label>Piece length (m)</label><input id="srD" type="number" inputmode="numeric" value="' + R.d + '"></div>' +
    '<table class="srt" style="margin-top:12px"><tr><th>Piece</th><th>' + esc(R.A) + '</th><th>' + esc(R.B) + '</th><th></th></tr>' + R.rounds.map(row).join('') + '</table>' +
    '<button class="big alt" id="srMore" style="margin-top:10px">' + (R.rounds.length < 3 ? '＋ 3rd piece (swap back)' : '− Remove 3rd piece') + '</button>';
  if(res) h += '<div class="lucard act" style="margin-top:12px"><div class="nm">🏁 ' + esc(res.winner || '?') + ' is faster</div><div class="who">by <b>' + res.by.toFixed(1) + ' s</b> over ' + R.d + ' m (' + Math.abs(res.per500).toFixed(1) + ' s per 500 m). Gap went from ' + (res.m[0] >= 0 ? 'A +' : 'B +') + Math.abs(res.m[0]).toFixed(1) + ' to ' + (res.m[1] >= 0 ? 'A +' : 'B +') + Math.abs(res.m[1]).toFixed(1) + ' s.' + (res.by < 1 ? ' Under a second is within noise — row another round.' : '') + '</div></div>';
  h += '<div style="display:flex;gap:8px;margin-top:10px"><button class="big" id="srSave" style="margin:0;flex:1"' + (res ? '' : ' disabled') + '>Save result</button><button class="big alt" id="srNew" style="margin:0;flex:1">Start over</button></div></div>';
  // ranking across saved races
  const all = races(), tab = {}; all.forEach(r => { const z = raceResult(r); if(!z) return; [[z.winner, z.by], [z.loser, -z.by]].forEach(([n, v]) => { if(!n) return; const o = tab[n] || (tab[n] = { n, w:0, l:0, net:0 }); o.net += v * 500 / (r.d || 1000); if(v > 0) o.w++; else o.l++; }); });
  const rk = Object.values(tab).sort((a, b) => b.net - a.net);
  if(rk.length) h += '<div class="card"><h2>Seat racing results</h2><table class="srt"><tr><th>Rower</th><th>Won</th><th>Lost</th><th>Net /500</th></tr>' + rk.map((o, i) => '<tr><td>' + (i === 0 ? '🏆 ' : '') + esc(o.n) + '</td><td>' + o.w + '</td><td>' + o.l + '</td><td class="' + (o.net > 0 ? 'win' : '') + '">' + (o.net > 0 ? '+' : '') + o.net.toFixed(1) + ' s</td></tr>').join('') + '</table>' +
    '<p class="muted" style="margin-top:8px;font-size:13px">Net = seconds per 500 m gained across all their seat races.</p>' +
    all.slice().reverse().slice(0, 12).map(r => { const z = raceResult(r); return '<div class="row"><span>' + new Date(r.at).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + ' · ' + esc(r.x) + ' vs ' + esc(r.y) + '</span><span>' + (z ? '<b>' + esc(z.winner) + '</b> +' + z.by.toFixed(1) + 's' : '') + ' <button class="pchip" data-delr="' + r.id + '" style="padding:2px 8px;font-size:12px">✕</button></span></div>'; }).join('') + '</div>';
  box.innerHTML = h;
  const keep = () => { R.A = $l('srA').value.trim() || 'Boat A'; R.B = $l('srB').value.trim() || 'Boat B'; R.x = $l('srX').value.trim(); R.y = $l('srY').value.trim(); R.d = Math.max(100, +$l('srD').value || 1000);
    box.querySelectorAll('[data-r]').forEach(i => { const v = parseSplit(i.value); R.rounds[+i.dataset.r][i.dataset.k] = v && v > 5 ? v : null; }); };
  // names just save as you type; times redraw the result
  box.querySelectorAll('input').forEach(i => i.addEventListener(i.dataset.r != null || i.id === 'srD' ? 'change' : 'input', () => { keep(); if(i.dataset.r != null || i.id === 'srD') render(); }));
  $l('srMore').onclick = () => { keep(); if(R.rounds.length < 3) R.rounds.push({ a:null, b:null }); else R.rounds.pop(); render(); };
  $l('srNew').onclick = () => { RACE = newRace(); render(); };
  $l('srSave').onclick = () => { keep(); if(!raceResult(R)) return; if(!R.x || !R.y){ toast('Enter both rowers’ names'); return; } LS.set('sp_seatraces', races().filter(r => r.id !== R.id).concat(R)); toast('Seat race saved'); RACE = newRace(); render(); };
  box.querySelectorAll('[data-delr]').forEach(b => b.onclick = () => { if(confirm('Delete this seat race?')){ LS.set('sp_seatraces', races().filter(r => r.id !== b.dataset.delr)); render(); } });
  box.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { keep(); const [i, k] = b.dataset.pk.split(':'); pickPiece(t => { R.rounds[+i][k] = t; render(); }); });
}
/* pull a piece time from a recorded session (work laps of the last 3 days) */
function pickPiece(done){
  const idx = LS.get('sp_index', []).filter(s => s.start > Date.now() - 3 * DAY), list = [];
  for(const s of idx){ const d = LS.get('sp_s_' + s.id, null); if(!d) continue; (d.laps || []).filter(l => l.type === 'work' || l.type === 'lap').forEach(l => list.push({ s, l })); }
  openSheet('<h2>Pick a piece</h2><p class="muted" style="margin-bottom:8px">Pieces recorded on this phone in the last 3 days.</p>' + (list.length ? list.map((o, i) => '<button class="opt" data-i="' + i + '">' + new Date(o.s.start).toLocaleDateString(undefined, { weekday:'short' }) + ' ' + clock12(new Date(o.s.start)) + ' · piece ' + (o.l.rep || o.l.n) + ' · ' + fmtDist(o.l.d) + distUnit(o.l.d) + ' · <b>' + fmtTime(o.l.t, true) + '</b></button>').join('') : '<p>No pieces yet — type the time instead.</p>'),
    el => el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeSheet(); done(list[+b.dataset.i].l.t); }));
}
/* ---- attendance ---- */
function tabAtt(box){
  const from = PER === 'w' ? weekStart(Date.now()) : PER === 'm' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : 0;
  const sess = LS.get('sp_index', []).filter(s => s.lu && s.lu.names && s.start >= from), days = new Set(sess.map(s => new Date(s.start).toDateString())).size;
  const tab = {}; for(const s of sess) for(const n of s.lu.names){ const o = tab[n] || (tab[n] = { n, c:0, m:0, last:0, d:new Set() }); o.c++; o.m += s.dist; o.d.add(new Date(s.start).toDateString()); if(s.start > o.last) o.last = s.start; }
  const rows = Object.values(tab).sort((a, b) => b.d.size - a.d.size || b.m - a.m);
  box.innerHTML = '<div class="card"><div class="seg" id="atP"><button data-v="w">This week</button><button data-v="m">This month</button><button data-v="a">All time</button></div>' +
    '<p class="muted" style="margin-top:10px;font-size:13px">' + days + ' practice day' + (days === 1 ? '' : 's') + ' recorded with a lineup on this phone.</p>' +
    (rows.length ? '<table class="srt" style="margin-top:6px"><tr><th>Rower</th><th>Days</th><th>%</th><th>Distance</th><th>Last</th></tr>' + rows.map(o => '<tr><td><b>' + esc(o.n) + '</b></td><td>' + o.d.size + '</td><td>' + (days ? Math.round(o.d.size / days * 100) : 0) + '%</td><td>' + fmtDist(o.m) + distUnit(o.m) + '</td><td class="muted">' + new Date(o.last).toLocaleDateString(undefined, { month:'short', day:'numeric' }) + '</td></tr>').join('') + '</table>'
      : '<p style="margin-top:8px">Nobody yet — pick a lineup before you row and attendance fills in by itself.</p>') + '</div>';
  segBind($l('atP'), PER, v => { PER = v; render(); });
}
function weekStart(t){ const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
/* ---- boats & rigging ---- */
const RIG = [['span', 'Span / spread (cm)'], ['inb', 'Inboard (cm)'], ['oar', 'Oar length (cm)'], ['pitch', 'Pitch (°)'], ['ht', 'Height (cm)']];
function tabBoats(box){
  const bl = boats();
  box.innerHTML = '<button class="big" id="bAdd" style="margin-bottom:4px">＋ Add a boat</button>' + (bl.length ? bl.map(b => '<div class="lucard"><div class="nm">' + esc(b.name) + ' <span class="muted" style="font-size:14px">· ' + esc(TYPES[b.type] || b.type) + '</span></div>' +
      '<div class="who">' + RIG.filter(r => b.rig && b.rig[r[0]]).map(r => r[1].replace(/ \(.*\)/, '') + ' ' + esc(b.rig[r[0]])).join(' · ') + '</div>' + (b.notes ? '<div class="who">📝 ' + esc(b.notes) + '</div>' : '') +
      '<button class="big alt" data-b="' + b.id + '" style="margin-top:10px;height:44px;font-size:16px">Edit</button></div>').join('')
    : '<div class="card" style="margin-top:12px"><p>Keep each boat’s name and rigging — spread or span, inboard, oar length, pitch, height — and attach a boat to a lineup.</p></div>');
  $l('bAdd').onclick = () => editBoat(null);
  box.querySelectorAll('[data-b]').forEach(b => b.onclick = () => editBoat(b.dataset.b));
}
function editBoat(id){
  const orig = boats().find(b => b.id === id), B = orig ? JSON.parse(JSON.stringify(orig)) : { id:uid(), name:'', type:'8+', rig:{}, notes:'' };
  openSheet('<h2>' + (orig ? 'Edit boat' : 'Add a boat') + '</h2><div class="frm"><label>Name</label><input id="bN" value="' + esc(B.name) + '" placeholder="e.g. Empacher “Red Hawk”" maxlength="24">' +
    '<label>Type</label><select id="bT">' + Object.entries(TYPES).map(([k, v]) => '<option value="' + k + '"' + (k === B.type ? ' selected' : '') + '>' + k + ' · ' + v + '</option>').join('') + '</select>' +
    RIG.map(r => '<label>' + r[1] + '</label><input data-rig="' + r[0] + '" value="' + esc((B.rig || {})[r[0]] || '') + '" maxlength="20">').join('') +
    '<label>Notes</label><input id="bNotes" value="' + esc(B.notes || '') + '" maxlength="200" placeholder="e.g. bow seat wheel sticks"></div>' +
    '<button class="big" id="bSave" style="margin-top:12px">Save</button>' + (orig ? '<button class="big red" id="bDel">Delete boat</button>' : ''),
    el => {
      $l('bSave').onclick = () => { B.name = $l('bN').value.trim() || 'Boat'; B.type = $l('bT').value; B.notes = $l('bNotes').value.trim(); B.rig = {}; el.querySelectorAll('[data-rig]').forEach(i => { if(i.value.trim()) B.rig[i.dataset.rig] = i.value.trim(); });
        const all = boats(), k = all.findIndex(x => x.id === B.id); if(k >= 0) all[k] = B; else all.push(B); saveBoats(all); closeSheet(); toast('Boat saved'); render(); };
      if($l('bDel')) $l('bDel').onclick = () => { if(!confirm('Delete this boat?')) return; saveBoats(boats().filter(x => x.id !== B.id)); closeSheet(); render(); };
    });
}

/* ================= session detail: who rowed ================= */
function detailHtml(data){
  const lu = data && data.lineup; if(!lu) return '';
  return '<div class="card"><h2>In the boat</h2><div style="font-weight:850">' + esc(lu.name) + (lu.boat ? ' <span class="muted">· ' + esc(lu.boat) + '</span>' : '') + '</div><div class="shell">' + (lu.cox ? '<div class="r"><span class="s">Cox</span><span class="d" style="background:var(--line)"></span><span>' + esc(lu.cox) + '</span></div>' : '') +
    lu.seats.slice().reverse().map(s => '<div class="r"><span class="s">' + esc(s.l) + '</span><span class="d" style="background:' + (s.s === 'P' ? '#ff6b6b' : s.s === 'S' ? '#2ed47a' : 'var(--line)') + '"></span><span>' + (s.n ? esc(s.n) : '<span class="muted">—</span>') + '</span></div>').join('') + '</div></div>';
}

window.LU = { active, snapshot, crewFor, sumTag, credit, uncredit, menuCardHtml, wireMenu, open, render, sharedHtml, detailHtml, editLineup, raceResult, lineupStats };
})();
