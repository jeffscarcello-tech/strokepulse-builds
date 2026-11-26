# StrokePulse — status

GPS speed coach for iPhone (rowing and paddling), like the NK SpeedCoach GPS, plus Cox mode, training plans and crews.

## Installed (checked Nov 25 2026, 11:20 AM Eastern)
| Site | Address | App build | Loader | How to check |
|---|---|---|---|---|
| Test | https://strokepulsetest.jeffscarcello.workers.dev | **sp-20261125v (v3.22)** | **l9** (SHA-256 3cab7bb2…) | D1 `strokepulsetest`: `SELECT k, v FROM appmeta WHERE k IN ('ghbuild','ghlast')`; loader via Cloudflare content hash; `/api/health` on the site |
| Live | not set up yet | — | — | — |

## Newest files
- GitHub `jeffscarcello-tech/strokepulse-builds`: `test/app.json` + `test/build.txt` (installed build), `source/` (all source), `source/workers/loader.js` (l8), `source/workers/updater.js`, `source/tests/` (see tests/README.md).
- App source: `index.html`, `cox.js` (Cox mode), `analytics.js` (map, stats, compare, Cox report), `train.js` (rowers, goals, fitness, trophies, board, crews, weekly email), `lineup.js` (Crew screen), `sw.js`, `build.py`, `version.json`, `icon.svg`, `vendor/` (Leaflet 1.9.4, Inter Black).

## Done this chat (Nov 24–25 2026)
- v3.2 map, calories, segments, compare, bests, weather, notes, piece comparison, split vs rate, consistency, same-workout trend, Cox season report.
- v3.3 rowers, Progress (goals and plans, fitness and fatigue, strength shape, stroke curve, trophies, challenges, board), improvement tips, tappable Cox report, new look.
- v3.4 crews online and the Google map (Map / Satellite / Hybrid). v3.5–3.8 race-lane leaderboard and layout fixes.
- v3.9 edit goal and weekly check-ins; v3.10 tab bar; v3.11 Sunday email report (loader l7); v3.12–3.13 wording and label fixes.
- v3.14 new logo and StrokePulse wordmark. v3.15 Crew screen: lineups, crew credit, fastest lineup, seat racing, attendance, boats, shared lineup (loader l8).
- **v3.16 Report a problem**: Settings → Help → Report a problem opens a box (What happened? / What did you expect?) → Open email, already filled in.
  - Tested in a browser at 390 px (iPhone and Android) and 1280 px: item tap-sized, box opens, fits and focuses the first box, Open email closes it and the backup toast shows. Address, subject, CRLF line breaks and the 1) 2) • order with line breaks removed were all checked, plus counts right, no names, no page errors. Earlier server and browser tests still pass.
  - Not tested: a real email from a real phone, and Gmail on iPhone.

- **v3.22 Concept2 erg import + loader l9**: Menu → Concept2 erg → Connect Concept2 links a rower's Concept2 Logbook (read-only). Workouts rowed with ErgData then import into History as "Erg · …" (Just Row or intervals with laps and rests, built second by second from the stroke data), counted in Progress and goals; no map, weather or GPX for them; each import happens once, a deleted one stays deleted; each rower links their own. Checks for new ones on open (hourly) and with Get new workouts. Server: `/api/c2/{start,cb,status,results,strokes,unlink}`; tables `c2_links` (hash of the phone's link key + tokens) and `c2_states`. Tested: server tests (OAuth, refresh, hashing, errors) and `tests/browser/erg_import.py` against a stand-in Concept2 server (`c2mock.mjs`) at 390 and 1280 px, plus all earlier tests. Real Concept2 connect confirmed working by Jeff on his phone (Nov 25).
- **v3.21 chart lets go at the map**: in a Cox session the pinned chart stayed on top all the way down, so the map scrolled under it. It now stays pinned only while the Cox calls are on screen, then scrolls up out of the way. Tested: `tests/browser/chart_unpin.py` at 390 and 1280 px, plus map_position, ana, train and server tests. Not tested: on your iPhone.
- **v3.20 map lower in session detail**: the Map card now sits near the bottom, after the numbers, analysis, laps and Cox report, just above Export. Tested: `tests/browser/map_position.py` (order and map drawn, intervals and Cox sessions, 390 and 1280 px) plus pause_marker, map_jump, ana, crew. Not tested: the real Google map on a phone.
- **v3.19 pause marker**: if the app goes off the screen during a row for 3 s or more, it's marked as a pause: a toast on return, a ⏸ box in the session (when and how long; strokes and rate not recorded; distance bridged), a ⏸ marker and dashed line on the map, and "⏸ paused" in History. If the phone closes the app while it's off screen, the recovered session says where it ended. Tested: `tests/browser/pause_marker.py` at 390 and 1280 px (all pass) plus map_jump, ana, train, report_problem and server tests. Not tested: a real iPhone locking mid-row.
- **v3.18 demo/map jump fix**: a demo session used to start at the phone's real position (Winnipeg) before jumping to the demo boat. Demo now forgets the real fix at START, and the map, weather and saved weather skip any GPS jump faster than a boat can go. Tested: `tests/browser/map_jump.py` (map starts at the boat; demo session's first point is a demo point; no errors) plus ana, train, lineup, crew, goal, email, report_problem and server tests. Not tested: a real on-water row.
- **v3.17 map fix**: the app's chart style (solid dark background, full width on every canvas) was covering Google's see-through boat-path layer, so tiles under the path showed black. Map canvases are now exempt. Tested: map canvases are see-through at their own size and charts are unchanged; map views still switch. Not tested: the real Google map (it can't load here), so please check it on your phone.

## Waiting on Jeff
- **Concept2**: API key registered by Jeff (Concept2 client "StrokePulse", platform Browser, callback `https://strokepulsetest.jeffscarcello.workers.dev/api/c2/cb`); stored as Worker secrets C2_CLIENT_ID / C2_CLIENT_SECRET on `strokepulsetest` (Nov 25). Jeff connected from his phone on Nov 25 and it worked (one link stored). Live site will need its callback added on the Concept2 key page.
- Send one test report from your phone (Settings → Report a problem) and check it in Gmail.
- After that, if you want it: the daily "StrokePulse problem reports" scheduled task (I'll ask before creating it).
- Live site: not set up. Say yes when you want one (new D1, Worker and `live/` folder).
- Real-world checks: rowing on the water, the real Google map, the stroke curve from the phone's sensor, crew credit between real phones.

## Next version numbers
- App: sp-20261125v (v3.22) or the next day's date letter a or the next day's date letter a. Loader: l9.

## Resources (StrokePulse owns only these)
- GitHub repo `jeffscarcello-tech/strokepulse-builds` (public). Auto-update: push to `test/` → webhook → `strokepulse-updater` installs into D1.
- Cloudflare D1 `strokepulsetest` (6d5c9e77-b698-47b1-9899-5ef6b2746230).
- Site Worker `strokepulsetest`. Bindings:
  - DB (D1)
  - AI (Workers AI whisper)
  - AUDIO (R2 `strokepulse-audio-test`)
  - LIVE (Durable Object LiveRoom)
  - secrets ADMIN_PASSWORD, GMAPS_KEY (Google Maps key restricted to the site) and RESEND_API_KEY (send-only key, shotpulse.app domain); C2_CLIENT_ID and C2_CLIENT_SECRET (Concept2 Logbook API, read-only)

  Crons: `0 * * * SUN` and `0 * * * MON` (Sunday 6 PM local reports).
- Updater Worker `strokepulse-updater` (TEST_DB, HOOK_SECRET, cron */5).
- Support address for problem reports: support@shotpulse.app (shared with ShotPulse; reports are kept apart by subject "StrokePulse problem (<build>)").

## Release steps
Edit `source/`, bump `source/version.json`, run `python3 source/build.py` and the tests, copy `dist/app.json` + `dist/build.txt` to `test/`, push, then check `ghbuild` in D1. Loader changes go through the Cloudflare connector (exact edits, hash check, keep secrets).

## Parked ideas
- Native iOS app once the Apple developer account is ready.
- Live site with its own address.
- Bluetooth heart rate (needs the native app).
- Live PM5 connection over Bluetooth like ErgData (needs the native app; Jeff wants it once that app exists).
