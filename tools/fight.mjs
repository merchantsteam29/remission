// A horde in the street: shoot them at gore 100 (screenshots of the mess), then at night with the flashlight.
// Prints frame costs. node tools/fight.mjs [quality]
import { open, sleep } from './harness.mjs';
import { spawn } from 'child_process';
import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['serve.js'], { cwd: root, env: { ...process.env, PORT: port }, stdio: 'ignore' });
process.env.SH_URL = `http://localhost:${port}/`;
await sleep(600);
const q = process.argv[2] || 'medium';
const { ev, shot, check, done } = await open(import.meta.url);
for (let i = 0; i < 80 && (await ev('return document.body.dataset.ready')) !== '1'; i++) await sleep(500);
await ev(`localStorage.clear(); document.getElementById('warnOk').click(); __s.setQuality('${q}'); window.__god = true; __s.endIntro()`);
for (let i = 0; i < 60 && (await ev(`return __s.mode`)) !== 'play'; i++) await sleep(250);
await ev(`__s.story.S.step = 4; for (const g of ['pistol','smg','rifle','sniper','minigun']) { __s.weapons.give(g); __s.weapons.S.reserve[g] = 999; } __s.setGore(100)`);
async function fight(name, hour, gun, secs) {
  await ev(`__s.hour = ${hour}; __s.tp(28, 30, 0); __s.weapons.equip('${gun}'); for (const z of [...__s.zombies.list]) __s.zombies.removeBody(z);
    for (let i = 0; i < 12; i++) __s.zombies.spawn(i % 4 === 0 ? 'runner' : 'walker', 28 + (Math.random() - 0.5) * 8, 20 - Math.random() * 6, { state: 'chase', scripted: true });
    __s.flash(${hour > 19}); __s.prof();`);
  await sleep(900);
  await ev(`__s.mouse(0, true)`);
  for (let i = 0; i < secs * 4; i++) {
    await ev(`const P = __s.P; let best = null, bd = 1e9; for (const z of __s.zombies.list) { if (z.state === 'dead' || z.kind === 'child') continue; const d = Math.hypot(z.x - P.x, z.z - P.z); if (d < bd) { bd = d; best = z; } }
      if (best) { P.yaw = Math.atan2(-(best.x - P.x), -(best.z - P.z)); P.pitch = Math.atan2(best.y + (best.crawl ? 0.3 : 1.72) * best.scale - P.y - 1.62, bd); }
      if (__s.weapons.S.mag[__s.weapons.S.cur] < 3) __s.weapons.S.mag[__s.weapons.S.cur] = 30;`);
    await sleep(250);
    if (i === secs * 2) await shot(name + '-mid');
  }
  await ev(`__s.mouse(0, false)`); await sleep(600);
  await ev(`__s.P.pitch = -0.35`); await sleep(400);
  await shot(name + '-after');
  const r = await ev(`return { dead: __s.zombies.list.filter((z) => z.state === 'dead').length, alive: __s.zombies.list.filter((z) => z.state !== 'dead').length, lost: __s.zombies.list.reduce((a, z) => a + Object.values(z.lost).filter(Boolean).length, 0), prof: __s.prof() }`);
  console.log(name, JSON.stringify(r));
  return r;
}
const a = await fight('day-rifle', 12, 'rifle', 14);
check(a.dead >= 4, 'rifle put down most of them');
check(a.lost >= 2, 'gore 100: pieces came off');
const b = await fight('night-minigun', 23, 'minigun', 14);
check(b.dead >= 4, 'minigun put down most of them');
await fight('dusk-smg', 19, 'smg', 4);
srv.kill();
await done();
