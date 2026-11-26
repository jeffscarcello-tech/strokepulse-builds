# Concept2 erg import against a stand-in Concept2 server (tests/browser/c2mock.mjs on port 9911; the local site's C2_BASE points at it).
# Connect from the Menu card, workouts import into History with laps, no map/weather, stays imported once, other rower separate, disconnect.
import asyncio, sys
from playwright.async_api import async_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8787/'
OK = []
def check(c, msg, extra=''): OK.append(c); print('PASS' if c else 'FAIL', msg, extra)
async def run(p, w, h):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True, is_mobile=w < 600, ignore_https_errors=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/*open-meteo.com/**', lambda r: r.abort())
    await pg.goto(U); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(1500)
    await pg.evaluate("go('menu')"); await pg.wait_for_timeout(400)
    btn = await pg.query_selector('#c2On'); bb = await btn.bounding_box() if btn else None
    check(bool(bb) and bb['height'] >= 40, f'{w}px Connect Concept2 button on the Menu', bb)
    await pg.screenshot(path=f'/tmp/erg_menu_{w}.png')
    await pg.tap('#c2On'); await pg.wait_for_load_state(); await pg.wait_for_timeout(800)
    body = await pg.evaluate("document.body.dataset.r || ''")
    check(body == 'ok', f'{w}px Concept2 page says connected', body)
    await pg.screenshot(path=f'/tmp/erg_done_{w}.png')
    await pg.tap('a'); await pg.wait_for_timeout(5000)   # Open StrokePulse
    idx = await pg.evaluate("JSON.parse(localStorage.getItem('sp_index')||'[]')")
    erg = [s for s in idx if s.get('indoor')]
    check(len(erg) == 3, f'{w}px 3 erg workouts imported', [s['wkDesc'] for s in erg])
    check(any(s['wkDesc'] == 'Erg · 4 × 500m' for s in erg) and any(s['wkDesc'] == 'Erg · Just Row' for s in erg), f'{w}px workout names')
    jr = next(s for s in erg if s['c2'] == 501); iv = next(s for s in erg if s['c2'] == 502)
    check(abs(jr['dist'] - 2460) < 1 and 595 <= jr['time'] <= 602, f'{w}px Just Row distance and time', [jr['dist'], jr['time']])
    ivd = await pg.evaluate(f"JSON.parse(localStorage.getItem('sp_s_{iv['id']}'))")
    work = [l for l in ivd['laps'] if l['type'] == 'work']; rest = [l for l in ivd['laps'] if l['type'] == 'rest']
    check(len(work) == 4 and len(rest) == 3 and all(abs(l['d'] - 495) < 1 for l in work), f'{w}px intervals: 4 pieces, 3 rests', [round(l['d']) for l in work])
    check(abs(ivd['samples'][-1][3] - 1980) < 2, f'{w}px interval distance adds up', ivd['samples'][-1][3])
    # open the Just Row: erg box, no map, no weather, no GPX
    await pg.evaluate(f"openDetail({jr['id']})"); await pg.wait_for_timeout(1500)
    box = await pg.evaluate("(document.getElementById('ergBox')||{}).textContent||''")
    check('Indoor erg' in box and '141' in box and '118' in box, f'{w}px erg box (HR, drag)', box[:60])
    check(await pg.evaluate("document.getElementById('anaMap').closest('.card').style.display") == 'none' and not await pg.query_selector('#anaWx') and not await pg.query_selector('#exGpx'), f'{w}px no map, weather or GPX')
    stats = await pg.evaluate("document.querySelector('#dBody .grid3').textContent")
    check('2460' in stats.replace(',', ''), f'{w}px stats show the distance', stats[:50])
    await pg.screenshot(path=f'/tmp/erg_detail_{w}.png')
    # second check adds nothing
    await pg.evaluate("go('menu')"); await pg.wait_for_timeout(300); await pg.tap('#c2Sync'); await pg.wait_for_timeout(2500)
    n2 = await pg.evaluate("JSON.parse(localStorage.getItem('sp_index')).filter(s=>s.indoor).length")
    check(n2 == 3, f'{w}px no duplicates on the next check', n2)
    # deleting one doesn't bring it back
    await pg.evaluate(f"openDetail({jr['id']})"); await pg.wait_for_timeout(800); pg.once('dialog', lambda d: asyncio.ensure_future(d.accept())); await pg.click('#delS'); await pg.wait_for_timeout(500)
    await pg.evaluate("ERG.sync(false)"); await pg.wait_for_timeout(2000)
    n3 = await pg.evaluate("JSON.parse(localStorage.getItem('sp_index')).filter(s=>s.indoor).length")
    check(n3 == 2, f'{w}px a deleted erg workout stays deleted', n3)
    # History tag
    await pg.evaluate("go('history')"); await pg.wait_for_timeout(500)
    check('Erg · 4 × 500m' in await pg.evaluate("document.getElementById('histList').textContent"), f'{w}px shows in History')
    await pg.screenshot(path=f'/tmp/erg_hist_{w}.png')
    # disconnect
    await pg.evaluate("go('menu')"); await pg.wait_for_timeout(300); pg.once('dialog', lambda d: asyncio.ensure_future(d.accept())); await pg.click('#c2Off'); await pg.wait_for_timeout(800)
    check(bool(await pg.query_selector('#c2On')), f'{w}px disconnect shows Connect again')
    check(not errs, f'{w}px no page errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 390, 844); await run(p, 1280, 900)
    print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
