# StrokePulse tests

## Server (Node, no browser)
- `server.test.mjs` — updater install, loader routes, webhook signature, cloud backup, Cox recordings and transcripts, coach link, crews (create, join, push, board, goal, remove, leave), weekly report emails (send once at Sunday 6 PM local, unsubscribe), crew credit and shared lineup.
- `calls.test.mjs` — Cox call splitting at pauses and keyword timing.

## Browser (Playwright, against a local copy of the site at https://127.0.0.1:8787/)
- `browser/report_problem.py` — Report a problem: item tap-sized under Help, box opens and fits, Open email closes it and shows the backup toast, mailto address and subject exact, CRLF only, 1) 2) • markers still read in order with line breaks removed, counts right, no names, iPhone and Android device lines. Runs at 390 px and 1280 px. (Added v3.16.)
- `browser/ana.py` — session detail (map, stats, segments, compare, Cox report). v3.2
- `browser/train.py` — rowers, Progress tabs (goals, fitness, trophies, board), improvement tips, Cox report taps. v3.3
- `browser/crew.py` — two phones in one crew, Google map stand-in, map views, weather follows pin. v3.4
- `browser/goal.py` — weekly check-in pop-up, edit goal keeps check-ins. v3.9
- `browser/email.py` — weekly email card on/off and the snapshot it sends. v3.11
- `browser/lineup.py` — lineups, crew credit across two phones, shared lineup, fastest, seat racing, attendance, boats. v3.15
- `browser/train_seed.py` — shared sample sessions used by the browser tests.
