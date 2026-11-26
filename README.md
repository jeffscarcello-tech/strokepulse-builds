# strokepulse-builds

StrokePulse is a GPS speed coach for iPhone (rowing and paddling), with Cox mode, training plans and crews. It is a single-page web app served by a Cloudflare Worker and updated automatically from this repo.

## Recent changes
- Nov 25 2026, v3.22 (sp-20261125v, loader l9): Concept2 erg import from the Concept2 Logbook (`erg.js`, `/api/c2/*`). Needs Concept2 API keys as Worker secrets C2_CLIENT_ID / C2_CLIENT_SECRET.
- Nov 25 2026, v3.21 (sp-20261125u): the pinned Cox chart scrolls away once the map comes up (`.cxwrap` in cox.js).
- Nov 25 2026, v3.20 (sp-20261125t): session detail shows the map near the bottom, just above Export.
- Nov 25 2026, v3.19 (sp-20261125s): pause marker when the app is off screen mid-row (`closePause` in index.html; `gaps`/`closed` saved with the session; `pauseHtml`/`mapPauses` in analytics.js).
- Nov 25 2026, v3.18 (sp-20261125r): demo sessions no longer start at the phone's real position; map and weather ignore impossible GPS jumps (`cleanTrack` in analytics.js).
- Nov 25 2026, v3.17 (sp-20261125q): Google map tiles no longer hidden under the boat path (map canvases exempt from the chart style).
- Nov 25 2026, v3.16 (sp-20261125p): Report a problem now opens a short in-app box, then a pre-filled email laid out to survive Gmail on iPhone.
- Nov 25 2026, v3.15: Crew screen (lineups, crew credit, fastest lineup, seat racing, attendance, boats, shared lineup), loader l8.
- Nov 25 2026, v3.14: new logo and StrokePulse wordmark.
- Nov 25 2026, v3.11: Sunday 6 PM weekly email report (Resend, from strokepulse@shotpulse.app), loader l7.
- Nov 25 2026, v3.4: crews online, Google map (Map / Satellite / Hybrid).

## How updates work
Push `test/app.json` + `test/build.txt` → the GitHub webhook pings `strokepulse-updater` → it installs the build into D1 `strokepulsetest` → the site Worker (loader) serves it. Phones show "Update now" when a new version is ready. The version shows in Settings and on the main screen.

## Report a problem (v3.16)
- **Where:** Settings → Help → **Report a problem**, just above the version line. It has a mail icon and the line "Tell us what went wrong. Your version and phone type are added for you."
- **The box:** `reportSheet()` opens a bottom sheet with **What happened?** and **What did you expect?** (up to 1000 characters each; both can be empty) and two buttons, Cancel and **Open email**.
- **The email:** `reportProblem(what, expected)` opens `reportUrl(...)`, then after 1.2 s shows a toast: "If no email opened, write to support@shotpulse.app".
  - To: `support@shotpulse.app`
  - Subject: `StrokePulse problem (<build>)`. The daily problem-report task searches Gmail for `subject:"StrokePulse problem"`, so keep this wording.
  - Body:
    ```
    1) What happened: <answer>

    2) What I expected: <answer>

    — Details for the fix (please leave) —
    • Build: …
    • Device: iPhone (iOS 18.1) …
    • (one line per reportInfo() item)
    ```
  - Line breaks inside an answer become " / ". Line breaks are sent as CRLF (`%0D%0A`), as the mailto standard asks.
  - Every part starts with a marker (1), 2), •) because the Gmail app on iPhone drops line breaks when it sends. With the markers the email still reads in order.
- **The details (`reportInfo()`):** build and label, device with iOS or Android version, home-screen app or browser, screen and window size, current page, online, counts only (sessions, rowers and lineups on this phone; crews; Cox mode, demo and recording on or off), time and user agent. No names, routes, recordings or notes are included.
- **For tests:** `window.__SP` exposes `reportInfo`, `reportUrl`, `reportProblem` and `reportSheet`. The browser test is `source/tests/browser/report_problem.py`.

## Concept2 erg import (v3.22)
- **App:** `erg.js` (window.ERG). Menu card `#c2Card`. Each rower keeps `sp_c2_<rower id>` = { lk (random link key), linked, name, ids imported, last, checked }.
- **Connect:** the phone opens `/api/c2/start?lk=…` → Concept2 login (scope `user:read,results:read`) → `/api/c2/cb` exchanges the code and shows a "Concept2 connected" page. Back in the app, the next open or return to the screen checks `/api/c2/status` and imports.
- **Import:** `/api/c2/results?from=` (rower workouts, up to 500) and `/api/c2/strokes?id=` per workout. Strokes are turned into 1-second samples (no GPS), laps and rests for intervals; the session gets `indoor` details (Concept2 id, avg HR, drag) and the History name "Erg · Just Row" / "Erg · 4 × 500m".
- **Server:** stores only a hash of the link key with the Concept2 tokens (`c2_links`); refreshes the week-long access token itself. Test with `C2_BASE` pointing at `source/tests/browser/c2mock.mjs`.

## Layout
- `test/`: the installed test build. `live/` comes later.
- `source/`: app source, Workers (`workers/loader.js`, `workers/updater.js`) and tests (`tests/README.md`).
- `STATUS.md`: installed versions, resources, and what is waiting on Jeff.
