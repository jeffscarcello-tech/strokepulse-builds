import asyncio, json, base64
from playwright.async_api import async_playwright
U='https://127.0.0.1:8787/'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
SEED = r"""
()=>{
 const mk=(id,start,base,intervals)=>{ const smp=[], laps=[]; let d=0,n=0,lat=50.14,lon=-96.87, t=0;
   const pieces = intervals ? 4 : 1, len = intervals ? 500 : 3000;
   for(let p=0;p<pieces;p++){ const t0=t, d0=d, n0=n;
     while(d-d0<len){ const rate = intervals ? 26+p+ (t%60<30?2:-2) : 18+ Math.floor(t/60)%4*4; const v = base + 0.09*(rate-24) - (intervals? p*0.05:0) + Math.sin(t)*0.1;
       d+=v; n+=rate/60; lat += v/111000*(p%2?-1:1); smp.push([t,+lat.toFixed(6),lon,+d.toFixed(1),+v.toFixed(2),rate,Math.floor(n),0,0]); t++; }
     if(intervals){ laps.push({n:laps.length+1,type:'work',t:t-t0,d:d-d0,s:Math.floor(n)-Math.floor(n0),at:t,rep:p+1,rate:(n-n0)/(t-t0)*60});
       for(let r=0;r<60;r++){ smp.push([t,+lat.toFixed(6),lon,+d.toFixed(1),0.3,0,Math.floor(n),1,0]); t++; } laps.push({n:laps.length+1,type:'rest',t:60,d:0,s:0,at:t,rep:p+1,rate:0}); } }
   const wk = intervals?{mode:'intervals',type:'dist',val:500,reps:4,rest:60}:{mode:'justgo'};
   localStorage.setItem('sp_s_'+id, JSON.stringify({samples:smp,laps,wk, cox: id===4?{rec:'r4',chunks:[{idx:0,t0:0,dur:60,mime:'audio/mp4'}]}:undefined}));
   return {id,start,dist:d,time:t,strokes:Math.floor(n),wkDesc:intervals?'4×500m':'Just Go',cox:id===4};
 };
 const day=864e5, now=Date.now();
 const idx=[mk(4,now-1*day,3.6,false), mk(3,now-2*day,3.9,true), mk(2,now-5*day,3.8,true), mk(1,now-9*day,3.7,true)];
 localStorage.setItem('sp_index', JSON.stringify(idx));
 localStorage.setItem('sp_sync', JSON.stringify({on:false,key:'k'.repeat(32)}));
}
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True, is_mobile=True, ignore_https_errors=True, service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append('console: '+m.text))
        wx={'n':0}
        async def meteo(route):
            wx['n']+=1; hrs=[f"2026-11-{d:02d}T{h:02d}:00" for d in range(1,31) for h in range(24)]
            await route.fulfill(json={'utc_offset_seconds':-21600,'hourly':{'time':hrs,'temperature_2m':[4.0]*len(hrs),'wind_speed_10m':[18.0]*len(hrs),'wind_direction_10m':[0]*len(hrs),'wind_gusts_10m':[30.0]*len(hrs),'weather_code':[2]*len(hrs)}})
        await pg.route('**/*open-meteo.com/**', meteo)
        await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=PNG, content_type='image/png'))
        async def chunks(route):
            W=[[22,22.3,'Power'],[22.3,22.6,'ten'],[22.6,22.9,'now.'],[40,40.3,'Legs,'],[40.3,40.6,'legs!']]
            await route.fulfill(json={'chunks':[{'idx':0,'t0':0,'dur':60,'status':'done','tx':[{'s':0,'e':60,'t':'x','w':W}]}]})
        await pg.route('**/api/cox/chunks*', chunks)
        await pg.goto(U); await pg.wait_for_timeout(300)
        await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(500)
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(300)
        print('history:', await pg.evaluate("[...document.querySelectorAll('#histList .item')].map(i=>i.innerText.replace(/\\n/g,' | '))"))
        print('tools:', await pg.evaluate("document.getElementById('histTools').innerText"))
        await pg.screenshot(path='a_history.png')
        # detail of interval session 3
        await pg.tap('#histList .item[data-id="3"]'); await pg.wait_for_timeout(1500)
        print('detail stats:', await pg.evaluate("[...document.querySelectorAll('#dBody .stat')].map(s=>s.innerText.replace(/\\n/g,': ')).join(' / ')"))
        print('wx:', await pg.evaluate("document.getElementById('anaWx').innerText"), 'calls', wx['n'])
        print('map:', await pg.evaluate("!!document.querySelector('#anaMap .leaflet-container, #anaMap.leaflet-container')"), await pg.evaluate("document.querySelectorAll('#anaMap path').length"))
        print('cards:', await pg.evaluate("[...document.querySelectorAll('#dBody .card h2')].map(h=>h.textContent)"))
        print('pieces:', await pg.evaluate("[...document.querySelectorAll('#dBody .card')].find(c=>c.querySelector('h2')?.textContent==='Piece comparison')?.innerText.slice(0,400)"))
        print('rate:', await pg.evaluate("[...document.querySelectorAll('#dBody .card')].find(c=>c.querySelector('h2')?.textContent==='Split vs rate')?.querySelector('p').innerText"))
        print('same:', await pg.evaluate("[...document.querySelectorAll('#dBody .card')].find(c=>c.querySelector('h2')?.textContent==='Same workout over time')?.querySelector('p').innerText"))
        await pg.screenshot(path='a_detail.png', full_page=False)
        for i,y in enumerate([700,1500,2300,3100,3900]):
            await pg.evaluate(f"document.getElementById('dBody').scrollTop={y}"); await pg.wait_for_timeout(150); await pg.screenshot(path=f'a_detail{i}.png')
        # notes
        await pg.fill('#anaNotes','windy, good catches'); await pg.evaluate("document.getElementById('anaNotes').dispatchEvent(new Event('change'))")
        print('notes saved:', await pg.evaluate("JSON.parse(localStorage.getItem('sp_s_3')).notes"), 'weather saved:', await pg.evaluate("!!JSON.parse(localStorage.getItem('sp_s_3')).weather"))
        # same workout -> compare
        await pg.tap('#sameCmp'); await pg.wait_for_timeout(1500)
        print('compare head:', await pg.evaluate("document.querySelector('.cmphead').innerText.replace(/\\n/g,' | ')"))
        print('compare stats:', await pg.evaluate("document.querySelector('.cmpt').innerText.replace(/\\t/g,' ').split('\\n').slice(0,16)"))
        print('compare cards:', await pg.evaluate("[...document.querySelectorAll('#cmpBody .card h2')].map(h=>h.textContent)"))
        for i,y in enumerate([0,800,1600,2400]):
            await pg.evaluate(f"document.getElementById('cmpBody').scrollTop={y}"); await pg.wait_for_timeout(150); await pg.screenshot(path=f'a_cmp{i}.png')
        # pick mode compare from History
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(200)
        await pg.tap('#cmpStart'); await pg.tap('#histList .item[data-id="4"]'); await pg.tap('#histList .item[data-id="1"]')
        print('bar:', await pg.evaluate("document.getElementById('cmpGo').textContent"))
        await pg.screenshot(path='a_pick.png')
        await pg.tap('#cmpGo'); await pg.wait_for_timeout(800)
        print('screen:', await pg.evaluate("document.querySelector('.screen.on').id"))
        # cox session detail + report
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(200)
        await pg.tap('#histList .item[data-id="4"]'); await pg.wait_for_timeout(3000)
        print('cox cards:', await pg.evaluate("[...document.querySelectorAll('#dBody .card h2')].map(h=>h.textContent)"))
        print('call markers on map:', await pg.evaluate("document.querySelectorAll('#anaMap path').length"))
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(200)
        await pg.tap('#coxRep'); await pg.wait_for_timeout(1500)
        print('cox report:', await pg.evaluate("document.getElementById('crBody').innerText.slice(0,700)"))
        await pg.screenshot(path='a_coxrep.png')
        # weight + live cal
        await pg.evaluate("go('settings')"); await pg.wait_for_timeout(200); await pg.fill('#stWeight','80'); await pg.evaluate("document.getElementById('stWeight').dispatchEvent(new Event('change'))")
        print('weightKg', await pg.evaluate("window.__SP.S.weightKg"), 'cal metric in picker:', await pg.evaluate("typeof METRICS!=='undefined' && !!METRICS.cal"))
        # dark->bright check map legend
        print('errors', errs); await b.close()
asyncio.run(main())
