// Boots the game, starts a new game, looks around the city by day and night, prints draw-call stats,
// fails on any console error.  node tools/smoke.mjs [view names...]
import { open, sleep } from './harness.mjs';
import { spawn } from 'child_process';
import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['serve.js'], { cwd: root, env: { ...process.env, PORT: port }, stdio: 'ignore' });
process.env.SH_URL = `http://localhost:${port}/`;
await sleep(600);
const { ev, shot, check, done } = await open(import.meta.url);
for (let i = 0; i < 80 && (await ev('return document.body.dataset.ready')) !== '1'; i++) await sleep(500);
check(await ev(`return document.body.dataset.ready`) === '1', 'booted');
await shot('01-warn');
await ev(`document.getElementById('warnOk').click()`); await sleep(2500); await shot('02-title');
console.log(JSON.stringify(await ev(`return __s.stats()`)));
await ev(`__s.setQuality('medium'); __s.endIntro()`);
for (let i = 0; i < 60 && (await ev(`return __s.mode`)) !== 'play'; i++) await sleep(250);
check((await ev(`return __s.mode`)) === 'play', 'playing');
await sleep(3000);
await shot('03-wake');
const only = process.argv.slice(2);
const PI = Math.PI;
const views = [
  ['office', -3.2, 113.6, PI * 0.75, 0, 9], ['corridor', -10, 105, -PI / 2, 0, 9], ['lobby', 0, 100, 0, 0, 9], ['halcyon-out', 0, 80, PI, 0.15, 9],
  ['street-day', 28, 40, 0, 0.05, 11], ['street-night', 28, 40, 0, 0.05, 23], ['checkpoint', 28, -70, 0, 0, 13], ['park', 0, 20, 0, 0.05, 15], ['heli', 6, -4, PI * 0.8, 0, 22],
  ['precinct', -80, 0, -PI / 2, 0.1, 12], ['precinct-in', -100, 0, -PI / 2, 0, 12], ['hospital', 80, -112, -PI / 2, 0.1, 16], ['kaur', 124.5, -104, 0, 0, 16],
  ['apartment', -112, -140, 0, 0.1, 18], ['flat', -122, -156, 0, 0, 18], ['overview', 0, 160, 0, 0.3, 10],
].filter((v) => !only.length || only.includes(v[0]));
for (const [n, x, z, yaw, pitch, h] of views) {
  await ev(`__s.hour = ${h}; __s.tp(${x}, ${z}, ${yaw}, ${pitch}); __s.flash(${h > 19 || h < 6})`);
  await sleep(1500); await shot('v-' + n);
  console.log(n, JSON.stringify(await ev(`return { calls: __s.renderer.info.render.calls, tris: __s.renderer.info.render.triangles, z: __s.zombies.list.length, prof: __s.prof() }`)));
}
console.log(JSON.stringify(await ev(`return __s.stats()`)));
srv.kill();
await done();
