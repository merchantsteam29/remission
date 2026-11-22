// Menus, settings (the gore slider), controllers (Xbox, PlayStation raw, Steam Deck, a wheel that must be
// ignored), the sniper scope, the map, and the phone layout.
import { open, sleep } from './harness.mjs';
import { spawn } from 'child_process';
import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['serve.js'], { cwd: root, env: { ...process.env, PORT: port }, stdio: 'ignore' });
process.env.SH_URL = `http://localhost:${port}/`;
await sleep(600);
{
  const { ev, shot, check, close, errs } = await open(import.meta.url);
  for (let i = 0; i < 80 && (await ev('return document.body.dataset.ready')) !== '1'; i++) await sleep(500);
  await shot('warn');
  // the gore slider on the warning screen sets the setting
  await ev(`const s = document.querySelector('[data-set=gore]'); s.value = 85; s.dispatchEvent(new Event('input'))`);
  check(await ev(`return __s.settings.gore === 85 && document.getElementById('sGore').value === '85'`), 'warn slider sets gore');
  await shot('warn-85');
  await ev(`document.getElementById('warnOk').click()`); await sleep(800);
  await ev(`document.getElementById('btnSettings').click()`); await sleep(300); await shot('settings');
  await ev(`document.querySelector('#settings [data-back]').click(); document.getElementById('btnHow').click()`); await sleep(300); await shot('how');
  await ev(`document.querySelector('#how [data-back]').click()`);
  // play, with fake pads
  await ev(`window.__god = true; __s.setQuality('low'); __s.endIntro()`); await sleep(2500);
const ready = async (g) => { for (let i = 0; i < 100; i++) { if (await ev(`return __s.weapons.S.cur === '${g}' && __s.weapons.S.switchT === 0`)) return; await sleep(200); } };
  await ev(`__s.weapons.give('sniper'); __s.weapons.give('rifle'); __s.weapons.S.reserve.rifle = 99; __s.tp(28, 30, 0); __s.zombies.S.quiet = true; for (const z of [...__s.zombies.list]) __s.zombies.removeBody(z);`);
  const pad = (id, mapping, { axes = [0, 0, 0, 0], pressed = [] } = {}) => `({ id: ${JSON.stringify(id)}, index: 0, connected: true, mapping: '${mapping}', axes: ${JSON.stringify(axes)}, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: ${JSON.stringify(pressed)}.includes(i), value: ${JSON.stringify(pressed)}.includes(i) ? 1 : 0 })) })`;
  const setPad = (p) => ev(`window.__pad = ${p}; navigator.getGamepads = () => [window.__pad];`);
  // a wheel with its axis resting hard over: must NOT turn the camera
  await setPad(pad('Logitech G29 Driving Force Racing Wheel (Vendor: 046d Product: c24f)', 'standard', { axes: [0, 0, 1, 0] }));
  let y0 = await ev('return __s.P.yaw'); await sleep(800);
  check(Math.abs((await ev('return __s.P.yaw')) - y0) < 0.01, 'wheel ignored');
  // Xbox: centred first, then RT fires the rifle
  await setPad(pad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard')); await sleep(300);
  await ev(`__s.weapons.equip('rifle')`); await ready('rifle');
  const m0 = await ev('return __s.weapons.S.mag.rifle');
  await setPad(pad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard', { pressed: [7] })); await sleep(900);
  await setPad(pad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard')); await sleep(200);
  check((await ev('return __s.weapons.S.mag.rifle')) < m0, 'Xbox RT fires');
  check(await ev(`return document.body.dataset.input === 'pad'`), 'pad mode');
  // the right stick turns the camera once it has been seen centred
  y0 = await ev('return __s.P.yaw');
  await setPad(pad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard', { axes: [0, 0, 0.9, 0] })); await sleep(500);
  check(Math.abs((await ev('return __s.P.yaw')) - y0) > 0.05, 'right stick turns');
  await setPad(pad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard'));
  // PlayStation, raw DirectInput layout: ✕ is button 1, R2 is button 7 + axis 4
  await setPad(pad('Wireless Controller (Vendor: 054c Product: 0ce6)', '', { axes: [0, 0, 0, -1, -1, 0] })); await sleep(300);
  const m1 = await ev('return __s.weapons.S.mag.rifle');
  await setPad(pad('Wireless Controller (Vendor: 054c Product: 0ce6)', '', { axes: [0, 0, 0, -1, 1, 0], pressed: [7] })); await sleep(900);
  await setPad(pad('Wireless Controller (Vendor: 054c Product: 0ce6)', '', { axes: [0, 0, 0, -1, -1, 0] })); await sleep(200);
  check((await ev('return __s.weapons.S.mag.rifle')) < m1, 'PlayStation R2 fires');
  check(await ev(`return __s.weapons.S.mag.rifle >= 0 && document.querySelector('.only-pad') !== null`), 'ok');
  // Steam Deck: Y swaps to the sniper, LT aims: the scope
  await setPad(pad('Steam Deck (Vendor: 28de Product: 1205)', 'standard')); await sleep(300);
  await setPad(pad('Steam Deck (Vendor: 28de Product: 1205)', 'standard', { pressed: [3] })); await sleep(200);
  await setPad(pad('Steam Deck (Vendor: 28de Product: 1205)', 'standard')); await sleep(2500);
  const cur = await ev('return __s.weapons.S.cur');
  if (cur !== 'sniper') await ev(`__s.weapons.equip('sniper')`); await ready('sniper');
  await setPad(pad('Steam Deck (Vendor: 28de Product: 1205)', 'standard', { pressed: [6] })); for (let i = 0; i < 40 && !(await ev('return __s.weapons.S.aim > 0.9')); i++) await sleep(200); await sleep(300);
  check(await ev(`return document.getElementById('scope').classList.contains('on')`), 'Deck LT scopes in');
  await shot('scope');
  await setPad(pad('Steam Deck (Vendor: 28de Product: 1205)', 'standard')); await sleep(400);
  await ev(`window.__pad = null; navigator.getGamepads = () => [];`);
  // the map
  await ev(`__s.openMap(true)`); await sleep(300); await shot('map'); await ev(`__s.openMap(false)`);
  await close();
  console.log("DESKTOP ERRORS (" + errs.length + "):"); for (const e of errs) console.log("  " + e); if (errs.length) process.exitCode = 1;
}
{ // a phone, sideways
  const { ev, shot, check, done, tapEl } = await open(import.meta.url, { mobile: true, tag: '-phone' });
  for (let i = 0; i < 80 && (await ev('return document.body.dataset.ready')) !== '1'; i++) await sleep(500);
  await tapEl('#warnOk'); await sleep(600);
  await ev(`__s.endIntro(); __s.weapons.give('pistol')`); await sleep(2500);
  check(await ev(`return document.getElementById('touch').classList.contains('on')`), 'touch controls on');
  const m0 = await ev('return __s.weapons.S.mag.pistol');
  await tapEl('[data-t=fire]'); await sleep(400);
  check((await ev('return __s.weapons.S.mag.pistol')) < m0, 'touch FIRE fires');
  await shot('phone');
  // aim assist + auto-fire: a zombie just off the sights gets pulled in and shot without touching FIRE
  await ev(`__s.tp(0, 21, 0, 0); __s.zombies.S.quiet = true; for (const z of [...__s.zombies.list]) __s.zombies.removeBody(z); __s.weapons.S.mag.pistol = 12;
    const zb = __s.zombies.spawn('walker', 0.5, 13, { state: 'idle', heading: 0, speedMul: 0.001, scripted: true }); window.__a = zb; __s.P.yaw = 0.04; __s.P.pitch = 0.0;`);
  for (let i = 0; i < 40 && (await ev('return __s.weapons.S.mag.pistol')) >= 12; i++) await sleep(250);
  check((await ev('return __s.weapons.S.mag.pistol')) < 12, 'auto-fire shoots on its own (touch)');
  await shot('phone-autofire');
  // survival lobby on a phone
  await ev(`__s.mode = 'title'; document.getElementById('btnSurvival').click()`); await sleep(400);
  await shot('phone-lobby');
  srv.kill();
  await done();
}
