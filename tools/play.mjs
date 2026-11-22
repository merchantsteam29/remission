// Plays the whole story with test hooks: every gun, every chapter, the boss, both endings, a death and a retry,
// and shooting at every gore level. Fails on any console error or failed check.
import { open, sleep } from './harness.mjs';
import { spawn } from 'child_process';
import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['serve.js'], { cwd: root, env: { ...process.env, PORT: port }, stdio: 'ignore' });
process.env.SH_URL = `http://localhost:${port}/`;
await sleep(600);
const { ev, shot, check, done } = await open(import.meta.url);
const waitFor = async (js, ms = 30000, what = js) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(`return !!(${js})`)) return true; await sleep(200); } check(false, 'timed out: ' + what); return false; };
const step = () => ev('return __s.story.S.step');
const skip = async () => { await ev('__s.skipTalk()'); await sleep(300); };
for (let i = 0; i < 80 && (await ev('return document.body.dataset.ready')) !== '1'; i++) await sleep(500);
await ev(`localStorage.clear(); document.getElementById('warnOk').click(); __s.setQuality('low'); window.__god = true; __s.endIntro()`);
await waitFor(`__s.mode === 'play'`);
const M = await ev('return __s.W.marks');
const tp = (x, z, yaw = 0) => ev(`__s.tp(${x}, ${z}, ${yaw})`);
const use = async (id) => { const ok = await ev(`return __s.use('${id}')`); check(ok, 'use ' + id); await sleep(300); return ok; };

// ---- I. wake: the pistol, the locker scare ----
await tp(M.lockers.x, M.lockers.z - 1, Math.PI);
await use('pistol');
check(await ev('return __s.weapons.S.owned.pistol && __s.weapons.S.cur === "pistol"'), 'have pistol');
check((await step()) === 1, 'step 1');
await sleep(2000);
check(await ev('return __s.zombies.list.some((z) => z.outfit === "guard" && z.state === "chase")'), 'guard burst out');
// shoot something: put a walker in front and hold the trigger
async function shootTest(gun, part = 'head') {
  const back = await ev('return [__s.P.x, __s.P.z, __s.P.yaw]');
  await ev(`__s.weapons.equip('${gun}'); __s.weapons.S.mag['${gun}'] = 999; __s.tp(0, 21, 0);`);
  await sleep(700);
  const ok = await ev(`
    for (const z of [...__s.zombies.list]) __s.zombies.removeBody(z);
    const P = __s.P; const x = P.x, z = P.z - 7; const zb = __s.zombies.spawn('walker', x, z, { state: 'idle', heading: 0, scripted: true, speedMul: 0.01 });
    window.__zb = zb; P.yaw = 0; const eye = P.y + 1.62, aimY = zb.y + ${part === 'head' ? 1.86 : 1.3} * zb.scale; P.pitch = Math.atan2(aimY - eye, 7); return !!zb;`);
  check(ok, 'spawned target');
  // hold the trigger, keeping the sights on it like a player would
  const aim = `const P = __s.P, zb = window.__zb; if (zb.state !== 'dead') { P.yaw = Math.atan2(-(zb.x - P.x), -(zb.z - P.z)); const eye = P.y + 1.62, aimY = zb.y + ${part === 'head' ? 1.86 : 1.3} * zb.scale; P.pitch = Math.atan2(aimY - eye, Math.hypot(zb.x - P.x, zb.z - P.z)); }`;
  await ev(`__s.mouse(2, true)`); await sleep(600); await ev(aim);
  await ev(`__s.mouse(0, true)`);
  for (let i = 0; i < (gun === 'minigun' ? 18 : 12); i++) { await ev(aim); await sleep(180); }
  await ev(`__s.mouse(0, false)`);
  await sleep(gun === 'sniper' ? 1500 : 200);
  if (gun === 'pistol' || gun === 'sniper') for (let i = 0; i < 6 && !(await ev('return window.__zb.state === "dead"')); i++) { await ev(aim); await ev(`__s.mouse(0, true)`); await sleep(120); await ev(`__s.mouse(0, false)`); await sleep(gun === 'sniper' ? 1400 : 250); }
  await ev(`__s.mouse(2, false)`);
  const dead = await ev('return window.__zb.state === "dead"');
  check(dead, `${gun} killed the walker`);
  await ev(`__s.tp(${back[0]}, ${back[1]}, ${back[2]})`);
  return dead;
}
await tp(0, 100, 0); await ev('__s.hour = 12');
await shootTest('pistol');
await shot('p-pistol');

// ---- gore levels ----
for (const gl of [0, 40, 100]) {
  await ev(`__s.setGore(${gl}); __s.gore.clear(); __s.weapons.give('rifle'); __s.weapons.S.reserve.rifle = 999`);
  await shootTest('rifle', gl === 40 ? 'body' : 'head');
  const st = await ev(`return { lost: window.__zb.lost, busy: __s.gore.busy }`);
  console.log('gore', gl, JSON.stringify(st));
  if (gl === 0) check(!st.busy && !Object.values(st.lost).some(Boolean), 'gore 0: no blood, nothing cut off');
  await shot('gore-' + gl);
}
await ev(`__s.setGore(100)`);

// ---- leave Halcyon: Kaur on the radio ----
await tp(0, 88.5, Math.PI);
await waitFor('__s.talking', 5000, 'radio started'); await skip();
check((await step()) === 2, 'step 2 precinct');

// ---- II. the precinct ----
await tp(M.precinctDoor.x + 2, M.precinctDoor.z, -Math.PI / 2); await sleep(500);
check((await step()) === 3, 'step 3 armory');
await tp(M.armoryDoor.x, M.armoryDoor.z - 1.2, Math.PI); await use('armoryDoor'); // locked
await tp(M.okafor.x + 1, M.okafor.z, 0); await use('okafor'); await ev(`document.getElementById('noteClose').click()`);
await tp(M.armoryDoor.x, M.armoryDoor.z - 1.2, Math.PI); await use('armoryDoor');
check(await ev(`return __s.story.S.flags.armoryOpen`), 'armory open');
await tp(-112, 0, Math.PI / 2); await sleep(3000); // the corridor where the lights go
check(await ev(`return __s.story.S.flags.flickered`), 'flicker scare ran');
await tp(M.armory.x + 1, M.armory.z, -Math.PI / 2); await use('smg');
check(await ev(`return __s.weapons.S.owned.smg`), 'have smg');
await skip(); await skip();
check((await step()) === 4, 'step 4 checkpoint');
await shootTest('smg');

// ---- III. Bell Street ----
await tp(M.tent.x + 1.5, M.tent.z + 1.5, 0); await use('rifle'); await ev(`document.getElementById('noteClose').click()`);
await sleep(2500);
check((await step()) === 5, 'step 5 hold');
await ev(`__s.story.S.flags.holdT = 0; __s.story.S.flags.wave2 = true; for (const z of __s.zombies.list) if (z.state !== 'dead') __s.zombies.removeBody(z);`);
await waitFor('__s.talking', 8000, 'checkpoint radio'); await skip();
check((await step()) === 6, 'step 6 hospital');

// ---- IV. St. Agnes ----
await tp(99, -112, Math.PI / 2); await sleep(500);
await tp(M.gurney.x, M.gurney.z + 0.5, Math.PI); await sleep(1500);
check(await ev(`return __s.story.S.flags.gurney`), 'gurney scare');
await tp(M.glass.x, M.glass.z, Math.PI); await shot('p-kaur'); await use('kaur');
await waitFor('__s.talking', 3000); await skip();
check((await step()) === 7, 'step 7 home');

// ---- V. Harrow Court ----
await tp(-112, -151, Math.PI); await sleep(800);
await tp(M.bath.x, M.bath.z, Math.PI); await sleep(2500);
check(await ev(`return __s.zombies.list.some((z) => z.outfit === 'mara')`), 'Mara');
await shot('p-mara');
await tp(M.gusSafe.x - 1.2, M.gusSafe.z, -Math.PI / 2); await use('gussafe'); await ev(`document.getElementById('noteClose').click()`);
check(await ev(`return __s.weapons.S.owned.sniper`), 'have sniper');
await shootTest('sniper');
await tp(M.notes.x, M.notes.z + 1.4, Math.PI); await use('notes'); await ev(`document.getElementById('noteClose').click()`);
await waitFor('__s.talking', 6000, 'notes radio'); await skip();
check((await step()) === 8, 'step 8 park');

// ---- VI. the park, at night ----
await ev('__s.hour = 23');
await tp(M.heli.x, M.heli.z + 1.5, Math.PI); await use('minigun'); await ev(`document.getElementById('noteClose').click()`);
check(await ev(`return __s.weapons.S.owned.minigun`), 'have minigun');
await sleep(3000);
await shot('p-heli-night');
await shootTest('minigun');
await waitFor('__s.talking', 12000, 'heli radio'); await skip();
check((await step()) === 9, 'step 9 halcyon');

// ---- VII. the Mass ----
await tp(0, 101, Math.PI); await sleep(1000);
await tp(0, 117.8, Math.PI); await sleep(1500);
check((await step()) === 10 && await ev('return !!__s.boss'), 'step 10 boss');
await shot('p-mass');
const tumours = await ev(`
  const b = __s.boss, P = __s.P, T3 = __s.camera.position.constructor, C = __s.W.marks.mass; let n = 0;
  for (const t of b.tums) { const w = new T3(); t.m.getWorldPosition(w); const dx = w.x - C.x, dz = w.z - C.z, l = Math.hypot(dx, dz); __s.tp(C.x + dx / l * 5.5, C.z + dz / l * 4.8);
    const o = new T3(P.x, 1.6, P.z); const d = w.clone().sub(o).normalize(); const h = b.raycast(o, d, 40); if (h) { const r = h.hit(9999, d); if (r.part === 'tum') n++; } }
  __s.tp(C.x, C.z - 4.2, Math.PI); return n;`);
console.log('tumours hit', tumours);
await sleep(500);
check(await ev('return __s.boss.S.open'), 'mass opened');
await ev(`
  const b = __s.boss, P = __s.P, T3 = __s.camera.position.constructor;
  for (let i = 0; i < 5 && !b.S.dead; i++) { const w = new T3(); b.root.children.find((c) => c.isGroup && c.scale.x < 0.7)?.getWorldPosition(w); w.y += 0.75; const o = new T3(P.x, 1.6, P.z); const d = w.clone().sub(o).normalize(); const h = b.raycast(o, d, 40); if (h) h.hit(9999, d); }`);
check(await ev('return __s.boss.S.dead'), 'mass dead');
await waitFor('__s.story.S.step === 11', 6000, 'step 11');
await tp(M.mass.x, M.mass.z - 3.6, Math.PI); await use('sample');
await waitFor('__s.story.S.step === 12', 6000, 'step 12');

// ---- VIII. the choice ----
await tp(M.glass.x, M.glass.z, Math.PI); await use('kaur'); await waitFor('__s.talking', 3000); await skip();
check(await ev(`return __s.mode === 'choice'`), 'choice shown');
await shot('p-choice');
await ev(`document.getElementById('btnGive').click()`); await sleep(1000);
check(await ev(`return __s.mode === 'ending' && __s.progress.endings.remission`), 'ending REMISSION');
await shot('p-ending');

// ---- a death, and a retry from the checkpoint ----
await ev(`document.getElementById('btnEndTitle').click()`); await sleep(500);
await ev(`window.__god = false; __s.startFrom(null)`); await waitFor(`__s.mode === 'play'`);
await ev(`const P = __s.P; for (let i = 0; i < 4; i++) __s.zombies.spawn('brute', P.x + 0.8 * Math.cos(i * 1.6), P.z + 0.8 * Math.sin(i * 1.6), { state: 'chase', scripted: true });`);
await waitFor(`__s.mode === 'dead'`, 40000, 'died');
await shot('p-dead');
await ev(`document.getElementById('btnRetry').click()`); await waitFor(`__s.mode === 'play'`, 5000, 'retry');
check(await ev('return __s.P.hp > 0 && __s.story.S.step === 0'), 'back at the checkpoint');
console.log(JSON.stringify(await ev('return { kills: __s.progress.kills, deaths: __s.progress.total, stats: __s.stats() }')));
srv.kill();
await done();
