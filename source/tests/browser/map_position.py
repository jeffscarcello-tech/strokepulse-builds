# Session detail: the map sits near the bottom (after the numbers, analysis, laps and Cox report, just above Export) and still works.
import asyncio, sys, importlib.util
from playwright.async_api import async_playwright
spec = importlib.util.spec_from_file_location('ana', __file__.replace('map_position.py', 'ana.py')); src = open(spec.origin).read()
SEED = src.split('SEED = r"""', 1)[1].split('"""', 1)[0]
U = sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8787/'
OK = []
def check(c, msg, extra=''): OK.append(c); print('PASS' if c else 'FAIL', msg, extra)
ORDER = """()=>{ const kids=[...document.getElementById('dBody').children]; const name=e=>e.id==='exCsv'?'EXPORT':(e.id==='coxBox'||e.classList.contains('cxwrap'))?'COX':((e.querySelector('h2')||{}).textContent||(e.querySelector('.grid3')?'STATS':'?')); return kids.map(name).filter(n=>n) }"""
async def run(p, w, h):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True, is_mobile=w < 600, ignore_https_errors=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps': None})); await pg.route('**/*open-meteo.com/**', lambda r: r.abort())
    await pg.route('**/api/cox/**', lambda r: r.fulfill(json={'chunks':[]}))
    await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=b'', content_type='image/png'))
    await pg.goto(U); await pg.wait_for_timeout(1000); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(1500)
    for sid in (3, 4):   # 3 = intervals, 4 = Cox session
        await pg.evaluate(f"openDetail({sid})"); await pg.wait_for_timeout(2500)
        o = await pg.evaluate(ORDER)
        mi = o.index('Map') if 'Map' in o else -1
        check(mi > 0 and o[mi + 1] == 'EXPORT' and o[0] == 'STATS', f'{w}px session {sid}: map just above Export', ' > '.join(o))
        check(mi > o.index('COX'), f'{w}px session {sid}: map after the Cox section')
        r = await pg.evaluate("(()=>{ const r=document.getElementById('anaMap').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), document.querySelectorAll('#anaMap .leaflet-pane, #anaMap canvas').length] })()")
        check(r[0] > 200 and r[1] > 150 and r[2] > 0, f'{w}px session {sid}: map drawn', r)
        await pg.evaluate("document.getElementById('anaMap').scrollIntoView()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'/tmp/mappos_{w}_{sid}.png')
    check(not errs, f'{w}px no page errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 390, 844); await run(p, 1280, 900)
    print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
