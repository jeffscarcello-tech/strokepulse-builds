import asyncio
from playwright.async_api import async_playwright
exec(open('/home/claude/tests/cox/train_seed.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, ignore_https_errors=True, service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.route('**/*open-meteo.com/**', lambda r: r.abort()); await pg.route('**/api/config', lambda r: r.fulfill(json={'gmaps':None}))
        await pg.goto(U); await pg.evaluate(SEED)
        # goal set 3 weeks ago, with two earlier check-ins
        await pg.evaluate("""()=>{ const P=JSON.parse(localStorage.getItem('sp_profiles')||'null'); }""")
        await pg.reload(); await pg.wait_for_timeout(500)
        pid = await pg.evaluate("TRN.cur().id")
        await pg.evaluate("""(pid)=>{ const DAY=864e5, now=Date.now(); const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); const w0=d.getTime();
          const by=new Date(now+42*DAY).toISOString().slice(0,10);
          const checks={}; checks[w0-21*DAY]={w:w0-21*DAY,n:3,pn:5,m:12000,pm:20000,pred:560,need:556,behind:1,status:'close',tips:[],changes:[],adj:1,focus:null};
          checks[w0-14*DAY]={w:w0-14*DAY,n:5,pn:5,m:21000,pm:21000,pred:552,need:550,behind:0.5,status:'on',tips:[],changes:[],adj:1,focus:null};
          localStorage.setItem('sp_goal_'+pid, JSON.stringify({race:{dist:2000,time:500,by,days:5,startT:565,set:now-24*DAY,checks}})); }""", pid)
        await pg.reload(); await pg.wait_for_timeout(2500)
        print('auto popup:', await pg.evaluate("document.getElementById('sheet').classList.contains('on')"), '|', await pg.evaluate("document.getElementById('sheetIn').innerText.replace(/\\n+/g,' | ').slice(0,700)"))
        await pg.screenshot(path='g_checkin.png')
        await pg.evaluate("document.getElementById('sheetIn').scrollTop=600"); await pg.screenshot(path='g_checkin2.png')
        await pg.tap('#ciOk'); await pg.wait_for_timeout(500)
        # reopening does not pop again
        await pg.reload(); await pg.wait_for_timeout(2500); print('popup again?', await pg.evaluate("document.getElementById('sheet').classList.contains('on')"))
        await pg.evaluate("TRN.open('goals')"); await pg.wait_for_timeout(400)
        print('goals has checkins:', await pg.evaluate("document.querySelectorAll('[data-ci]').length"), 'plan:', await pg.evaluate("document.querySelector('.wkc .s').parentNode.innerText.replace(/\\n/g,' ')"))
        await pg.evaluate("document.getElementById('gEdit').scrollIntoView()"); await pg.screenshot(path='g_card.png')
        await pg.tap('#gEdit'); await pg.wait_for_timeout(300)
        print('edit form:', await pg.evaluate("[document.getElementById('gTime').value, document.getElementById('gDist').value, document.getElementById('gDays').value]"))
        await pg.fill('#gTime','8:10'); await pg.select_option('#gDays','4'); await pg.tap('#gSet'); await pg.wait_for_timeout(400)
        g = await pg.evaluate("(pid)=>JSON.parse(localStorage.getItem('sp_goal_'+pid)).race", pid)
        print('after edit:', g['time'], g['days'], 'checks kept:', len(g['checks']), 'adj', g.get('adj'), 'focus', g.get('focus'))
        print('errors', errs); await b.close()
asyncio.run(main())
