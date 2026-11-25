# StrokePulse — status

GPS speed coach for iPhone (rowing and paddling), like the NK SpeedCoach GPS, plus Cox mode, training plans and crews.

## Installed (checked Nov 25 2026, 11:20 AM Eastern)
| Site | Address | App build | Loader | How to check |
|---|---|---|---|---|
| Test | https://strokepulsetest.jeffscarcello.workers.dev | **sp-20261125s (v3.19)** | **l8** (SHA-256 8cac9229…) | D1 `strokepulsetest`: `SELECT k, v FROM appmeta WHERE k IN ('ghbuild','ghlast')`; loader via Cloudflare content hash; `/api/health` on the site |
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

- **v3.19 pause marker**: if the app goes off the screen during a row for 3 s or more, it's marked as a pause: a toast on return, a ⏸ box in the session (when and how long; strokes and rate not recorded; distance bridged), a ⏸ marker and dashed line on the map, and "⏸ paused" in History. If the phone closes the app while it's off screen, the recovered session says where it ended. Tested: `tests/browser/pause_marker.py` at 390 and 1280 px (all pass) plus map_jump, ana, train, report_problem and server tests. Not tested: a real iPhone locking mid-row.
- **v3.18 demo/map jump fix**: a demo session used to start at the phone's real position (Winnipeg) before jumping to the demo boat. Demo now forgets the real fix at START, and the map, weather and saved weather skip any GPS jump faster than a boat can go. Tested: `tests/browser/map_jump.py` (map starts at the boat; demo session's first point is a demo point; no errors) plus ana, train, lineup, crew, goal, email, report_problem and server tests. Not tested: a real on-water row.
- **v3.17 map fix**: the app's chart style (solid dark background, full width on every canvas) was covering Google's see-through boat-path layer, so tiles under the path showed black. Map canvases are now exempt. Tested: map canvases are see-through at their own size and charts are unchanged; map views still switch. Not tested: the real Google map (it can't load here), so please check it on your phone.

## Waiting on Jeff
- Send one test report from your phone (Settings → Report a problem) and check it in Gmail.
- After that, if you want it: the daily "StrokePulse problem reports" scheduled task (I'll ask before creating it).
- Live site: not set up. Say yes when you want one (new D1, Worker and `live/` folder).
- Real-world checks: rowing on the water, the real Google map, the stroke curve from the phone's sensor, crew credit between real phones.

## Next version numbers
- App: sp-20261125t (v3.20) or the next day's date letter a. Loader: l9.

## Resources (StrokePulse owns only these)
- GitHub repo `jeffscarcello-tech/strokepulse-builds` (public). Auto-update: push to `test/` → webhook → `strokepulse-updater` installs into D1.
- Cloudflare D1 `strokepulsetest` (6d5c9e77-b698-47b1-9899-5ef6b2746230).
- Site Worker `strokepulsetest`. Bindings:
  - DB (D1)
  - AI (Workers AI whisper)
  - AUDIO (R2 `strokepulse-audio-test`)
  - LIVE (Durable Object LiveRoom)
  - secrets ADMIN_PASSWORD, GMAPS_KEY (Google Maps key restricted to the site) and RESEND_API_KEY (send-only key, shotpulse.app domain)

  Crons: `0 * * * SUN` and `0 * * * MON` (Sunday 6 PM local reports).
- Updater Worker `strokepulse-updater` (TEST_DB, HOOK_SECRET, cron */5).
- Support address for problem reports: support@shotpulse.app (shared with ShotPulse; reports are kept apart by subject "StrokePulse problem (<build>)").

## Release steps
Edit `source/`, bump `source/version.json`, run `python3 source/build.py` and the tests, copy `dist/app.json` + `dist/build.txt` to `test/`, push, then check `ghbuild` in D1. Loader changes go through the Cloudflare connector (exact edits, hash check, keep secrets).

## Parked ideas
- Native iOS app once the Apple developer account is ready.
- Live site with its own address.
- Bluetooth heart rate (needs the native app).
