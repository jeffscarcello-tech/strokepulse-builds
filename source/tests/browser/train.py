import asyncio, re
from playwright.async_api import async_playwright
exec(open('/home/claude/tests/cox/train_seed.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True, is_mobile=True, ignore_https_errors=True, service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and 'favicon' not in m.text and errs.append('console: '+m.text))
        await pg.route('**/*open-meteo.com/**', lambda r: r.fulfill(json={'utc_offset_seconds':-21600,'hourly':{'time':[f"2026-11-{d:02d}T{h:02d}:00" for d in range(1,31) for h in range(24)],'temperature_2m':[3.0]*720,'wind_speed_10m':[22.0]*720,'wind_direction_10m':[0]*720,'wind_gusts_10m':[30.0]*720,'weather_code':[2]*720}}))
        await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=PNG, content_type='image/png'))
        async def chunks(route):
            W=[[22,22.3,'Power'],[22.3,22.6,'ten'],[22.6,22.9,'now.'],[40,40.3,'Legs,'],[40.3,40.6,'legs!'],[120,120.3,'Power'],[120.3,120.6,'ten'],[120.6,120.9,'now.']]
            await route.fulfill(json={'chunks':[{'idx':0,'t0':0,'dur':60,'status':'done','tx':[{'s':0,'e':60,'t':'x','w':W}]}]})
        await pg.route('**/api/cox/chunks*', chunks)
        await pg.goto(U); await pg.wait_for_timeout(300)
        await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.screenshot(path='t_live.png')
        await pg.tap('#menuBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path='t_menu.png')
        # add a second rower
        await pg.tap('#mChip .pchip'); await pg.wait_for_timeout(200); await pg.fill('#pfNew','Emily'); await pg.tap('#pfAdd'); await pg.wait_for_timeout(300)
        print('brand:', await pg.evaluate("document.querySelector('#scr-live .brand').textContent"), 'chip:', await pg.evaluate("document.getElementById('mChip').innerText"))
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(200)
        print('Emily history:', await pg.evaluate("document.getElementById('histList').innerText.slice(0,80)"))
        # switch back to Me
        await pg.evaluate("TRN.profileSheet()"); await pg.wait_for_timeout(200)
        await pg.evaluate("[...document.querySelectorAll('#sheetIn [data-pid]')].find(b=>b.textContent.includes('Me')).click()"); await pg.wait_for_timeout(300)
        print('Me history count:', await pg.evaluate("document.querySelectorAll('#histList .item').length"))
        # detail: where to improve + curve
        await pg.tap('#histList .item[data-id="3"]'); await pg.wait_for_timeout(1500)
        print('cards:', await pg.evaluate("[...document.querySelectorAll('#dBody .card h2')].map(h=>h.textContent)"))
        print('improve:', await pg.evaluate("[...document.querySelectorAll('#dBody .card')].find(c=>c.querySelector('h2')?.textContent==='Where to improve').innerText.replace(/\\n+/g,' | ').slice(0,700)"))
        print('curve:', await pg.evaluate("[...document.querySelectorAll('#dBody .card')].find(c=>c.querySelector('h2')?.textContent==='Stroke curve')?.querySelector('.grid3').innerText.replace(/\\n+/g,' ')"))
        await pg.screenshot(path='t_detail.png')
        await pg.evaluate("document.getElementById('dBody').scrollTop=700"); await pg.wait_for_timeout(200); await pg.screenshot(path='t_detail2.png')
        # progress: goals
        await pg.evaluate("TRN.open('goals')"); await pg.wait_for_timeout(400); await pg.screenshot(path='t_goal0.png')
        await pg.fill('#gTime','7:40'); await pg.tap('#gSet'); await pg.wait_for_timeout(500)
        print('goal:', await pg.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,900)"))
        await pg.screenshot(path='t_goal1.png')
        for i,y in enumerate([800,1600]):
            await pg.evaluate(f"document.getElementById('prBody').scrollTop={y}"); await pg.wait_for_timeout(150); await pg.screenshot(path=f't_goal{i+2}.png')
        await pg.evaluate("document.querySelector('.ses button').click()"); await pg.wait_for_timeout(300)
        print('loaded wk:', await pg.evaluate("JSON.stringify(window.__SP.S.wk)"), 'banner:', await pg.evaluate("document.getElementById('banner').textContent"))
        await pg.evaluate("TRN.open('fit')"); await pg.wait_for_timeout(500)
        print('fit:', await pg.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,600)"))
        for i,y in enumerate([0,700,1400,2100]):
            await pg.evaluate(f"document.getElementById('prBody').scrollTop={y}"); await pg.wait_for_timeout(150); await pg.screenshot(path=f't_fit{i}.png')
        await pg.evaluate("TRN.open('ach')"); await pg.wait_for_timeout(400)
        print('ach:', await pg.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,500)"))
        await pg.screenshot(path='t_ach.png')
        await pg.evaluate("TRN.open('board')"); await pg.wait_for_timeout(400)
        print('board:', await pg.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,500)"))
        await pg.screenshot(path='t_board.png')
        # cox report clicks
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(200); await pg.tap('#coxRep'); await pg.wait_for_timeout(1500)
        await pg.tap('#crBody [data-cat="Power"]'); await pg.wait_for_timeout(300)
        print('cat list:', await pg.evaluate("document.getElementById('sheetIn').innerText.replace(/\\n+/g,' | ').slice(0,200)"))
        await pg.screenshot(path='t_catlist.png')
        await pg.tap('#sheetIn [data-i="1"]'); await pg.wait_for_timeout(3000)
        print('seek:', await pg.evaluate("document.querySelector('.screen.on').id"), await pg.evaluate("document.querySelector('.call.hit')?.innerText.replace(/\\n/g,' ')"), await pg.evaluate("document.getElementById('cxaPT')?.textContent"))
        await pg.screenshot(path='t_seek.png')
        await pg.evaluate("go('history')"); await pg.wait_for_timeout(200); await pg.tap('#coxRep'); await pg.wait_for_timeout(800)
        await pg.tap('#crBody [data-sid]'); await pg.wait_for_timeout(800); print('session row ->', await pg.evaluate("document.getElementById('dTitle').textContent"))
        # demo session -> trophies after save
        await pg.evaluate("()=>{ const S=window.__SP.S; S.demo='1'; S.wk.mode='justgo'; S.wk.auto='0'; localStorage.setItem('sp_settings', JSON.stringify(S)); localStorage.removeItem('sp_ach_'+TRN.cur().id); }"); await pg.reload(); await pg.wait_for_timeout(500)
        await pg.tap('#bStart'); await pg.wait_for_timeout(26000); await pg.tap('#bStop'); await pg.tap('#bEnd'); await pg.wait_for_timeout(1500)
        print('after save:', await pg.evaluate("document.querySelector('.newach')?.innerText.replace(/\\n/g,' | ')"), '| who:', await pg.evaluate("JSON.parse(localStorage.getItem('sp_index'))[0].who===TRN.cur().id"))
        await pg.screenshot(path='t_after.png')
        # glare theme check
        await pg.evaluate("document.body.classList.add('glare'); TRN.open('fit')"); await pg.wait_for_timeout(400); await pg.screenshot(path='t_glare.png')
        print('errors', errs); await b.close()
asyncio.run(main())
