import asyncio, json
from playwright.async_api import async_playwright
exec(open('/home/claude/tests/cox/train_seed.py').read().split('async def main')[0])
async def phone(b):
    ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, ignore_https_errors=True, service_workers='block')
    pg=await ctx.new_page(); pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps':None})); await pg.route('**/*open-meteo.com/**', lambda r: r.abort())
    await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=PNG, content_type='image/png'))
    return pg
async def demo(pg, secs=24):
    await pg.evaluate("()=>{ const S=window.__SP.S; S.demo='1'; S.wk.mode='justgo'; S.wk.auto='0'; localStorage.setItem('sp_settings', JSON.stringify(S)); }"); await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelectorAll('#sheet').forEach(s=>s.classList.remove('on'))")
    await pg.tap('#bStart'); await pg.wait_for_timeout(secs*1000); await pg.tap('#bStop'); await pg.tap('#bEnd'); await pg.wait_for_timeout(4000)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        A=await phone(b); await A.goto(U)
        # old Cox-mode roster becomes a saved lineup
        await A.evaluate("localStorage.removeItem('sp_lu_migrated'); localStorage.setItem('sp_cox', JSON.stringify({crew:{boat:'4', names:{Cox:'Kim', Stroke:'Ava', '3':'Mia', '2':'Zoe', Bow:'Emily'}}}))"); await A.reload(); await A.wait_for_timeout(2500)
        print('migrated:', await A.evaluate("JSON.stringify(LU.active() && [LU.active().name, LU.active().type, LU.active().cox.n, LU.active().seats.map(s=>s.n+s.s)])"))
        await A.tap('#menuBtn'); await A.wait_for_timeout(400); print('menu lineup card:', await A.evaluate("[...document.querySelectorAll('#scr-menu .card')].find(c=>c.innerText.startsWith('LINEUP'))?.innerText.replace(/\\n+/g,' | ').slice(0,200)"))
        await A.screenshot(path='l_menu.png')
        # crew: A creates, B joins
        await A.evaluate("TRN.profileSheet()"); await A.wait_for_timeout(200); await A.fill('#pfRen','Kim'); await A.tap('#pfRenB'); await A.wait_for_timeout(200)
        await A.evaluate("TRN.crewSheet()"); await A.wait_for_timeout(200); await A.fill('#crName','Selkirk 4+'); await A.evaluate("navigator.share=undefined; navigator.clipboard.writeText=async()=>{}"); await A.tap('#crMake'); await A.wait_for_timeout(2500)
        code = await A.evaluate("TRN.cur().crews[0].code")
        B=await phone(b); await B.goto(U); await B.wait_for_timeout(1500)
        await B.evaluate("TRN.profileSheet()"); await B.wait_for_timeout(200); await B.fill('#pfRen','Emily'); await B.tap('#pfRenB'); await B.wait_for_timeout(200)
        await B.evaluate("TRN.crewSheet('"+code+"')"); await B.wait_for_timeout(200); await B.tap('#crJoin'); await B.wait_for_timeout(2500)
        # A refreshes the crew so Emily can be linked
        await A.evaluate("localStorage.removeItem('sp_crewb_'+TRN.cur().crews[0].id); TRN.open('board')"); await A.wait_for_timeout(2500)
        await A.evaluate("LU.open('lineups')"); await A.wait_for_timeout(300); await A.screenshot(path='l_tab.png')
        await A.evaluate("LU.editLineup(LU.active().id)"); await A.wait_for_timeout(300)
        # typing her exact name links Emily automatically (bow seat input data-i=0)
        await A.fill('#sheetIn [data-i="0"]','Emily'); await A.evaluate("document.querySelector('#sheetIn [data-i=\"0\"]').dispatchEvent(new Event('change'))")
        await A.screenshot(path='l_edit.png'); await A.tap('#luSave'); await A.wait_for_timeout(300)
        print('bow linked:', await A.evaluate("!!LU.active().seats[0].m"))
        # share lineup
        await A.evaluate("LU.editLineup(LU.active().id)"); await A.wait_for_timeout(300); await A.tap('#luShare'); await A.wait_for_timeout(200); await A.fill('#luNote','Dock 6:15'); await A.tap('#sheetIn [data-c]'); await A.wait_for_timeout(1500)
        # A rows a demo session with the lineup
        await demo(A)
        sid = await A.evaluate("JSON.parse(localStorage.getItem('sp_index'))[0].id"); print('session lu tag:', await A.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('sp_index'))[0].lu)"), 'cred:', await A.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('sp_index'))[0].cred)"))
        print('detail cards:', await A.evaluate("[...document.querySelectorAll('#dBody .card h2')].map(h=>h.textContent).slice(0,6)"))
        await A.evaluate("document.getElementById('dBody').scrollTop=0"); await A.screenshot(path='l_detail.png')
        # B sees credit + shared lineup
        await B.evaluate("localStorage.removeItem('sp_crewb_'+TRN.cur().crews[0].id); TRN.open('board')"); await B.wait_for_timeout(3000)
        print('B board:', await B.evaluate("document.getElementById('prBody').innerText.replace(/\\n+/g,' | ').slice(0,420)"))
        await B.screenshot(path='l_boardB.png')
        await B.evaluate("go('history')"); await B.wait_for_timeout(400); print('B history:', await B.evaluate("document.getElementById('crCred')?.innerText.replace(/\\n+/g,' | ').slice(0,250)"))
        await B.screenshot(path='l_histB.png')
        print('B trophies count sessions:', await B.evaluate("TRN.achieve(TRN.credited(TRN.cur().id)).find(r=>r.a.k==='count').v"))
        # fastest, seat racing, attendance, boats on A
        await A.evaluate("LU.open('fast')"); await A.wait_for_timeout(400); print('fastest:', await A.evaluate("document.getElementById('luBody').innerText.replace(/\\n+/g,' | ').slice(0,300)"))
        await A.evaluate("LU.open('race')"); await A.wait_for_timeout(300)
        await A.fill('#srX','Ava'); await A.fill('#srY','Mia'); 
        for sel,val in [('[data-r="0"][data-k="a"]','3:20.0'),('[data-r="0"][data-k="b"]','3:23.0'),('[data-r="1"][data-k="a"]','3:22.5'),('[data-r="1"][data-k="b"]','3:22.0')]:
            await A.fill('#luBody '+sel, val); await A.evaluate("document.querySelector('#luBody "+sel.replace('"','\\"')+"').dispatchEvent(new Event('change'))"); await A.wait_for_timeout(100)
        print('race:', await A.evaluate("document.querySelector('#luBody .lucard.act')?.innerText.replace(/\\n+/g,' | ')"))
        await A.screenshot(path='l_race.png'); print('btn disabled?', await A.evaluate("document.getElementById('srSave').disabled"), await A.evaluate("document.getElementById('srX').value")); await A.tap('#srSave'); await A.wait_for_timeout(300); print('saved races', await A.evaluate("(JSON.parse(localStorage.getItem('sp_seatraces'))||[]).length"), await A.evaluate("document.querySelector('.toast')?.textContent")); print('ranking:', await A.evaluate("[...document.querySelectorAll('#luBody .card')].pop().innerText.replace(/\\n+/g,' | ').slice(0,200)"))
        await A.evaluate("LU.open('att')"); await A.wait_for_timeout(300); print('attendance:', await A.evaluate("document.getElementById('luBody').innerText.replace(/\\n+/g,' | ').slice(0,300)"))
        await A.evaluate("LU.open('boats')"); await A.wait_for_timeout(300); await A.tap('#bAdd'); await A.wait_for_timeout(200); await A.fill('#bN','Red Hawk'); await A.fill('#sheetIn [data-rig="span"]','160'); await A.tap('#bSave'); await A.wait_for_timeout(300)
        print('boats:', await A.evaluate("document.getElementById('luBody').innerText.replace(/\\n+/g,' | ').slice(0,200)")); await A.screenshot(path='l_boats.png')
        for k,v in [('A',A),('B',B)]: print(k,'errors',v.errs)
        await b.close()
asyncio.run(main())
