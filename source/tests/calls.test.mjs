// run cox.js analysis functions in node with tiny stubs
import fs from 'node:fs'; import vm from 'node:vm';
const src = fs.readFileSync(new URL('../cox.js', import.meta.url), 'utf8');
const store = {}; const ctx = { LS:{ get:(k,d)=>store[k]??d, set:(k,v)=>{store[k]=v;return true} }, location:{ hash:'', protocol:'https:', host:'x', origin:'https://x' },
  document:{ createElement:()=>({ style:{}, appendChild(){}, insertAdjacentHTML(){}, set textContent(v){} }), head:{ appendChild(){} }, getElementById:()=>null, querySelector:()=>null, addEventListener(){} },
  window:{}, setInterval(){}, setTimeout(){}, navigator:{}, S:{ splitBase:'500' }, splitSec:v=>v>0.3?500/v:null, console };
ctx.window = ctx; vm.createContext(ctx);
try { vm.runInContext(src, ctx); } catch(e) { /* mountCox touches the DOM; the functions we need are defined before that */ }
const T = ctx.COX ? ctx.COX._test : null;
if(!T) { console.log('module did not expose test hooks before DOM mount'); process.exit(1); }
// "Power ten in two" … 5 s silence … "Legs legs" … 1 s … "rate up two" … then a run-on sentence with no pause
const W = (t, w) => [t, t + 0.35, w];
const chunks = [{ t0: 10, tx: [{ s:0, e:20, t:'...', w:[ W(0,'Power'), W(0.4,'ten'), W(0.8,'in'), W(1.2,'two.'), W(6.5,'Legs,'), W(6.9,'legs!'), W(8.3,'Okay'), W(8.7,'bring'), W(9.1,'the'), W(9.5,'rate'), W(9.9,'up'), W(10.3,'two.'), W(13,'Nice'), W(13.4,'work'), W(13.8,'everyone') ] }] }];
const calls = T.buildCalls(chunks);
for (const c of calls) console.log(c.t.toFixed(2), '| starts', c.start.toFixed(2), '|', c.cat.k, '|', c.html);
if (calls.length !== 4) throw new Error('expected 4 calls, got ' + calls.length);
if (Math.abs(calls[0].t - 10) > 0.01) throw new Error('call 1 should be timed at "Power"');
if (Math.abs(calls[2].t - 19.5) > 0.01) throw new Error('call 3 should be timed at "rate" (19.5), got ' + calls[2].t);
console.log('CALL SPLIT TESTS PASSED');
