# Going off screen during a row is marked as a pause: toast on return, saved gaps, detail box, map marker, History tag.
import asyncio, sys
from playwright.async_api import async_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8787/'
OK = []
def check(c, msg, extra=''):
    OK.append(c); print('PASS' if c else 'FAIL', msg, extra)
HIDE = "(h)=>{ Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h?'hidden':'visible'}); document.dispatchEvent(new Event('visibilitychange')); }"
async def run(p, w, h):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True, is_mobile=w < 600, ignore_https_errors=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps': None})); await pg.route('**/*open-meteo.com/**', lambda r: r.abort())
    await pg.route('**/*.tile.openstreetmap.org/**', lambda r: r.fulfill(body=b'', content_type='image/png'))
    await pg.goto(U); await pg.wait_for_timeout(1200)
    await pg.evaluate("()=>{ localStorage.clear(); }"); await pg.reload(); await pg.wait_for_timeout(1000)
    await pg.evaluate("()=>{ const S=window.__SP.S; S.demo='1'; S.wk.mode='justgo'; S.wk.auto='0'; localStorage.setItem('sp_settings', JSON.stringify(S)); }"); await pg.reload(); await pg.wait_for_timeout(1500)
    await pg.tap('#bStart'); await pg.wait_for_timeout(12000)
    await pg.evaluate(HIDE, True); await pg.wait_for_timeout(5000); await pg.evaluate(HIDE, False); await pg.wait_for_timeout(300)
    toast = await pg.evaluate("[...document.querySelectorAll('.toast,#toast')].map(e=>e.textContent).join('|')")
    check('Paused' in toast and 'off screen' in toast, f'{w}px toast on return', toast)
    g = await pg.evaluate("window.__SP.getRun().gaps")
    check(bool(g) and len(g) == 1 and 4 <= g[0][1]-g[0][0] <= 7, f'{w}px gap recorded', g)
    # a quick blip under 3 s is not a pause
    await pg.evaluate(HIDE, True); await pg.wait_for_timeout(1000); await pg.evaluate(HIDE, False)
    check(len(await pg.evaluate("window.__SP.getRun().gaps")) == 1, f'{w}px short blip ignored')
    await pg.wait_for_timeout(9000); await pg.tap('#bStop'); await pg.tap('#bEnd'); await pg.wait_for_timeout(2500)
    data = await pg.evaluate("(()=>{ const s=JSON.parse(localStorage.getItem('sp_index'))[0]; return [s, JSON.parse(localStorage.getItem('sp_s_'+s.id)).gaps] })()")
    check(data[0].get('paused') == 1 and data[1] and len(data[1]) == 1, f'{w}px saved with the session', data[0].get('paused'))
    box = await pg.evaluate("(document.getElementById('anaPause')||{}).textContent||''")
    check('Paused' in box and 'straight line' in box, f'{w}px detail box', box[:70])
    bb = await pg.evaluate("(()=>{ const r=document.getElementById('anaPause').getBoundingClientRect(); return [r.left,r.right,innerWidth] })()")
    check(bb[0] >= 0 and bb[1] <= bb[2], f'{w}px box fits', bb)
    check(await pg.evaluate("document.querySelectorAll('.pausemk').length") == 1 and await pg.evaluate("document.querySelectorAll('.pauseline').length") == 1, f'{w}px map marker and dashed line')
    await pg.screenshot(path=f'/tmp/pause_{w}.png')
    await pg.evaluate("go('history')"); await pg.wait_for_timeout(600)
    hl = await pg.evaluate("document.getElementById('histList').textContent")
    check('⏸ paused' in hl, f'{w}px History tag')
    # phone closed the app while off screen: recovered session says it ended there
    await pg.evaluate("go('live')"); await pg.wait_for_timeout(300); await pg.tap('#bStart'); await pg.wait_for_timeout(23000)
    await pg.evaluate(HIDE, True); await pg.wait_for_timeout(300)
    await pg.reload(); await pg.wait_for_timeout(2000)
    rc = await pg.evaluate("(()=>{ const s=JSON.parse(localStorage.getItem('sp_index'))[0]; return JSON.parse(localStorage.getItem('sp_s_'+s.id)).closed })()")
    check(rc is not None and rc > 15, f'{w}px closed-by-phone session marked', rc)
    check(not errs, f'{w}px no page errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 390, 844); await run(p, 1280, 900)
    print('ALL PASS' if all(OK) else 'SOME FAILED')
asyncio.run(main())
