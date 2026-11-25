# A demo session must not start from the phone's real position, and the map must skip impossible GPS jumps.
import asyncio, sys
from playwright.async_api import async_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8787/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True, ignore_https_errors=True, service_workers='block')
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps': None})); await pg.route('**/*open-meteo.com/**', lambda r: r.abort())
        await pg.goto(U); await pg.wait_for_timeout(1500)
        # 1) map: one stale fix in Winnipeg, then the boat near Selkirk
        # use the page's own drawing path: seed the session and open it
        await pg.evaluate("""()=>{ const smp=[[0,49.95579,-97.06004,0,0,0,0,0,0]]; for(let i=1;i<40;i++) smp.push([i,50.143+i*0.00002,-96.873+i*0.00002,i*3,3,24,i/2|0,0,0]);
          localStorage.setItem('sp_s_9', JSON.stringify({samples:smp, laps:[], wk:{mode:'justgo'}})); localStorage.setItem('sp_index', JSON.stringify([{id:9,start:Date.now(),dist:117,time:39,strokes:19,wkDesc:'Just Go'}])); }""")
        await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=b'', content_type='image/png'))
        await pg.reload(); await pg.wait_for_timeout(1500); await pg.evaluate("openDetail(9)"); await pg.wait_for_timeout(2500)
        loc = await pg.evaluate("document.querySelector('.mfoot span').textContent")
        print('PASS' if '49.955' not in loc and '50.143' in loc else 'FAIL', 'map starts at the boat, not the stale fix:', loc)
        # 2) demo: a real fix before START must not become the first sample
        await pg.evaluate("()=>{ const S=window.__SP.S; S.demo='1'; S.wk.mode='justgo'; S.wk.auto='0'; localStorage.setItem('sp_settings', JSON.stringify(S)); }"); await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate("window.__SP.handleFix(49.95579,-97.06004,5,0,Date.now())")
        await pg.tap("#bStart"); await pg.wait_for_timeout(23000); await pg.tap('#bStop'); await pg.tap('#bEnd'); await pg.wait_for_timeout(1500)
        first = await pg.evaluate("(()=>{ const id=JSON.parse(localStorage.getItem('sp_index'))[0].id; return JSON.parse(localStorage.getItem('sp_s_'+id)).samples.find(s=>s[1]!=null) })()")
        print('PASS' if first and abs(first[1]-49.95579) > 0.05 else 'FAIL', 'demo session first point is a demo position:', first and first[1:3])
        print('PASS' if not errs else 'FAIL', 'no page errors', errs)
        await b.close()
asyncio.run(main())
