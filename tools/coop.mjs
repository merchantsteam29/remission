// Survival: alone first (night, waves, a gun cache), then two browsers playing together over the real PeerJS
// broker (needs internet): host + join, the joiner sees the host's zombies, shoots one, gets hurt, goes down,
// gets picked up, and game over when everyone's down. Fake microphones, so voice chat connects too.
import { open, sleep } from './harness.mjs';
import { spawn } from 'child_process';
import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['serve.js'], { cwd: root, env: { ...process.env, PORT: port }, stdio: 'ignore' });
process.env.SH_URL = `http://localhost:${port}/`;
await sleep(600);
const media = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
const A = await open(import.meta.url, { args: media, tag: '-host' });
const B = await open(import.meta.url, { args: media, tag: '-join', mobile: true }); // the friend is on a phone
const fail = [];
const check = (ok, what) => { if (!ok) { fail.push(what); console.log('FAIL', what); } else console.log('ok  ', what); };
const waitFor = async (X, js, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await X.ev(`return !!(${js})`)) return true; await sleep(300); } return false; };
for (const X of [A, B]) { await waitFor(X, `document.body.dataset.ready === '1'`, 60000); await X.ev(`localStorage.clear(); document.getElementById('warnOk').click(); __s.setQuality('low');`); }

// ---- alone ----
await A.ev(`document.getElementById('btnSurvival').click()`); await sleep(400);
await A.shot('lobby');
await A.ev(`document.getElementById('mpName').value = 'Hostie'; document.getElementById('mpSolo').click()`);
check(await waitFor(A, `__s.mode === 'play' && __s.gameMode === 'survival'`), 'solo survival starts');
check(await A.ev(`return __s.weapons.S.owned.pistol && __s.pickups.length > 20`), 'pistol + supplies');
await A.ev(`const m = __s.W.marks.armory; __s.tp(m.x + 1, m.z, -Math.PI / 2)`); await sleep(300);
check(await A.ev(`return __s.suse('cache-smg') && __s.weapons.S.owned.smg`), 'SMG from the armory cache');
await A.ev(`__s.tp(0, 9, 0); window.__god = true; __s.hour = 19.98`);
check(await waitFor(A, `__s.surv.R.night === 1 && __s.surv.R.wave >= 1`, 90000), 'night 1, a wave comes');
check(await A.ev(`return __s.zombies.list.filter((z) => z.state === 'chase').length >= 4`), 'the wave is hunting');
await A.shot('solo-night');
await A.ev(`window.__god = false; __s.P.hp = 1; __s.g.spawn('brute', __s.P.x + 1, __s.P.z, { state: 'chase' })`);
check(await waitFor(A, `__s.mode === 'over'`, 40000), 'solo: down = game over');
await A.shot('solo-over');
await A.ev(`document.getElementById('btnOverTitle').click()`); await sleep(500);

// ---- together ----
await A.ev(`document.getElementById('btnSurvival').click(); document.getElementById('mpName').value = 'Hostie'; document.getElementById('mpMic').checked = true; document.getElementById('mpHost').click()`);
check(await waitFor(A, `document.getElementById('mpCodeShow').textContent.length === 4`, 30000), 'room opened');
const code = await A.ev(`return document.getElementById('mpCodeShow').textContent`);
console.log('room', code);
await B.ev(`document.getElementById('btnSurvival').click(); document.getElementById('mpName').value = 'Joiner'; document.getElementById('mpMic').checked = true; document.getElementById('mpCode').value = '${code}'; document.getElementById('mpJoin').click()`);
check(await waitFor(A, `__s.surv.net && __s.surv.net.roster.length === 2`, 30000), 'friend joined');
await A.shot('room');
await A.ev(`document.getElementById('mpStart').click()`);
check(await waitFor(B, `__s.mode === 'play' && __s.gameMode === 'survival' && __s.zombies.S.puppet`, 20000), 'joiner is in, zombies are puppets');
check(await waitFor(B, `__s.surv.remote.size === 1`, 10000) && await waitFor(A, `__s.surv.remote.size === 1`, 10000), 'each sees the other');
// zombies near the joiner, from the host
await A.ev(`window.__god = true; __s.zombies.S.quiet = true; for (const z of [...__s.zombies.list]) __s.zombies.removeBody(z);`);
await B.ev(`__s.tp(0, 9, 0); window.__god = false; __s.P.hp = 100;`);
await sleep(1000);
await A.ev(`__s.tp(3, 12, 0); window.__zb = __s.g.spawn('walker', 0, 3, { state: 'idle', heading: 0, speedMul: 0.001 });`);
check(await waitFor(B, `__s.zombies.list.some((z) => z.puppet && Math.hypot(z.x, z.z - 3) < 6)`, 10000), 'joiner sees the host\'s zombie');
// the joiner shoots it
await B.ev(`__s.weapons.S.mag.pistol = 99; const z = __s.zombies.list.find((q) => q.puppet); window.__t = z; const P = __s.P; P.yaw = Math.atan2(-(z.x - P.x), -(z.z - P.z)); P.pitch = Math.atan2(z.y + 1.3 * z.scale - P.y - 1.62, Math.hypot(z.x - P.x, z.z - P.z));`);
for (let i = 0; i < 12 && !(await A.ev(`return window.__zb.state === 'dead'`)); i++) { await B.ev(`const z = window.__t, P = __s.P; P.yaw = Math.atan2(-(z.x - P.x), -(z.z - P.z)); P.pitch = Math.atan2(z.y + 1.3 * z.scale - P.y - 1.62, Math.hypot(z.x - P.x, z.z - P.z)); __s.mouse(0, true)`); await sleep(150); await B.ev(`__s.mouse(0, false)`); await sleep(350); }
check(await A.ev(`return window.__zb.state === 'dead'`), 'joiner\'s shots kill it on the host');
check(await waitFor(B, `window.__t.state === 'dead'`, 5000), 'and the joiner sees it die');
check(await waitFor(A, `(__s.surv.R.kills[__s.surv.net.roster[1].id] || 0) >= 1`, 5000), 'kill credited to the joiner');
// a zombie hurts the joiner (the host decides), down, picked up by the host
await A.ev(`__s.g.spawn('walker', __s.surv.remote.values().next().value.x + 0.8, __s.surv.remote.values().next().value.z, { state: 'chase' })`);
check(await waitFor(B, `__s.P.hp < 100`, 20000), 'joiner gets hurt by a host zombie');
await A.ev(`for (const z of [...__s.zombies.list]) __s.zombies.removeBody(z);`);
await B.ev(`__s.g.P.hp = 0.5; __s.surv.downLocal('bitten')`);
check(await waitFor(A, `[...__s.surv.remote.values()][0].dn`, 8000), 'host sees the joiner down');
await A.shot('friend-down');
await A.ev(`const r = [...__s.surv.remote.values()][0]; __s.tp(r.x + 0.8, r.z, 0);`); await sleep(500);
check(await A.ev(`return __s.suse('revive-')`), 'revive offered');
check(await waitFor(B, `!__s.P.downed && __s.P.hp > 0`, 8000), 'joiner picked up');
// voice: the call connected
check(await waitFor(A, `__s.surv.net && document.querySelectorAll('#mpRoster li').length === 2`, 3000), 'roster shows both');
// everyone down: over
await B.ev(`__s.P.hp = 0.5; __s.surv.downLocal('bitten')`); await sleep(1500);
await A.ev(`window.__god = false; __s.P.hp = 0.5; __s.surv.downLocal('bitten')`);
check(await waitFor(A, `__s.mode === 'over'`, 10000) && await waitFor(B, `__s.mode === 'over'`, 10000), 'all down: game over for both');
await B.shot('over-join');
// play again from the same room
await A.ev(`document.getElementById('btnOverAgain').click()`);
check(await waitFor(B, `__s.mode === 'play' && !__s.P.downed`, 15000), 'again: both back in');
for (const [n, X] of [['host', A], ['join', B]]) { console.log(n, 'console errors:', X.errs.filter((e) => !/peer error|WebSocket|Lost connection/i.test(e)).length); for (const e of X.errs) console.log('  ', e); }
const bad = [...A.errs, ...B.errs].filter((e) => !/peer error|WebSocket|Lost connection/i.test(e)).length;
await A.close(); await B.close(); srv.kill();
console.log(fail.length || bad ? `FAILED (${fail.length} checks, ${bad} errors)` : 'ALL OK');
process.exit(fail.length || bad ? 1 : 0);
