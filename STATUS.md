# StrokePulse — status

GPS speed coach web app for iPhone (rowing / paddling), like the NK SpeedCoach GPS.

## Current build
- Test: **sp-20261124e** (v1.5) — targets, stroke-averaged split, auto-start on strokes, 3/4/6 boxes, cloud backup, night mode
- Live: not set up yet (test site first)

## Resources (StrokePulse owns only these)
- GitHub repo: `jeffscarcello-tech/strokepulse-builds` (public)
  - `test/` app.json + build.txt for the test site; `live/` later; `source/` all source + tests
- Cloudflare D1: `strokepulsetest` (6d5c9e77-b698-47b1-9899-5ef6b2746230)
- Site Worker (loader): `strokepulsetest` — https://strokepulsetest.jeffscarcello.workers.dev (binding DB → strokepulsetest; secret ADMIN_PASSWORD for /admin). Loader l2 adds /api/sync/{put,list,get,del} for cloud backup — table `sessions`, keyed by SHA-256 of the user's backup code (raw code never stored)
- Updater Worker: `strokepulse-updater` (binding TEST_DB → strokepulsetest; secret HOOK_SECRET; cron */5)
- Address: workers.dev for now (Jeff's choice, Nov 24 2026); custom domain later if wanted

## Release steps
Edit `source/`, bump `source/version.json`, run `python3 source/build.py`, run `node source/tests/server.test.mjs`,
copy `dist/app.json` + `dist/build.txt` to `test/`, push. Check D1 `ghbuild`.

## Known limits
- No Bluetooth heart rate (Safari can't), screen must stay on while recording.

## Testing
- `node source/tests/server.test.mjs` — updater install, loader routes, webhook signature, backup API
- Browser: demo-mode runs at phone + desktop sizes; e2e via local HTTPS copy of the loader (auto-start, targets, backup + restore on a 2nd device)
- Not tested: real water, real iPhone sensors
