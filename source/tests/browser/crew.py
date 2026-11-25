import asyncio, json
from playwright.async_api import async_playwright
exec(open('/home/claude/tests/cox/train_seed.py').read().split('async def main')[0])
FAKE_GM = r"""
(function(){ const log = window.__gmlog = [];
 class LatLng{ constructor(a,b){ this.a=a; this.b=b; } lat(){return this.a} lng(){return this.b} }
 class Map{ constructor(el,o){ this.el=el; this.o=o; el.innerHTML='<div class="fakegm" style="width:100%;height:100%;background:#335">GOOGLE '+o.mapTypeId+'</div>'; log.push(['map',o.mapTypeId,o.gestureHandling]); this.ls={}; window.__gmMap=this; }
   setMapTypeId(t){ this.o.mapTypeId=t; this.el.querySelector('.fakegm').textContent='GOOGLE '+t; log.push(['type',t]); }
   fitBounds(b){ log.push(['fit']); } panTo(p){ log.push(['pan',p.lat,p.lng]); } addListener(n,f){ this.ls[n]=f; } }
 class Polyline{ constructor(o){ log.push(['line',o.strokeColor,o.path.length]); } }
 class Marker{ constructor(o){ this.o=o; log.push(['marker',o.title||'',o.position.lat]); } setPosition(p){ this.o.position=p; log.push(['move',this.o.title||'',p.lat]); } setMap(){} }
 class LatLngBounds{ extend(){} }
 window.google={ maps:{ Map, Polyline, Marker, LatLngBounds, LatLng, SymbolPath:{CIRCLE:0} } };
 const cb = new URL(document.currentScript.src).searchParams.get('callback'); setTimeout(()=>window[cb](),10);
})();
"""
async def phone(b, name):
    ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True, is_mobile=True, ignore_https_errors=True, service_workers='block', permissions=['clipboard-read','clipboard-write'])
    pg=await ctx.new_page(); pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    await pg.route('**/*open-meteo.com/**', lambda r: (pg.__dict__.setdefault('wx',[]).append(r.request.url), r.fulfill(json={'utc_offset_seconds':-21600,'hourly':{'time':[f"2026-11-{d:02d}T{h:02d}:00" for d in range(1,31) for h in range(24)],'temperature_2m':[3.0]*720,'wind_speed_10m':[22.0]*720,'wind_direction_10m':[0]*720,'wind_gusts_10m':[30.0]*720,'weather_code':[2]*720}}))[1])
    await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=PNG, content_type='image/png'))
    await pg.route('**/server.arcgisonline.com/**', lambda r: r.fulfill(body=PNG, content_type='image/png'))
    return ctx, pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # ---------- phone A: Google map path ----------
        ca, A = await phone(b,'A')
        await A.route('**/api/config', lambda r: r.fulfill(json={'gmaps':'AIzaFAKE'}))
        await A.route('https://maps.googleapis.com/**', lambda r: r.fulfill(body=FAKE_GM, content_type='application/javascript'))
        await A.goto(U); await A.wait_for_timeout(300); await A.evaluate(SEED); await A.reload(); await A.wait_for_timeout(500)
        await A.evaluate("openDetail(3)"); await A.wait_for_timeout(1800)
        print('A map:', await A.evaluate("document.querySelector('#anaMap .fakegm')?.textContent"), '| foot:', await A.evaluate("document.querySelector('.mfoot').innerText.replace(/\\n/g,' | ')"), '| href:', await A.evaluate("document.querySelector('.gbtn').href"))
        await A.tap('.mtype [data-v=satellite]'); await A.wait_for_timeout(100)
        print('A after satellite:', await A.evaluate("document.querySelector('#anaMap .fakegm').textContent"), 'saved type', await A.evaluate("localStorage.getItem('sp_mtype')"))
        await A.tap('.mtype [data-v=hybrid]')
        # simulate tapping the map at a new point -> marker moves, weather refetches for that point
        n0=len(A.__dict__.get('wx',[]))
        await A.evaluate("window.__gmMap.ls.click({latLng:new google.maps.LatLng(50.2,-96.9)})"); await A.wait_for_timeout(600)
        print('A select -> wx calls', len(A.wx)-n0, A.wx[-1].split('?')[1][:40], '| wx line:', await A.evaluate("document.getElementById('anaWx').innerText.replace(/\\n/g,' ')"), '| foot', await A.evaluate("document.querySelector('.mfoot span').textContent"))
        print('A gm log:', [x for x in await A.evaluate("__gmlog") if x[0] in ('map','type','marker','move','pan')][:12])
        await A.screenshot(path='c_gmap.png')
        # reopen keeps the chosen point and type
        await A.evaluate("go('history')"); await A.evaluate("openDetail(3)"); await A.wait_for_timeout(1500)
        print('A reopen:', await A.evaluate("document.querySelector('#anaMap .fakegm')?.textContent"), await A.evaluate("document.querySelector('.mfoot span').textContent"))
        # ---------- crews ----------
        await A.evaluate("TRN.open('board')"); await A.wait_for_timeout(300); await A.tap('#bsAdd'); await A.wait_for_timeout(200)
        await A.fill('#crName','Selkirk 8+'); await A.evaluate("navigator.share=undefined"); await A.tap('#crMake'); await A.wait_for_timeout(2500)
        prof = await A.evaluate("TRN.cur()"); c = prof['crews'][0]; print('A crew:', c['name'], c['code'], c['owner'])
        print('A board:', await A.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,300)"))
        await A.screenshot(path='c_boardA.png')
        # ---------- phone B joins via invite link, rows with leaflet map (no key) ----------
        cb, B = await phone(b,'B')
        await B.route('**/api/config', lambda r: r.fulfill(json={'gmaps':None}))
        await B.goto(U + '#join=' + c['code']); await B.wait_for_timeout(1500)
        print('B sheet code:', await B.evaluate("document.getElementById('crCode')?.value"))
        await B.evaluate("TRN.profileSheet()"); await B.wait_for_timeout(200)
        await B.fill('#pfRen','Ava'); await B.tap('#pfRenB'); await B.wait_for_timeout(200)
        await B.evaluate("TRN.crewSheet('" + c['code'] + "')"); await B.wait_for_timeout(200); await B.tap('#crJoin'); await B.wait_for_timeout(2500)
        # B rows a demo session
        await B.evaluate("()=>{ const S=window.__SP.S; S.demo='1'; S.wk.mode='justgo'; S.wk.auto='0'; localStorage.setItem('sp_settings', JSON.stringify(S)); }"); await B.reload(); await B.wait_for_timeout(500)
        await B.tap('#bStart'); await B.wait_for_timeout(25000); await B.tap('#bStop'); await B.tap('#bEnd'); await B.wait_for_timeout(3500)
        print('B map buttons:', await B.evaluate("[...document.querySelectorAll('.mtype button')].map(b=>b.textContent).join('/')"), 'leaflet:', await B.evaluate("!!document.querySelector('#anaMap.leaflet-container')"))
        await B.tap('.mtype [data-v=satellite]'); await B.wait_for_timeout(300)
        print('B satellite tiles:', await B.evaluate("[...document.querySelectorAll('#anaMap img.leaflet-tile')].some(i=>i.src.includes('arcgisonline'))"))
        await B.screenshot(path='c_leaf.png')
        await B.evaluate("TRN.open('board')"); await B.wait_for_timeout(2500)
        print('B board:', await B.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,500)"))
        await B.screenshot(path='c_boardB.png')
        # A sees B; A sets team goal; A removes nobody
        await A.evaluate("TRN.open('board')"); await A.wait_for_timeout(2500)
        print('A sees:', await A.evaluate("[...document.querySelectorAll('.lane .ln')].map(x=>x.textContent)"))
        await A.fill('#tW','60'); await A.evaluate("document.getElementById('tW').dispatchEvent(new Event('change'))"); await A.wait_for_timeout(1500)
        await B.evaluate("localStorage.removeItem('sp_crewb_" + c['id'] + "'); TRN.open('board')"); await B.wait_for_timeout(2500)
        print('B team goal:', await B.evaluate("document.querySelector('#tW').value"))
        for k,v in [('A',A),('B',B)]: print(k,'errors',v.errs)
        await b.close()
asyncio.run(main())
