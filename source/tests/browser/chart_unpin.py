# Cox session detail: the pinned chart stays on top while the Cox calls scroll, then scrolls away once the map comes up.
import asyncio, sys
from playwright.async_api import async_playwright
src = open(__file__.replace('chart_unpin.py', 'ana.py')).read(); SEED = src.split('SEED = r"""', 1)[1].split('"""', 1)[0]
U = sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8787/'
OK = []
def check(c, msg, extra=''): OK.append(c); print('PASS' if c else 'FAIL', msg, extra)
POS = """(y)=>{ const b=document.getElementById('dBody'); b.scrollTop=y; const bt=b.getBoundingClientRect().top, p=document.querySelector('.cxpanel').getBoundingClientRect(), m=document.getElementById('anaMap').closest('.card').getBoundingClientRect(); return {panelTop:Math.round(p.top-bt), panelBottom:Math.round(p.bottom-bt), mapTop:Math.round(m.top-bt)} }"""
async def run(p, w, h):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True, is_mobile=w < 600, ignore_https_errors=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps': None})); await pg.route('**/*open-meteo.com/**', lambda r: r.abort())
    await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=b'', content_type='image/png'))
    W = [[22,22.3,'Power'],[22.3,22.6,'ten'],[22.6,22.9,'now.'],[40,40.3,'Legs,'],[40.3,40.6,'legs!']]
    await pg.route('**/api/cox/chunks*', lambda r: r.fulfill(json={'chunks':[{'idx':0,'t0':0,'dur':60,'status':'done','tx':[{'s':0,'e':60,'t':'x','w':W}]}]}))
    await pg.goto(U); await pg.wait_for_timeout(800); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(1200)
    await pg.evaluate("openDetail(4)"); await pg.wait_for_timeout(3500)
    check(await pg.evaluate("getComputedStyle(document.querySelector('.cxpanel')).display") != 'none', f'{w}px Cox chart shown')
    start = await pg.evaluate("(()=>{ const b=document.getElementById('dBody'), p=document.querySelector('.cxpanel'); return p.getBoundingClientRect().top-b.getBoundingClientRect().top+b.scrollTop })()")
    mid = await pg.evaluate(POS, int(start) + 200)
    check(abs(mid['panelTop']) <= 14, f'{w}px chart pinned while reading the calls', mid)
    mapAt = await pg.evaluate("(()=>{ const b=document.getElementById('dBody'), m=document.getElementById('anaMap').closest('.card'); return m.getBoundingClientRect().top-b.getBoundingClientRect().top+b.scrollTop })()")
    end = await pg.evaluate(POS, int(mapAt) - 50)
    check(end['panelBottom'] <= end['mapTop'] + 1, f'{w}px chart has moved up out of the map\'s way', end)
    end2 = await pg.evaluate(POS, int(mapAt) + 50)
    check(end2['panelBottom'] <= end2['mapTop'] + 1 and end2['panelBottom'] < 60, f'{w}px chart gone once the map is at the top', end2)
    await pg.screenshot(path=f'/tmp/unpin_{w}.png')
    check(not errs, f'{w}px no page errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 390, 844); await run(p, 1280, 900)
    print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
