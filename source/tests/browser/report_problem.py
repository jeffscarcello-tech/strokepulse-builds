# Report a problem: in-app box -> pre-filled email that still reads when Gmail on iPhone drops line breaks.
# Run against a local copy of the site (Miniflare) at https://127.0.0.1:8787/ at phone (390) and desktop (1280) sizes.
import asyncio, re, urllib.parse, sys
from playwright.async_api import async_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8787/'
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'
fails = []
def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
async def run(b, w, h, ua, shot):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 600, has_touch=w < 600, user_agent=ua, ignore_https_errors=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps': None}))
    await pg.goto(U); await pg.wait_for_timeout(2500)
    # 3 saved sessions, 2 rowers, 1 lineup so the counts can be checked (no names go in the email)
    await pg.evaluate("""()=>{ localStorage.setItem('sp_index', JSON.stringify([{id:1,start:Date.now(),dist:1,time:1,strokes:1},{id:2,start:Date.now(),dist:1,time:1,strokes:1},{id:3,start:Date.now(),dist:1,time:1,strokes:1}]));
      localStorage.setItem('sp_profiles', JSON.stringify([{id:'a',name:'Secretname'},{id:'b',name:'Other'}])); localStorage.setItem('sp_lineups', JSON.stringify([{id:'x',name:'L',type:'8+',cox:{n:'Coxname'},seats:[]}])); }""")
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelectorAll('.sheet,#sheet').forEach(s=>s.classList.remove('on'))")
    await pg.evaluate("go('settings')"); await pg.wait_for_timeout(300)
    btn = await pg.query_selector('#repBtn'); bb = await btn.bounding_box()
    ok(bb and bb['height'] >= 44, f'{w}px: Report a problem item is tap-sized ({bb and round(bb["height"])}px)')
    nxt = await pg.evaluate("document.getElementById('repBtn').closest('.card').nextElementSibling.className")
    ok(nxt == 'ver', f'{w}px: item sits right above the version line')
    await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(700)
    ok(await pg.evaluate("document.getElementById('sheet').classList.contains('on')"), f'{w}px: tapping opens the box')
    fits = await pg.evaluate("(()=>{ const r=document.getElementById('repGo').getBoundingClientRect(); return r.bottom<=innerHeight && r.right<=innerWidth && r.left>=0 })()")
    ok(fits, f'{w}px: box fits the screen (Open email visible)')
    ok(await pg.evaluate("document.activeElement && document.activeElement.id==='repWhat'"), f'{w}px: first box has focus')
    await pg.screenshot(path=shot)
    gh = await pg.evaluate("document.getElementById('repGo').getBoundingClientRect().height"); ok(gh >= 40, f'{w}px: Open email is tap-sized ({round(gh)}px)')
    await pg.fill('#repWhat', 'The split froze\nat 1:59'); await pg.fill('#repExp', 'It keeps updating')
    # the real Open email button (a mailto: link does nothing in a test browser, so the page stays and the backup toast must show)
    await pg.click('#repGo', timeout=5000); await pg.wait_for_timeout(1500)
    ok(not await pg.evaluate("document.getElementById('sheet').classList.contains('on')"), f'{w}px: Open email closes the box')
    ok('write to support@shotpulse.app' in (await pg.evaluate("document.querySelector('.toast')?.textContent") or ''), f'{w}px: backup toast shows the address')
    url = await pg.evaluate("window.__SP.reportUrl('The split froze\\nat 1:59', 'It keeps updating')")
    ok(url.startswith('mailto:support@shotpulse.app?subject='), f'{w}px: address exact')
    q = urllib.parse.parse_qs(url.split('?', 1)[1]); subj = q['subject'][0]; body = q['body'][0]
    build = await pg.evaluate("APP_BUILD")
    ok(subj == f'StrokePulse problem ({build})', f'{w}px: subject exact: {subj}')
    ok('%0A' not in url.replace('%0D%0A', ''), f'{w}px: line breaks are CRLF only')
    ok('1) What happened: The split froze / at 1:59' in body, f'{w}px: answer 1 with inner line break turned into " / "')
    ok('2) What I expected: It keeps updating' in body, f'{w}px: answer 2')
    ok('— Details for the fix (please leave) —' in body, f'{w}px: details heading')
    lines = body.split('\r\n'); det = lines[lines.index('— Details for the fix (please leave) —') + 1:]
    ok(len(det) >= 9 and all(l.startswith('• ') for l in det), f'{w}px: {len(det)} detail lines, every one starts with •')
    flat = ' '.join(body.split())
    ok(re.search(r'^1\) What happened: .* 2\) What I expected: .* — Details for the fix \(please leave\) — • Build: .* • Device: ', flat) is not None, f'{w}px: still reads in order with line breaks removed')
    ok('Sessions / rowers / lineups on this phone: 3 / 2 / 1' in body, f'{w}px: counts right (3 sessions, 2 rowers, 1 lineup)')
    ok('Secretname' not in body and 'Coxname' not in body, f'{w}px: no rower names in the email')
    ok(errs == [], f'{w}px: no page errors {errs}')
    dev = await pg.evaluate("window.__SP.reportInfo().split('\\n')[1]")
    await ctx.close(); return dev
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        d1 = await run(b, 390, 844, IPHONE, '/tmp/rep390.png'); ok(d1 == 'Device: iPhone (iOS 18.1)', 'iPhone user agent → ' + d1)
        d2 = await run(b, 390, 844, ANDROID, '/tmp/rep390a.png'); ok(d2 == 'Device: Android phone (Android 14)', 'Android user agent → ' + d2)
        await run(b, 1280, 860, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', '/tmp/rep1280.png')
        await b.close()
    print('\nALL PASSED' if not fails else '\nFAILED: ' + str(len(fails)))
asyncio.run(main())
