// Stand-in for log.concept2.com: approves the login at once and serves two workouts.
import http from 'node:http';
const strokes = []; for (let i = 0; i <= 240; i++) strokes.push({ t: i * 25, d: Math.round(i * 25 * 4.1 * 10 / 10), p: 1220 - (i % 10), spm: 24 + (i % 3), hr: 140 });
const ivs = []; for (let k = 0; k < 4; k++) for (let i = 0; i <= 50; i++) ivs.push({ t: i * 22, d: Math.min(5000, i * 22 * 4.5), p: 1110, spm: 28, hr: 160 });
http.createServer((q, s) => {
  const u = new URL(q.url, 'http://x');
  const J = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
  if (u.pathname === '/oauth/authorize') { s.writeHead(302, { Location: u.searchParams.get('redirect_uri') + '?code=abc&state=' + u.searchParams.get('state') }); return s.end(); }
  if (u.pathname === '/oauth/access_token') return J({ access_token: 'A', refresh_token: 'R', expires_in: 604800 });
  if (u.pathname === '/api/users/me') return J({ data: { first_name: 'Jeff', last_name: 'Test' } });
  if (u.pathname === '/api/users/me/results/501/strokes') return J({ data: strokes });
  if (u.pathname === '/api/users/me/results/502/strokes') return J({ data: ivs });
  if (u.pathname === '/api/users/me/results/503/strokes') { s.writeHead(404); return s.end(); }
  if (u.pathname === '/api/users/me/results') return J({ data: [
    { id: 501, date_utc: '2026-11-24 23:00:00', distance: 2460, time: 6000, workout_type: 'JustRow', stroke_rate: 25, heart_rate: { average: 141 }, drag_factor: 118 },
    { id: 502, date_utc: '2026-11-23 23:00:00', distance: 2000, time: 4400, workout_type: 'FixedDistanceInterval', stroke_rate: 28, workout: { intervals: [{ rest_time: 600 }, { rest_time: 600 }, { rest_time: 600 }, { rest_time: 0 }] } },
    { id: 503, date_utc: '2026-11-20 23:00:00', distance: 1000, time: 2400, workout_type: 'JustRow', stroke_rate: 22 }
  ], meta: { pagination: { current_page: 1, total_pages: 1 } } });
  s.writeHead(404); s.end();
}).listen(9911, () => console.log('c2 mock on 9911'));
