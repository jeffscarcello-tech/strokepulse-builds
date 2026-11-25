import asyncio, json
from playwright.async_api import async_playwright
exec(open('/home/claude/tests/cox/train_seed.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, ignore_https_errors=True, service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps':None,'email':True}))
        saved=[]
        async def cap(route):
            saved.append(json.loads(route.request.post_data)); await route.continue_()
        await pg.route('**/api/report/save', cap)
        await pg.goto(U); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(4000)
        await pg.evaluate("TRN.open('goals')"); await pg.wait_for_timeout(300); await pg.fill('#gTime','8:00'); await pg.tap('#gSet'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.getElementById('emAddr').scrollIntoView()"); await pg.fill('#emAddr','jeff@example.com'); await pg.screenshot(path='e_card0.png'); await pg.tap('#emOn'); await pg.wait_for_timeout(1500)
        print('card:', await pg.evaluate("[...document.querySelectorAll('#prBody .card')].find(c=>c.innerText.includes('WEEKLY EMAIL')).innerText.replace(/\\n+/g,' | ')"))
        await pg.screenshot(path='e_card.png')
        await pg.tap('#emTest'); await pg.wait_for_timeout(1500); print('test toast:', await pg.evaluate("document.querySelector('.toast')?.textContent"))
        print('saved calls', len(saved), 'snap keys', sorted(saved[-1]['snap'].keys()))
        json.dump(saved[-1], open('/tmp/snap.json','w'))
        await pg.tap('#emOff'); await pg.wait_for_timeout(800); print('off:', await pg.evaluate("!!document.getElementById('emAddr')"), saved[-1]['email'])
        print('errors', errs); await b.close()
asyncio.run(main())
