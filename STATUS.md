# StrokePulse — status

GPS speed coach web app for iPhone (rowing / paddling), like the NK SpeedCoach GPS.

## Current build
- Test: **sp-20261124g** (v2.1) — solid status bar (no top fade), no page bounce. Previous: sp-20261124f (v2.0) — Cox mode: mic→speakers, recording + transcripts + call analysis, coach link (private), live listen/talk-back/messages, race-plan prompts, rate beeper, check factor, crew list
- Live: not set up yet (test site first)

## Resources (StrokePulse owns only these)
- GitHub repo: `jeffscarcello-tech/strokepulse-builds` (public)
  - `test/` app.json + build.txt for the test site; `live/` later; `source/` all source + tests
- Cloudflare D1: `strokepulsetest` (6d5c9e77-b698-47b1-9899-5ef6b2746230)
- Site Worker (loader): `strokepulsetest` — https://strokepulsetest.jeffscarcello.workers.dev (binding DB → strokepulsetest; secret ADMIN_PASSWORD for /admin). Loader l4: /api/sync/* backup (cox key or coach token read-only), /api/cox/{audio,chunks,share,retx} recordings in D1 table cox_audio (BLOB, ~32 kbps chunks of 60 s) transcribed by Workers AI whisper-large-v3-turbo (binding AI), /api/live WebSocket → Durable Object LiveRoom (binding LIVE, migration v1). Coach links in table cox_share — table `sessions`, keyed by SHA-256 of the user's backup code (raw code never stored)
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

## Cox mode notes
- Recordings stored in R2 bucket `strokepulse-audio-test` (binding AUDIO, key `<keyhash>/<sid>/<idx>`) since loader l4 (Nov 24 2026). D1 `cox_audio` keeps metadata + transcripts; old D1-stored audio still readable.
- Live audio: 16 kHz µ-law frames over WebSocket via the Durable Object; audio only flows when a coach is listening.
- Talk-back plays through the boat speakers (phones have one output route). Text messages are cox-only.
- Native iOS app planned once Jeff has an Apple developer account.
- Local e2e: Miniflare (D1 + DO) with two Playwright browsers (cox phone + coach laptop).
