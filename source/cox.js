/* StrokePulse — Cox mode (build __BUILD__)
   Mic → boat speakers, recording + transcripts + call analysis, race-plan prompts, rate beeper,
   check factor, crew list, private coach link, and live coach listen-in / talk-back / messages.
   Shares the main app's globals (run, S, LS, SYNC, AC, toast, fmt helpers…). */
'use strict';
(function(){
const COACH_MODE = location.hash.startsWith('#coach=');
const COACH_TOKEN = COACH_MODE ? location.hash.slice(7).replace(/[^a-z0-9]/g,'') : '';
const CS = Object.assign({ on:false, pass:'1', vol:0.8, live:'1', beat:false, beepRate:28, plan:'', link:null,
  crew:{ boat:'8', names:{} } }, LS.get('sp_cox', {}));
const saveCS = () => LS.set('sp_cox', CS);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $c = id => document.getElementById(id);

/* ================= styles ================= */
const css = document.createElement('style');
css.textContent = `
.coxbar{display:none;gap:8px;padding:8px 10px 0}
.coxbar.on{display:flex}
.coxbar button{flex:1;height:46px;border-radius:12px;background:var(--panel);font-weight:800;font-size:15px;border:1px solid var(--line)}
.coxbar button.hot{background:var(--good);color:#00210f;border-color:transparent}
.coxbar button.warn{background:var(--bad);color:#fff;border-color:transparent}
.coxbar button.live{background:var(--acc);color:#fff;border-color:transparent}
.prompt{position:fixed;left:12px;right:12px;top:30%;z-index:40;background:var(--warn);color:#000;border-radius:18px;padding:26px 18px;text-align:center;font-size:min(11vw,64px);font-weight:900;line-height:1.05;display:none;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.prompt.on{display:block}
.coachmsg{position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 46px);z-index:39;background:var(--acc);color:#fff;border-radius:14px;padding:14px 16px;font-size:24px;font-weight:800;display:none}
.coachmsg.on{display:block}.coachmsg small{display:block;font-size:12px;letter-spacing:1px;opacity:.8}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:800;color:#000;white-space:nowrap}
.calls{max-height:440px;overflow-y:auto}
.call{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer}
.call.sel{background:rgba(47,155,255,.12)}
.call .tm{font-variant-numeric:tabular-nums;color:var(--dim);font-size:13px;min-width:44px;padding-top:2px}
.call .tx{flex:1;font-size:16px;line-height:1.3}
.call .fx{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums;text-align:right;min-width:74px}
.fx .g{color:var(--good)}.fx .b{color:var(--bad)}
.player{display:flex;gap:10px;align-items:center;margin-top:10px}
.player button{width:54px;height:44px;border-radius:10px;background:var(--acc);color:#fff;font-size:20px;font-weight:800}
.player input{flex:1}
.player .pt{font-variant-numeric:tabular-nums;color:var(--dim);font-size:14px;min-width:48px;text-align:right}
.crewgrid{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center}
.crewgrid input,.coxin{width:100%;padding:9px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:16px}
textarea.coxin{min-height:110px;font-family:inherit}
.quick{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.quick button{height:48px;border-radius:10px;background:var(--panel);border:1px solid var(--line);font-weight:700;font-size:15px}
.talk{width:100%;height:96px;border-radius:18px;background:var(--bad);color:#fff;font-size:24px;font-weight:900;margin-top:10px;touch-action:none}
.talk.on{background:var(--good);color:#00210f}
.tele{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border-radius:12px;overflow:hidden;margin-bottom:12px}
.tele div{background:var(--panel);padding:10px 12px}.tele .k{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:1px}
.tele .v{font-size:min(11vw,52px);font-weight:900;font-variant-numeric:tabular-nums;line-height:1.05}
`;
document.head.appendChild(css);

/* ================= IndexedDB for recordings ================= */
let idbP = null;
function idb(){ if(idbP) return idbP;
  idbP = new Promise((ok, bad) => { const r = indexedDB.open('sp_audio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('chunks', { keyPath:'id' });
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
  return idbP; }
async function idbDo(mode, fn){ const db = await idb(); return new Promise((ok, bad) => { const tx = db.transaction('chunks', mode); const st = tx.objectStore('chunks'); let out; Promise.resolve(fn(st, v => out = v)); tx.oncomplete = () => ok(out); tx.onerror = () => bad(tx.error); }); }
const idbPut = rec => idbDo('readwrite', st => st.put(rec));
const idbGet = id => idbDo('readonly', (st, set) => { const r = st.get(id); r.onsuccess = () => set(r.result); });
const idbDelRec = recId => idbDo('readwrite', st => { const r = st.openCursor(); r.onsuccess = () => { const c = r.result; if(!c) return; if(c.value.rec === recId) c.delete(); c.continue(); }; });
const idbPrune = () => idbDo('readwrite', st => { const cut = Date.now() - 45*864e5; const r = st.openCursor(); r.onsuccess = () => { const c = r.result; if(!c) return; if(c.value.uploaded && c.value.wall < cut) c.delete(); c.continue(); }; });

/* ================= µ-law audio frames (16 kHz) for the live relay ================= */
function ulawEnc(x){ let s = Math.max(-1, Math.min(1, x)) * 32635; const sign = s < 0 ? 0x80 : 0; if(sign) s = -s; s += 132; let e = 7; for(let m = 0x4000; (s & m) === 0 && e > 0; e--, m >>= 1); const man = (s >> (e + 3)) & 0x0f; return ~(sign | (e << 4) | man) & 0xff; }
function ulawDec(u){ u = ~u & 0xff; const sign = u & 0x80, e = (u >> 4) & 7, man = u & 0x0f; let s = ((man << 3) + 132) << e; s -= 132; return (sign ? -s : s) / 32768; }
function encodeFrame(f32, sr){ const ratio = sr / 16000, n = Math.floor(f32.length / ratio), out = new Uint8Array(n + 1); out[0] = 1;
  for(let i = 0; i < n; i++){ const p = i * ratio, j = Math.floor(p), fr = p - j; const v = f32[j] * (1 - fr) + (f32[Math.min(j + 1, f32.length - 1)] || 0) * fr; out[i + 1] = ulawEnc(v); } return out; }
function makePlayer(dest){ return { next:0, dest }; }
function playFrame(pl, u8){ if(!AC || u8.length < 2) return; const n = u8.length - 1, sr = AC.sampleRate, m = Math.floor(n * sr / 16000);
  const buf = AC.createBuffer(1, m, sr), ch = buf.getChannelData(0);
  for(let i = 0; i < m; i++){ const p = i * 16000 / sr, j = Math.floor(p), fr = p - j; const a = ulawDec(u8[1 + j]), b = ulawDec(u8[1 + Math.min(j + 1, n - 1)]); ch[i] = a * (1 - fr) + b * fr; }
  const src = AC.createBufferSource(); src.buffer = buf; src.connect(pl.dest || AC.destination);
  const now = AC.currentTime; if(pl.next < now + 0.04 || pl.next > now + 1.2) pl.next = now + 0.25;
  src.start(pl.next); pl.next += buf.duration; }

/* ================= categorising calls ================= */
const CATS = [
  { k:'Power', c:'#ff6b6b', re:/\b(power|push|big ten|power ten|power 10|now|go go|send it|hammer|attack|move|make a move|bury|squeeze|take it|walk|take a seat|seat|seats)\b/ },
  { k:'Rate', c:'#ffb020', re:/\b(rate|up (one|two|2|1)|bring it up|shift|settle|lengthen|stride|bring it down|bump|build|higher|lower|spm|in two|in 2)\b/ },
  { k:'Technical', c:'#2f9bff', re:/\b(legs|catch|catches|finish|finishes|hands|ratio|swing|sit up|together|connect|drive|blades|sharp|clean|send|press|lock|draw|length|relax|recover|slide|posture|core|knees|feather|square)\b/ },
  { k:'Command', c:'#a78bfa', re:/\b(weigh enough|weigh nuff|hold water|sit ready|attention|row|easy|check it|back it|port|starboard|bow pair|stern pair|stroke seat|paddle|let it run|ready all|half slide|quarter slide)\b/ },
  { k:'Info', c:'#2ed47a', re:/\b(\d+ (to go|meters|metres|m)|to go|halfway|last \d+|first \d+|we are|we're|you're at|split|on (them|the)|up on|down on|seat|deck|length|a half)\b/ },
  { k:'Motivation', c:'#f472b6', re:/\b(let's go|come on|you got|you've got|believe|for each other|this is it|yes|good|great|nice|that's it|beautiful|hell yeah|lets go|proud|everything)\b/ }
];
function categorize(t){ const s = ' ' + String(t).toLowerCase().replace(/[^a-z0-9' ]+/g,' ') + ' '; for(const c of CATS) if(c.re.test(s)) return c; return { k:'Other', c:'#8a97a6' }; }

/* ================= check factor (boat deceleration at the catch) ================= */
const CK = { sk:0, curMin:0, vals:[], last:0 };
function ckAccel(s){ CK.sk += 0.002 * (s*s*s - CK.sk); const o = CK.sk > 0 ? -s : s; if(o < CK.curMin) CK.curMin = o; }
function ckStroke(){ let v = -CK.curMin; if(S.demo === '1') v = 2.1 + Math.random() * 0.7; CK.curMin = 0; if(v > 0.05 && v < 40){ CK.vals.push(v); if(CK.vals.length > 5) CK.vals.shift(); } CK.last = Date.now(); }
function checkVal(){ if(!CK.vals.length || Date.now() - CK.last > 6000) return 0; return CK.vals.reduce((a, b) => a + b, 0) / CK.vals.length; }

/* ================= microphone, speakers, recording ================= */
const M = { stream:null, gain:null, muted:false, recording:false, recId:null, idx:0, meta:[], mime:'', pending:0, mr:null, timer:null, sink:null, proc:null };
function pickMime(){ if(!window.MediaRecorder) return ''; for(const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch(e){} return ''; }
async function micOn(){
  if(M.stream) return true;
  audioUnlock();
  try{
    if(navigator.audioSession) try{ navigator.audioSession.type = 'play-and-record'; }catch(e){}
    M.stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:true, autoGainControl:true } });
  }catch(e){ toast('Microphone blocked — allow it in iPhone Settings › Safari › Microphone'); return false; }
  if(!AC) audioUnlock();
  const src = AC.createMediaStreamSource(M.stream);
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 4;
  M.gain = AC.createGain(); src.connect(comp); comp.connect(M.gain); M.gain.connect(AC.destination);
  M.sink = AC.createGain(); M.sink.gain.value = 0; M.sink.connect(AC.destination);
  M.proc = AC.createScriptProcessor(4096, 1, 1); src.connect(M.proc); M.proc.connect(M.sink);
  M.proc.onaudioprocess = e => liveAudio(e.inputBuffer.getChannelData(0));
  setPass(); renderBar(); return true;
}
function micOff(){ if(M.recording) return; if(M.stream){ M.stream.getTracks().forEach(t => t.stop()); M.stream = null; } try{ M.proc && M.proc.disconnect(); M.gain && M.gain.disconnect(); }catch(e){} M.proc = M.gain = null; renderBar(); }
function setPass(){ if(M.gain) M.gain.gain.value = (CS.pass === '1' && !M.muted) ? +CS.vol : 0; }
function recStart(){
  M.mime = pickMime(); if(!M.mime || !M.stream){ return; }
  M.recId = 'r' + Date.now().toString(36); M.idx = 0; M.meta = []; M.recording = true; nextChunk();
}
function nextChunk(){
  const rec = M.recId, idx = M.idx++, wall = Date.now(), parts = [];
  let mr; try{ mr = new MediaRecorder(M.stream, { mimeType:M.mime, audioBitsPerSecond:32000 }); }catch(e){ try{ mr = new MediaRecorder(M.stream); }catch(e2){ M.recording = false; return; } }
  mr.ondataavailable = e => { if(e.data && e.data.size) parts.push(e.data); };
  mr.onstop = async () => {
    const type = (mr.mimeType || M.mime).split(';')[0] || 'audio/mp4', blob = new Blob(parts, { type }), dur = (Date.now() - wall) / 1000;
    if(blob.size > 200){ try{ await idbPut({ id:rec + ':' + idx, rec, idx, wall, dur, mime:type, blob, uploaded:false }); }catch(e){} M.meta.push({ rec, idx, wall, dur, mime:type }); }
    M.pending--; if(M.pending <= 0 && M.onDone){ const f = M.onDone; M.onDone = null; f(); }
  };
  M.pending++; mr.start(); M.mr = mr;
  clearTimeout(M.timer); M.timer = setTimeout(() => { if(M.recording && M.mr === mr){ nextChunk(); try{ mr.stop(); }catch(e){} } }, 60000);
}
function recStop(){ return new Promise(ok => { if(!M.recording){ ok([]); return; } M.recording = false; clearTimeout(M.timer); M.onDone = () => ok(M.meta.slice()); try{ M.mr.stop(); }catch(e){ ok(M.meta.slice()); } }); }

/* ================= live link (cox side and coach side share the socket code) ================= */
const L = { ws:null, up:false, coaches:0, listening:0, retry:1000, telT:null, pingT:null, player:null, talking:false };
function liveUrl(){ const q = COACH_MODE ? 'ct=' + encodeURIComponent(COACH_TOKEN) : 'key=' + encodeURIComponent(SYNC.key); return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/live?' + q; }
function liveWanted(){ return COACH_MODE || (CS.on && CS.live === '1' && CS.link && SYNC.on); }
function liveConnect(){
  if(L.ws || !liveWanted() || !navigator.onLine || !/^https?:$/.test(location.protocol)) return;
  let ws; try{ ws = new WebSocket(liveUrl()); }catch(e){ return; }
  ws.binaryType = 'arraybuffer'; L.ws = ws;
  ws.onopen = () => { L.up = true; L.retry = 1000; if(COACH_MODE) coachSendListen(); clearInterval(L.pingT); L.pingT = setInterval(() => send({ t:'ping' }), 25000); renderAll(); };
  ws.onclose = () => { L.ws = null; L.up = false; L.coaches = 0; L.listening = 0; clearInterval(L.pingT); renderAll(); if(liveWanted()) setTimeout(liveConnect, L.retry = Math.min(L.retry * 2, 20000)); };
  ws.onerror = () => {};
  ws.onmessage = ev => {
    if(typeof ev.data !== 'string'){ const u8 = new Uint8Array(ev.data); if(COACH_MODE){ if(CH.listen && !CH.talking) playFrame(L.player || (L.player = makePlayer()), u8); } else { playFrame(L.player || (L.player = makePlayer()), u8); } return; }
    let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
    if(m.t === 'presence'){ L.coaches = m.coaches; L.listening = m.listening; L.coxOnline = m.cox; renderAll(); }
    else if(m.t === 'msg' && !COACH_MODE) showCoachMsg(m.text);
    else if(m.t === 'talk' && !COACH_MODE){ L.talking = !!m.on; renderBar(); }
    else if(m.t === 'tel' && COACH_MODE) coachTel(m);
  };
}
function liveClose(){ if(L.ws){ try{ L.ws.close(); }catch(e){} L.ws = null; } }
function send(o){ if(L.ws && L.up) try{ L.ws.send(typeof o === 'string' || o instanceof Uint8Array ? o : JSON.stringify(o)); }catch(e){} }
function liveAudio(f32){
  if(COACH_MODE){ if(CH.talking && L.up) send(encodeFrame(f32, AC.sampleRate)); return; }
  if(L.up && L.listening > 0 && L.ws.bufferedAmount < 64000) send(encodeFrame(f32, AC.sampleRate));
}
function telemetry(){
  if(COACH_MODE || !L.up || L.coaches < 1) return;
  const r = currentRate(nowSecMotion()), ck = checkVal();
  send({ t:'tel', on:!!run, armed:!!(run && run.armed), phase:run ? run.phase : 'idle', rep:run ? run.rep : 0, reps:run && run.wk.mode === 'intervals' ? run.wk.reps : 0,
    split:fmtSplit(curV()), splitU:splitLabel(), rate:r > 0 ? r.toFixed(1) : '0', dist:fmtDist(curDist()), distU:distUnit(curDist()), time:fmtTime(curTime()),
    total:fmtDist(run ? run.dist : 0) + distUnit(run ? run.dist : 0), check:ck ? ck.toFixed(1) : '–', mic:!!M.stream, muted:M.muted, ts:Date.now() });
}

/* ================= race plan prompts ================= */
function parsePlan(txt){
  const out = [];
  for(const line of String(txt || '').split(/\n/)){ const l = line.trim(); if(!l) continue;
    let m = l.match(/^(\d+)\s*(?:m)?\s*to\s*go\b[:\-\s]*(.*)$/i); if(m){ out.push({ kind:'togo', v:+m[1], text:m[2] || l }); continue; }
    m = l.match(/^(\d{1,2}):(\d{2})\b[:\-\s]*(.*)$/); if(m){ out.push({ kind:'time', v:+m[1] * 60 + +m[2], text:m[3] || l }); continue; }
    m = l.match(/^(\d+)\s*(?:m)?\b[:\-\s]*(.*)$/i); if(m){ out.push({ kind:'dist', v:+m[1], text:m[2] || l }); continue; }
  }
  return out;
}
const PL = { fired:new Set(), rep:-1, sid:null, items:[] };
function planTick(){
  if(!CS.on || !run || run.armed || !(run.phase === 'work' || run.phase === 'justgo')) return;
  if(PL.sid !== run.id || PL.rep !== run.rep){ PL.sid = run.id; PL.rep = run.rep; PL.fired = new Set(); PL.items = parsePlan(CS.plan); }
  const d = curDist(), t = curTime();
  PL.items.forEach((it, i) => {
    if(PL.fired.has(i)) return;
    let hit = false;
    if(it.kind === 'dist') hit = d >= it.v;
    else if(it.kind === 'time') hit = t >= it.v;
    else if(it.kind === 'togo' && run.wk.mode === 'intervals' && run.wk.type === 'dist') hit = run.wk.val - d <= it.v;
    if(hit){ PL.fired.add(i); showPrompt(it.text); }
  });
}
let promptT = null;
function showPrompt(text){ const p = $c('coxPrompt'); p.textContent = text; p.classList.add('on'); clearTimeout(promptT); promptT = setTimeout(() => p.classList.remove('on'), 6000); }
let msgT = null;
function showCoachMsg(text){ const p = $c('coachMsg'); p.innerHTML = '<small>COACH</small>' + esc(text); p.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => p.classList.remove('on'), 9000); }

/* ================= rate beeper ================= */
const BT = { next:0, timer:null };
function beatTick(){
  if(!CS.beat || !AC){ return; }
  const period = 60 / Math.max(10, Math.min(60, +CS.beepRate || 28));
  while(BT.next < AC.currentTime + 0.12){
    if(BT.next < AC.currentTime) BT.next = AC.currentTime + 0.02;
    const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = 1400; g.gain.setValueAtTime(0.0001, BT.next); g.gain.exponentialRampToValueAtTime(0.5, BT.next + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, BT.next + 0.06);
    o.connect(g); g.connect(AC.destination); o.start(BT.next); o.stop(BT.next + 0.07); BT.next += period;
  }
}
function beatToggle(){ audioUnlock(); CS.beat = !CS.beat; saveCS(); BT.next = AC ? AC.currentTime + 0.05 : 0; clearInterval(BT.timer); if(CS.beat) BT.timer = setInterval(beatTick, 25); renderBar(); }

/* ================= cox screen pieces ================= */
function mountCox(){
  // Cox mode switch on the main screen, beside the brightness button
  const cb = document.createElement('button'); cb.className = 'iconbtn'; cb.id = 'coxBtn'; cb.style.fontWeight = '800';
  $c('sunBtn').parentNode.insertBefore(cb, $c('sunBtn'));
  cb.onclick = () => {
    if(run){ toast('Stop the session first, then switch Cox mode'); return; }
    CS.on = !CS.on; saveCS(); renderAll(); renderSettingsCard(); renderMenuCards();
    if(CS.on) liveConnect(); else { liveClose(); if(!CS.beat) micOff(); }
    toast(CS.on ? 'Cox mode on' : 'Cox mode off');
  };
  const live = $c('scr-live');
  const bar = document.createElement('div'); bar.className = 'coxbar'; bar.id = 'coxBar';
  bar.innerHTML = '<button id="cbMic">🎤 MIC</button><button id="cbBeat">♪</button><button id="cbLive">📡</button>';
  live.insertBefore(bar, $c('controls'));
  const pr = document.createElement('div'); pr.className = 'prompt'; pr.id = 'coxPrompt'; pr.onclick = () => pr.classList.remove('on'); document.body.appendChild(pr);
  const cm = document.createElement('div'); cm.className = 'coachmsg'; cm.id = 'coachMsg'; cm.onclick = () => cm.classList.remove('on'); document.body.appendChild(cm);
  $c('cbMic').onclick = async () => { if(!M.stream){ await micOn(); toast(CS.pass === '1' ? 'Mic on — your voice goes to the boat speakers' : 'Mic on (speakers off in Settings)'); return; } M.muted = !M.muted; setPass(); renderBar(); toast(M.muted ? 'Speakers muted (still recording)' : 'Speakers on'); };
  $c('cbBeat').onclick = beatToggle;
  $c('cbLive').onclick = () => { if(!CS.link){ toast('Make a coach link first: Settings › Cox Mode'); return; } if(!L.up){ liveConnect(); toast('Connecting to coach…'); return; } toast(L.listening ? 'Coach is listening live' : (L.coaches ? 'Coach is connected (not listening)' : 'Waiting for the coach to open the link')); };
  // menu + settings cards
  const menuBox = document.createElement('div'); menuBox.id = 'coxMenu'; const hist = document.querySelector('#scr-menu [data-go=history]'); hist.parentNode.insertBefore(menuBox, hist);
  const setBox = document.createElement('div'); setBox.id = 'coxSettings'; const bk = $c('bkOn').closest('.card'); bk.parentNode.insertBefore(setBox, bk);
  const help = document.querySelector('#scr-help .card'); help.insertAdjacentHTML('beforeend', '<br><p><b>Cox mode:</b> turn it on in Settings. Plug a headset mic into the phone. Your voice goes to the boat speakers (wired system or Bluetooth speaker) and is recorded with the boat data. After the session, History shows every call with what the boat did next. Only the cox and anyone with the private coach link can hear recordings.</p><br><p><b>Wireless speakers:</b> pair the phone with one Auracast-enabled JBL speaker, then link more JBL Auracast speakers to it with their Auracast button. Put them at bow, middle and stern.</p><br><p><b>Coach talk-back</b> plays through the boat speakers, so the whole crew hears the coach. Coach text messages show only on the cox’s screen.</p><br><p><b>Check</b> (experimental) is how hard the boat slows at each catch, from the phone’s motion sensor. Lower is better.</p>');
}
function renderBar(){
  const cb = $c('coxBtn'); if(cb){ cb.textContent = 'COX'; cb.style.background = CS.on ? 'var(--good)' : ''; cb.style.color = CS.on ? '#00210f' : ''; }
  const bar = $c('coxBar'); if(!bar) return; bar.classList.toggle('on', !!CS.on);
  const mic = $c('cbMic'); mic.className = !M.stream ? '' : (M.muted ? 'warn' : 'hot'); mic.textContent = !M.stream ? '🎤 MIC OFF' : (M.muted ? '🔇 MUTED' : (M.recording ? '● REC' : '🎤 LIVE'));
  const bt = $c('cbBeat'); bt.className = CS.beat ? 'hot' : ''; bt.textContent = '♪ ' + (CS.beepRate || 28);
  const lv = $c('cbLive'); lv.className = L.listening ? 'live' : ''; lv.textContent = !CS.link ? '📡 NO COACH' : (!L.up ? '📡 OFFLINE' : (L.talking ? '🗣 COACH' : (L.listening ? '🎧 LISTENING' : (L.coaches ? '📡 COACH ON' : '📡 READY'))));
}
const BOATS = { '8':['Cox','Stroke','7','6','5','4','3','2','Bow'], '4':['Cox','Stroke','3','2','Bow'] };
function renderMenuCards(){
  const box = $c('coxMenu'); if(!box) return;
  if(!CS.on){ box.innerHTML = ''; return; }
  const seats = BOATS[CS.crew.boat] || BOATS['8'];
  box.innerHTML = '<div class="card"><h2>Crew</h2><div class="row"><span>Boat</span><div class="seg" id="cxBoat"><button data-v="4">Coxed 4</button><button data-v="8">Eight</button></div></div>' +
    '<div class="crewgrid" style="padding-top:8px">' + seats.map(s => '<span class="muted">' + s + '</span><input data-seat="' + s + '" value="' + esc(CS.crew.names[s] || '') + '" placeholder="Name">').join('') + '</div></div>' +
    '<div class="card"><h2>Race Plan Prompts</h2><textarea class="coxin" id="cxPlan" placeholder="500 Settle into rhythm&#10;1000 Power ten — legs&#10;250 to go Sprint!&#10;1:30 Push for two">' + esc(CS.plan) + '</textarea>' +
    '<p class="muted" style="padding-top:8px">One per line. A number is metres into the piece; "250 to go" counts down to the end of a distance piece; 1:30 is time into the piece. The call pops up big on your screen at that point.</p></div>' +
    '<div class="card"><h2>Rate Beeper</h2><div class="row"><span>Beat (strokes per minute)</span><input type="number" id="cxBeat" min="10" max="60" value="' + (+CS.beepRate || 28) + '"></div><p class="muted" style="padding-top:8px">The ♪ button on the main screen plays a click at this rate through the speakers.</p></div>';
  segBind($c('cxBoat'), CS.crew.boat, v => { CS.crew.boat = v; saveCS(); renderMenuCards(); });
  box.querySelectorAll('[data-seat]').forEach(i => i.addEventListener('change', () => { CS.crew.names[i.dataset.seat] = i.value.trim().slice(0, 40); saveCS(); }));
  $c('cxPlan').addEventListener('change', () => { CS.plan = $c('cxPlan').value.slice(0, 2000); saveCS(); });
  $c('cxBeat').addEventListener('change', () => { CS.beepRate = Math.max(10, Math.min(60, parseInt($c('cxBeat').value) || 28)); saveCS(); renderBar(); });
}
function renderSettingsCard(){
  const box = $c('coxSettings'); if(!box) return;
  const link = CS.link ? location.origin + '/#coach=' + CS.link : '';
  box.innerHTML = '<div class="card"><h2>Cox Mode</h2>' +
    '<div class="row"><span>Cox mode</span><div class="seg" id="cxOn"><button data-v="1">On</button><button data-v="0">Off</button></div></div>' +
    (CS.on ? '<div class="row"><span>Voice to speakers</span><div class="seg" id="cxPass"><button data-v="1">On</button><button data-v="0">Off</button></div></div>' +
    '<div class="row"><span>Speaker volume</span><input type="range" id="cxVol" min="0.2" max="2" step="0.1" value="' + CS.vol + '" style="width:45%"></div>' +
    '<button class="big alt" id="cxTest" style="height:44px;font-size:16px">Mic &amp; speaker check (10 s)</button>' +
    '<div class="row" style="margin-top:8px"><span>Coach live (listen &amp; talk-back)</span><div class="seg" id="cxLive"><button data-v="1">On</button><button data-v="0">Off</button></div></div>' +
    '<p class="muted" style="padding:10px 0 4px">Private coach link — only you and whoever has this link can hear recordings and listen live. Don’t share it with the crew.</p>' +
    (link ? '<p class="code" style="font-size:13px;word-break:break-all">' + esc(link) + '</p><button class="big" id="cxShare" style="height:44px;font-size:16px">Send link to coach</button><button class="big alt" id="cxReset" style="height:44px;font-size:16px">Reset link (old link stops working)</button>'
          : '<button class="big" id="cxMake" style="height:48px;font-size:17px">Create coach link</button>') : '') +
    '<p class="muted" style="padding-top:10px">Use a headset mic plugged into the phone. Recordings back up with your sessions, so Cloud Backup must be on.</p></div>';
  segBind($c('cxOn'), CS.on ? '1' : '0', v => { CS.on = v === '1'; saveCS(); renderSettingsCard(); renderMenuCards(); renderAll(); if(CS.on) liveConnect(); else liveClose(); toast(CS.on ? 'Cox mode on' : 'Cox mode off'); });
  if(!CS.on) return;
  segBind($c('cxPass'), CS.pass, v => { CS.pass = v; saveCS(); setPass(); renderSettingsCard(); });
  segBind($c('cxLive'), CS.live, v => { CS.live = v; saveCS(); renderSettingsCard(); if(v === '1') liveConnect(); else liveClose(); });
  $c('cxVol').oninput = () => { CS.vol = +$c('cxVol').value; saveCS(); setPass(); };
  $c('cxTest').onclick = async () => { const had = !!M.stream, pass = CS.pass; CS.pass = '1'; if(!(await micOn())){ CS.pass = pass; return; } M.muted = false; setPass(); toast('Talk now — you should hear yourself in the speakers'); setTimeout(() => { CS.pass = pass; setPass(); if(!had && !run) micOff(); }, 10000); };
  const mk = async () => { if(location.protocol !== 'https:'){ toast('Open the app from its web address first'); return; } try{ const r = await fetch('/api/cox/share', { method:'POST', headers:{ 'X-Sync-Key':SYNC.key } }); const j = await r.json(); if(!j.token) throw 0; CS.link = j.token; saveCS(); renderSettingsCard(); renderBar(); liveClose(); liveConnect(); toast('Coach link ready'); }catch(e){ toast('Couldn’t make the link — check your connection'); } };
  if($c('cxMake')) $c('cxMake').onclick = mk;
  if($c('cxReset')) $c('cxReset').onclick = () => { if(confirm('Make a new coach link? The old one will stop working.')) mk(); };
  if($c('cxShare')) $c('cxShare').onclick = async () => { try{ if(navigator.share){ await navigator.share({ title:'StrokePulse coach link', text:'Coach link for live listen-in and recordings', url:link }); return; } }catch(e){ if(e.name === 'AbortError') return; } try{ await navigator.clipboard.writeText(link); toast('Link copied'); }catch(e){ toast('Press and hold the link to copy it'); } };
}
function renderAll(){ if(COACH_MODE){ renderCoach(); return; } renderBar(); }

/* ================= session hooks (called by the main app) ================= */
async function sessionStart(){
  if(!CS.on) return;
  if(await micOn()){ recStart(); renderBar(); }
  PL.sid = null; liveConnect();
}
function sessionCancel(){ if(M.recording){ const rec = M.recId; recStop().then(() => idbDelRec(rec)); } }
function sessionStop(r){
  if(!CS.on) return;
  r.crew = { boat:CS.crew.boat, names:Object.assign({}, CS.crew.names) };
  if(!M.recording) return;
  r.cox = { rec:M.recId };
  recStop().then(meta => {
    const sid = r.id, data = LS.get('sp_s_' + sid, null);
    const chunks = meta.sort((a, b) => a.idx - b.idx).map(c => ({ idx:c.idx, t0:+((c.wall - r.start) / 1000).toFixed(2), dur:+c.dur.toFixed(2), mime:c.mime }));
    if(data){ data.cox = { rec:M.recId || r.cox.rec, chunks }; LS.set('sp_s_' + sid, data); const idx = LS.get('sp_index', []); const s = idx.find(x => x.id === sid); if(s){ s.synced = false; s.cox = true; LS.set('sp_index', idx); } }
    const pend = LS.get('sp_audio_pend', []); chunks.forEach(c => pend.push({ sid, rec:r.cox.rec, idx:c.idx, t0:c.t0, dur:c.dur, mime:c.mime })); LS.set('sp_audio_pend', pend);
    if(!run && !CS.beat) setTimeout(() => { if(!run) micOff(); }, 500);
    syncNow();
  });
}
async function syncAudio(){
  if(!CS.on && !LS.get('sp_audio_pend', []).length) return;
  const pend = LS.get('sp_audio_pend', []);
  for(const p of pend.slice()){
    const rec = await idbGet(p.rec + ':' + p.idx).catch(() => null);
    if(!rec){ pend.splice(pend.indexOf(p), 1); LS.set('sp_audio_pend', pend); continue; }
    const q = '?sid=' + p.sid + '&idx=' + p.idx + '&t0=' + p.t0 + '&dur=' + p.dur;
    const r = await fetch('/api/cox/audio' + q, { method:'POST', headers:{ 'X-Sync-Key':SYNC.key, 'Content-Type':p.mime }, body:rec.blob });
    if(!r.ok) throw new Error('audio ' + r.status);
    rec.uploaded = true; await idbPut(rec).catch(() => {});
    pend.splice(pend.indexOf(p), 1); LS.set('sp_audio_pend', pend);
  }
  idbPrune().catch(() => {});
}
function deleteLocal(id){ const data = LS.get('sp_s_' + id, null); const pend = LS.get('sp_audio_pend', []).filter(p => p.sid !== id); LS.set('sp_audio_pend', pend); return data && data.cox ? idbDelRec(data.cox.rec).catch(() => {}) : null; }

/* ================= analysis (used by the cox's History and the coach view) ================= */
function sampleAt(smp, t){ let lo = 0, hi = smp.length - 1; if(hi < 0) return null; while(lo < hi){ const m = (lo + hi) >> 1; if(smp[m][0] < t) lo = m + 1; else hi = m; } return smp[lo]; }
function windowAvg(smp, a, b){ let v = 0, r = 0, n = 0, rest = 0; for(const s of smp){ if(s[0] < a) continue; if(s[0] >= b) break; v += s[4]; r += s[5]; n++; if(s[7]) rest++; } return n ? { v:v / n, r:r / n, n, rest } : null; }
function analyse(data, chunks){
  const smp = data.samples || [], T = smp.length ? smp[smp.length - 1][0] : 0;
  const calls = [];
  for(const c of chunks) for(const s of (c.tx || [])) calls.push({ t:c.t0 + s.s, e:c.t0 + s.e, text:s.t, idx:c.idx });
  calls.sort((a, b) => a.t - b.t);
  for(const c of calls){
    c.cat = categorize(c.text);
    const b = windowAvg(smp, c.t - 20, c.t), a = windowAvg(smp, c.t + 2, c.t + 22);
    // only judge calls made while the boat was properly moving, with a full 20 s either side
    if(b && a && c.t >= 20 && b.n >= 12 && a.n >= 12 && b.v > 1.5 && a.v > 1.5 && !b.rest && !a.rest){
      const ds = splitSec(a.v) - splitSec(b.v); if(Math.abs(ds) < 25){ c.dSplit = ds; c.dRate = a.r - b.r; } }
  }
  const talk = calls.reduce((s, c) => s + Math.max(0, c.e - c.t), 0);
  let longest = 0, prev = 0; for(const c of calls){ const s0 = sampleAt(smp, c.t); if(s0 && !s0[7]) longest = Math.max(longest, c.t - prev); prev = c.e; }
  if(T) longest = Math.max(longest, T - prev);
  const byCat = {};
  for(const c of calls){ const k = c.cat.k; const o = byCat[k] || (byCat[k] = { k, c:c.cat.c, n:0, ds:0, dr:0, m:0 }); o.n++; if(c.dSplit != null){ o.ds += c.dSplit; o.dr += c.dRate; o.m++; } }
  const phrases = {}; for(const c of calls){ const p = c.text.toLowerCase().replace(/[^a-z0-9' ]+/g, '').trim(); if(p.length > 1 && p.length < 40) phrases[p] = (phrases[p] || 0) + 1; }
  const top = Object.entries(phrases).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const effective = calls.filter(c => c.dSplit != null).sort((a, b) => a.dSplit - b.dSplit);
  return { calls, T, talk, longest, cats:Object.values(byCat).sort((a, b) => b.n - a.n), top, best:effective.slice(0, 3) };
}
const sgn = (x, d) => (x > 0 ? '+' : '') + x.toFixed(d);
function fxHtml(c){ if(c.dSplit == null) return '<span class="muted">—</span>'; return '<span class="' + (c.dSplit < -0.4 ? 'g' : c.dSplit > 0.4 ? 'b' : '') + '">' + sgn(c.dSplit, 1) + 's</span><br>' + sgn(c.dRate, 1) + ' spm'; }
async function renderAnalysis(box, opts){
  const { data, sid, getChunks, getAudio, retx } = opts;
  box.innerHTML = '<div class="card"><h2>Cox Calls</h2><p class="muted" id="cxaStat">Loading the recording…</p></div>';
  let chunks = [], tries = 0;
  const load = async () => {
    try{ chunks = await getChunks(); }catch(e){ $c('cxaStat') && ($c('cxaStat').textContent = 'Recording not available offline yet — it will appear once it has uploaded.'); return; }
    const local = (opts.localChunks ? opts.localChunks() : (data.cox && data.cox.chunks)) || [];
    if(!chunks.length && !local.length && tries++ < 20){ $c('cxaStat') && ($c('cxaStat').textContent = 'Saving the recording…'); setTimeout(load, 2000); return; }
    if(!chunks.length && local.length && !opts.localOk){ $c('cxaStat') && ($c('cxaStat').textContent = 'Uploading the recording (' + local.length + ' minute' + (local.length > 1 ? 's' : '') + ')… transcripts follow a minute later.'); if(tries++ < 40) setTimeout(load, 8000); return; }
    const waiting = chunks.filter(c => c.status === 'new' || c.status === 'local').length;
    if(waiting && tries++ < 40){ $c('cxaStat') && ($c('cxaStat').textContent = 'Transcribing ' + waiting + ' of ' + chunks.length + ' minutes…'); if(tries === 8 && retx) retx(); setTimeout(load, 6000); }
    draw();
  };
  const draw = () => {
    if(!box.isConnected) return;
    const A = analyse(data, chunks), smp = data.samples || [];
    const pct = A.T ? Math.round(A.talk / A.T * 100) : 0, failed = chunks.filter(c => c.status === 'error' || c.status === 'no_ai').length;
    let h = '<div class="card"><h2>Cox Calls</h2>' + (chunks.some(c => c.status === 'new' || c.status === 'local') ? '<p class="muted" id="cxaStat">' + (chunks.some(c => c.status === 'local') ? 'Uploading the recording — transcript follows.' : 'Still transcribing — more calls will appear.') + '</p>' : '') +
      (failed ? '<p class="muted">' + failed + ' minute(s) couldn’t be transcribed, but the audio is still here to play.</p>' : '') +
      '<div class="grid3">' + stat('Calls', A.calls.length) + stat('Talk time', pct + '%') + stat('Longest quiet', fmtTime(A.longest)) + '</div>' +
      '<canvas id="cxaChart" height="210" style="margin-top:12px"></canvas>' +
      '<p class="muted" style="margin-top:6px">Lines: <span style="color:var(--acc)">■</span> split (higher = faster) <span style="color:var(--warn)">■</span> rate. Ticks = calls, coloured by type. Tap the chart to jump there.</p>' +
      '<div class="player"><button id="cxaPlay">▶</button><input type="range" id="cxaPos" min="0" max="' + Math.max(1, Math.ceil(A.T)) + '" step="1" value="0"><span class="pt" id="cxaPT">0:00</span></div></div>';
    if(A.cats.length) h += '<div class="card"><h2>What each type of call did</h2><table><tr><th>Type</th><th>Calls</th><th>Split after</th><th>Rate after</th></tr>' +
      A.cats.map(c => '<tr><td><span class="chip" style="background:' + c.c + '">' + c.k + '</span></td><td>' + c.n + '</td><td>' + (c.m ? sgn(c.ds / c.m, 1) + 's' : '—') + '</td><td>' + (c.m ? sgn(c.dr / c.m, 1) : '—') + '</td></tr>').join('') +
      '</table><p class="muted" style="margin-top:8px">Average change in the 20 s after a call vs the 20 s before. Negative split = boat got faster. One session is a hint, not proof — look for patterns over several.</p></div>';
    if(A.best.length) h += '<div class="card"><h2>Calls that moved the boat most</h2>' + A.best.map(c => callRow(c)).join('') + '</div>';
    h += '<div class="card"><h2>Every call</h2><div class="calls" id="cxaList">' + (A.calls.length ? A.calls.map(c => callRow(c)).join('') : '<p class="muted">No calls transcribed yet.</p>') + '</div></div>';
    if(A.top.length) h += '<div class="card"><h2>Most used</h2>' + A.top.map(([p, n]) => '<div class="row"><span>“' + esc(p) + '”</span><b>' + n + '×</b></div>').join('') + '</div>';
    if(smp.some(s => s[1] != null)) h += '<div class="card"><h2>Course replay</h2><canvas id="cxaTrack" height="260"></canvas><p class="muted" style="margin-top:6px">Press ▶ above to hear the cox while the dot follows the boat.</p></div>';
    box.innerHTML = h;
    wire(A, smp);
  };
  const callRow = c => '<div class="call" data-t="' + c.t.toFixed(1) + '"><span class="tm">' + fmtTime(Math.max(0, c.t)) + '</span><span class="tx"><span class="chip" style="background:' + c.cat.c + '">' + c.cat.k + '</span> ' + esc(c.text) + '</span><span class="fx">' + fxHtml(c) + '</span></div>';
  const P = { audio:new Audio(), cur:null, t:0, playing:false, urls:{} };
  window.__cxaP = P;
  const urlFor = async idx => P.urls[idx] || (P.urls[idx] = await getAudio(idx));
  const chunkAt = t => { let best = null; for(const c of chunks){ if(t >= c.t0 - 0.5 && t < c.t0 + c.dur) return c; if(c.t0 > t && !best) best = c; } return best; };
  async function playAt(t){
    const c = chunkAt(t); if(!c){ P.playing = false; ui(); return; }
    try{ P.audio.src = await urlFor(c.idx); }catch(e){ toast('Couldn’t load that part of the recording'); return; }
    P.cur = c; P.playing = true;
    const off = Math.max(0, t - c.t0);
    const go = () => { try{ P.audio.currentTime = off; }catch(e){} P.audio.play().catch(() => { P.playing = false; ui(); }); };
    if(P.audio.readyState >= 1) go(); else P.audio.addEventListener('loadedmetadata', go, { once:true });
    ui();
  }
  P.audio.addEventListener('timeupdate', () => { if(P.cur){ P.t = P.cur.t0 + P.audio.currentTime; ui(); } });
  P.audio.addEventListener('ended', () => { if(!P.cur) return; const next = chunks.find(c => c.idx === P.cur.idx + 1); if(next && P.playing) playAt(next.t0); else { P.playing = false; ui(); } });
  let A0 = null, smp0 = [];
  function ui(){
    const b = $c('cxaPlay'); if(!b) { P.audio.pause(); return; }
    b.textContent = P.playing ? '❚❚' : '▶'; const pos = $c('cxaPos'); if(document.activeElement !== pos) pos.value = Math.round(P.t); $c('cxaPT').textContent = fmtTime(Math.max(0, P.t));
    drawTimeline(); drawTrack();
    document.querySelectorAll('#cxaList .call').forEach(el => { const t = +el.dataset.t; el.classList.toggle('sel', P.t >= t - 0.2 && P.t < t + 4); });
  }
  function drawTimeline(){
    const c = $c('cxaChart'); if(!c || !A0) return; const [x, w, h] = canvasSetup(c); const T = A0.T || 1;
    const vs = smp0.map(s => s[4]).filter(v => v > 0.3), vMax = Math.max(1, ...vs), vMin = Math.max((+S.splitBase) / 300, Math.min(vMax * 0.6, ...vs)), rMax = Math.max(40, ...smp0.map(s => s[5]));
    x.fillStyle = cssVar('--line'); smp0.forEach(s => { if(s[7]) x.fillRect(s[0] / T * w, 0, Math.max(1, w / T), h); });
    const line = (col, fy) => { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); let st = false; smp0.forEach(s => { const y = fy(s); if(y == null){ st = false; return; } const px = s[0] / T * w; if(!st){ x.moveTo(px, y); st = true; } else x.lineTo(px, y); }); x.stroke(); };
    line(cssVar('--acc'), s => s[4] > 0.3 ? h - 8 - Math.max(0, (s[4] - vMin) / (vMax - vMin || 1)) * (h - 30) : null);
    line(cssVar('--warn'), s => h - 8 - s[5] / rMax * (h - 30));
    for(const cl of A0.calls){ x.fillStyle = cl.cat.c; x.fillRect(cl.t / T * w - 1, 0, 3, 16); }
    x.strokeStyle = cssVar('--fg'); x.lineWidth = 1; x.beginPath(); x.moveTo(P.t / T * w, 0); x.lineTo(P.t / T * w, h); x.stroke();
  }
  function drawTrack(){
    const c = $c('cxaTrack'); if(!c) return; const pts = smp0.filter(s => s[1] != null); if(pts.length < 2) return;
    const [x, w, h] = canvasSetup(c); const k = Math.cos(pts[0][1] * Math.PI / 180);
    const minX = Math.min(...pts.map(p => p[2])) * k, maxX = Math.max(...pts.map(p => p[2])) * k, minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
    const sc = Math.min((w - 20) / ((maxX - minX) || 1e-6), (h - 20) / ((maxY - minY) || 1e-6)), ox = (w - (maxX - minX) * sc) / 2, oy = (h - (maxY - minY) * sc) / 2;
    const Pt = p => [ox + (p[2] * k - minX) * sc, h - oy - (p[1] - minY) * sc];
    x.strokeStyle = cssVar('--acc'); x.lineWidth = 3; x.lineJoin = 'round'; x.beginPath(); pts.forEach((p, i) => { const [a, b] = Pt(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke();
    for(const cl of A0.calls){ const s = sampleAt(pts, cl.t); if(!s) continue; const [a, b] = Pt(s); x.fillStyle = cl.cat.c; x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); }
    const cur = sampleAt(pts, P.t); if(cur){ const [a, b] = Pt(cur); x.fillStyle = cssVar('--fg'); x.beginPath(); x.arc(a, b, 8, 0, 7); x.fill(); }
  }
  function wire(A, smp){
    A0 = A; smp0 = smp;
    $c('cxaPlay').onclick = () => { if(P.playing){ P.audio.pause(); P.playing = false; ui(); } else playAt(P.t); };
    $c('cxaPos').onchange = () => { P.t = +$c('cxaPos').value; if(P.playing) playAt(P.t); else ui(); };
    $c('cxaChart').onclick = e => { const r = e.target.getBoundingClientRect(); P.t = (e.clientX - r.left) / r.width * (A.T || 1); playAt(P.t); };
    box.querySelectorAll('.call').forEach(el => el.onclick = () => { P.t = Math.max(0, +el.dataset.t - 0.3); playAt(P.t); });
    ui();
  }
  load();
}
function detail(id, sm, data){
  const box = $c('coxBox'); if(!box || !data || !data.cox) { if(box && data && data.crew) box.innerHTML = crewCard(data.crew); return; }
  const recId = data.cox.rec;
  box.innerHTML = '';
  const inner = document.createElement('div'); box.appendChild(inner);
  if(data.crew) box.insertAdjacentHTML('afterbegin', crewCard(data.crew));
  const H = { 'X-Sync-Key':SYNC.key };
  renderAnalysis(inner, { data, sid:id,
    getChunks: async () => {
      if(location.protocol === 'https:' && navigator.onLine){ const r = await fetch('/api/cox/chunks?sid=' + id, { headers:H, cache:'no-store' }); if(r.ok){ const j = await r.json(); if(j.chunks.length) return j.chunks; } }
      const fresh = LS.get('sp_s_' + id, data) || data; return ((fresh.cox && fresh.cox.chunks) || []).map(c => Object.assign({ tx:[], status:'local' }, c));
    },
    localChunks: () => { const fresh = LS.get('sp_s_' + id, data) || data; return (fresh.cox && fresh.cox.chunks) || []; },
    localOk: true,
    getAudio: async idx => { const rec = await idbGet(recId + ':' + idx).catch(() => null); if(rec && rec.blob) return URL.createObjectURL(rec.blob);
      const r = await fetch('/api/cox/audio?sid=' + id + '&idx=' + idx, { headers:H }); if(!r.ok) throw 0; return URL.createObjectURL(await r.blob()); },
    retx: () => fetch('/api/cox/retx?sid=' + id, { method:'POST', headers:H }).catch(() => {})
  });
}
function crewCard(crew){ const seats = BOATS[crew.boat] || BOATS['8']; const names = seats.filter(s => crew.names && crew.names[s]); if(!names.length) return '';
  return '<div class="card"><h2>Crew</h2>' + names.map(s => '<div class="row"><span class="muted">' + s + '</span><b>' + esc(crew.names[s]) + '</b></div>').join('') + '</div>'; }

/* ================= coach view (#coach=TOKEN) ================= */
const CH = { listen:false, talking:false, tel:null, telAt:0, tab:'live', mic:false, sessions:null };
const CH_QUICK = ['Rate up 2', 'Settle 2', 'Lengthen out', 'Legs!', 'Good — hold that', 'Weigh enough', 'Spin & go again', 'Next piece in 1 min'];
function coachMount(){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const sec = document.createElement('section'); sec.className = 'screen on'; sec.id = 'scr-coach';
  sec.innerHTML = '<div class="status"><span class="brand" style="display:inline">STROKEPULSE COACH</span><span><span class="dot" id="chDot"></span><span id="chSt">Connecting…</span></span><span class="sp"></span><button class="iconbtn" id="chSun">☀︎</button></div>' +
    '<div class="seg" style="margin:10px" id="chTabs"><button data-v="live" style="flex:1">Live</button><button data-v="sessions" style="flex:1">Sessions</button></div>' +
    '<div class="body" id="chBody"></div>';
  document.body.appendChild(sec);
  $c('chSun').onclick = () => { S.theme = { dark:'bright', bright:'night', night:'dark' }[S.theme] || 'dark'; saveSettings(); applyGlare(); };
  document.title = 'StrokePulse Coach';
  liveConnect(); renderCoach();
  setInterval(() => { if(CH.tab === 'live') coachTelDraw(); }, 1000);
}
function coachSendListen(){ send({ t:'listen', on:CH.listen }); }
function coachTel(m){ CH.tel = m; CH.telAt = Date.now(); coachTelDraw(); }
function coachTelDraw(){
  const g = $c('chTele'); if(!g) return; const m = CH.tel, fresh = m && Date.now() - CH.telAt < 5000;
  const cell = (k, v, u) => '<div><div class="k">' + k + (u ? ' <span style="text-transform:none">' + esc(u) + '</span>' : '') + '</div><div class="v">' + esc(v) + '</div></div>';
  g.innerHTML = !fresh ? '<div style="grid-column:span 2"><div class="k">Boat</div><div class="v" style="font-size:22px">' + (L.coxOnline ? 'Cox connected — numbers appear when they start' : 'Cox app not connected') + '</div></div>' :
    cell('Split', m.split, m.splitU) + cell('Rate', m.rate, 'spm') + cell(m.reps ? 'Piece ' + m.rep + '/' + m.reps + (m.phase === 'rest' ? ' (rest)' : '') : 'Distance', m.dist, m.distU) + cell('Time', m.time) + cell('Total', m.total) + cell('Check', m.check, 'm/s²');
  const st = $c('chMicSt'); if(st) st.textContent = fresh ? (m.mic ? (m.muted ? 'Cox mic on (speakers muted)' : 'Cox mic on') : 'Cox mic off — they tap MIC or START') : '';
}
function renderCoach(){
  const dot = $c('chDot'), st = $c('chSt'); if(!dot) return;
  dot.className = 'dot' + (L.up ? (L.coxOnline ? ' ok' : ' mid') : '');
  st.textContent = !L.up ? 'Offline' : (L.coxOnline ? 'Cox online' : 'Waiting for cox');
  segBind($c('chTabs'), CH.tab, v => { CH.tab = v; renderCoach(); });
  const body = $c('chBody');
  if(CH.tab === 'live'){
    if(!$c('chTele')){
      body.innerHTML = '<div class="tele" id="chTele"></div><p class="muted" id="chMicSt" style="margin-bottom:8px"></p>' +
        '<button class="big" id="chListen" style="height:64px;font-size:22px">🎧 Listen live</button>' +
        '<button class="talk" id="chTalk">HOLD TO TALK</button><p class="muted" style="margin-top:6px">Talk-back plays through the boat speakers — the whole crew hears you.</p>' +
        '<div class="card" style="margin-top:12px"><h2>Message to cox only</h2><div class="quick">' + CH_QUICK.map(q => '<button data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px"><input class="coxin" id="chText" maxlength="120" placeholder="Type a message"><button class="iconbtn" id="chSend" style="padding:0 16px;font-weight:800">Send</button></div></div>';
      $c('chListen').onclick = () => { audioUnlock(); CH.listen = !CH.listen; coachSendListen(); if(L.player && AC) L.player.next = 0; renderCoach(); };
      const talk = $c('chTalk');
      const down = async e => { e.preventDefault(); audioUnlock(); if(!M.stream){ const ok = await coachMic(); if(!ok) return; } CH.talking = true; send({ t:'talk', on:true }); talk.classList.add('on'); talk.textContent = 'TALKING…'; };
      const up = () => { if(!CH.talking) return; CH.talking = false; send({ t:'talk', on:false }); talk.classList.remove('on'); talk.textContent = 'HOLD TO TALK'; if(L.player && AC) L.player.next = 0; };
      talk.addEventListener('pointerdown', down); talk.addEventListener('pointerup', up); talk.addEventListener('pointercancel', up); talk.addEventListener('pointerleave', up);
      body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { send({ t:'msg', text:b.dataset.q }); toast('Sent to cox: ' + b.dataset.q); });
      $c('chSend').onclick = () => { const t = $c('chText').value.trim(); if(!t) return; send({ t:'msg', text:t.slice(0, 120) }); $c('chText').value = ''; toast('Sent to cox'); };
    }
    const lb = $c('chListen'); lb.textContent = CH.listen ? '🎧 Listening — tap to stop' : '🎧 Listen live'; lb.className = 'big' + (CH.listen ? '' : ' alt');
    coachTelDraw();
  } else {
    if(CH.sessions === null){ body.innerHTML = '<p class="muted">Loading sessions…</p>'; coachLoadSessions(); return; }
    if(!CH.sessions.length){ body.innerHTML = '<p class="muted">No sessions backed up yet.</p>'; return; }
    body.innerHTML = '<div class="list">' + CH.sessions.map(s => { const sm = s.summary, d = new Date(sm.start);
      return '<button class="item" data-id="' + s.id + '"><div class="t1">' + d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) + ' · ' + clock12(d) + (sm.cox ? ' · 🎙' : '') + '</div><div class="t2">' + fmtDist(sm.dist) + ' ' + distUnit(sm.dist) + ' · ' + fmtTime(sm.time) + ' · avg ' + (sm.time > 0 ? fmtSplit(sm.dist / sm.time) : '–') + splitLabel() + ' · ' + esc(sm.wkDesc) + '</div></button>'; }).join('') + '</div>';
    body.querySelectorAll('.item').forEach(b => b.onclick = () => coachSession(+b.dataset.id));
  }
}
async function coachMic(){
  try{ M.stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); }catch(e){ toast('Microphone blocked — allow it to talk to the boat'); return false; }
  const src = AC.createMediaStreamSource(M.stream); M.sink = AC.createGain(); M.sink.gain.value = 0; M.sink.connect(AC.destination);
  M.proc = AC.createScriptProcessor(4096, 1, 1); src.connect(M.proc); M.proc.connect(M.sink); M.proc.onaudioprocess = e => liveAudio(e.inputBuffer.getChannelData(0));
  toast('Mic ready — hold the button and talk'); return true;
}
const CHH = () => ({ 'X-Coach-Token':COACH_TOKEN });
async function coachLoadSessions(){ try{ const r = await fetch('/api/sync/list', { headers:CHH(), cache:'no-store' }); if(!r.ok) throw r.status; CH.sessions = (await r.json()).sessions || []; }catch(e){ $c('chBody').innerHTML = '<p class="muted">' + (e === 400 ? 'This coach link has been reset or isn’t valid. Ask the cox for the new link.' : 'Couldn’t load sessions — check your connection.') + '</p>'; return; } renderCoach(); }
async function coachSession(id){
  const body = $c('chBody'); body.innerHTML = '<p class="muted">Loading…</p>';
  let data; try{ const r = await fetch('/api/sync/get?id=' + id, { headers:CHH() }); data = (await r.json()).data; }catch(e){ body.innerHTML = '<p class="muted">Couldn’t load that session.</p>'; return; }
  const sm = CH.sessions.find(s => s.id === id).summary, T = sm.time;
  body.innerHTML = '<button class="iconbtn" id="chBack" style="margin-bottom:10px">‹ Sessions</button><div class="card"><div class="grid3">' + stat('Distance', fmtDist(sm.dist) + ' ' + distUnit(sm.dist)) + stat('Time', fmtTime(T)) + stat('Avg Split', T > 0 ? fmtSplit(sm.dist / T) : '–') + stat('Avg Rate', T > 0 ? (sm.strokes / T * 60).toFixed(1) : '0') + stat('Strokes', sm.strokes) + stat('Workout', esc(sm.wkDesc)) + '</div></div>' + (data.crew ? crewCard(data.crew) : '') + '<div id="chAn"></div>';
  $c('chBack').onclick = () => renderCoach();
  if(!data.cox){ $c('chAn').innerHTML = '<p class="muted">No cox recording for this session.</p>'; return; }
  renderAnalysis($c('chAn'), { data, sid:id,
    getChunks: async () => { const r = await fetch('/api/cox/chunks?sid=' + id, { headers:CHH(), cache:'no-store' }); if(!r.ok) throw 0; return (await r.json()).chunks; },
    getAudio: async idx => { const r = await fetch('/api/cox/audio?sid=' + id + '&idx=' + idx, { headers:CHH() }); if(!r.ok) throw 0; return URL.createObjectURL(await r.blob()); } });
}

/* ================= boot ================= */
window.COX = { sessionStart, sessionStop, sessionCancel, syncAudio, deleteLocal, detail, accel:ckAccel, stroke:ckStroke, checkVal,
  checkStr:() => { const v = checkVal(); return v ? v.toFixed(1) : '–'; }, menu:renderMenuCards, settings:renderSettingsCard, on:() => !!CS.on,
  _test:{ categorize, analyse, parsePlan, ulawEnc, ulawDec, encodeFrame, CS, L, M, CH } };
if(COACH_MODE){ coachMount(); return; }
mountCox(); renderBar();
setInterval(() => { planTick(); if(CS.on) renderBar(); }, 250);
setInterval(telemetry, 1000);
if(CS.beat && CS.on){ CS.beat = false; saveCS(); }
window.addEventListener('online', () => liveConnect());
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') liveConnect(); });
setTimeout(liveConnect, 1500);
})();
