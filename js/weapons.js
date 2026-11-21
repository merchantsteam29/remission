// Five guns and a knife. Each gun is built from boxes and cylinders and drawn in its own little scene on
// top of the world (so it never pokes through a wall), with your hands and sleeves.
//   1 Semi-auto   M19 pistol         every pull, one round
//   2 SMG         K-9 submachine gun fast, light, close
//   3 Automatic   Service rifle      the all-rounder
//   4 Sniper      Hunting rifle .308 bolt action, a scope, goes through three of them
//   5 Heavy       Door gun           an army minigun torn off the helicopter: spins up, then doesn't stop
import * as THREE from 'three';
import * as A from './audio.js';
import { raycast as worldRay } from './city.js';

export const GUNS = {
  pistol: { slot: 1, name: 'M19 Pistol', type: 'Semi-auto', dmg: 34, rpm: 420, auto: false, mag: 12, max: 144, spread: [0.014, 0.003], recoil: 0.03, reload: 1.35, noise: 40, head: 3.2, pierce: 0, cut: 1, snd: 'pistol', fov: 0.85 },
  smg: { slot: 2, name: 'K-9 SMG', type: 'Submachine gun', dmg: 19, rpm: 900, auto: true, mag: 32, max: 256, spread: [0.042, 0.02], recoil: 0.012, reload: 1.8, noise: 38, head: 2.6, pierce: 0, cut: 1.1, snd: 'smg', fov: 0.85 },
  rifle: { slot: 3, name: 'Service Rifle', type: 'Automatic', dmg: 30, rpm: 640, auto: true, mag: 30, max: 240, spread: [0.032, 0.006], recoil: 0.02, reload: 2.2, noise: 55, head: 3, pierce: 0, cut: 0.9, snd: 'rifle', fov: 0.75 },
  sniper: { slot: 4, name: 'Hunting Rifle .308', type: 'Sniper', dmg: 175, rpm: 50, auto: false, mag: 5, max: 40, spread: [0.07, 0.0], recoil: 0.09, reload: 3.0, noise: 85, head: 5, pierce: 3, cut: 0.35, snd: 'sniper', fov: 0.22, bolt: true },
  minigun: { slot: 5, name: 'Door Gun', type: 'Heavy weapon', dmg: 22, rpm: 1500, auto: true, mag: 200, max: 600, spread: [0.05, 0.035], recoil: 0.006, reload: 4.2, noise: 80, head: 2.4, pierce: 1, cut: 0.7, snd: 'minigun', fov: 0.9, spin: 0.65, moveMul: 0.55 },
};
export const ORDER = ['pistol', 'smg', 'rifle', 'sniper', 'minigun'];

// ---------- models ----------
const M = {
  steel: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.7 }),
  black: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6, metalness: 0.3 }),
  poly: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.85, metalness: 0.05 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x3a4030, roughness: 0.8, metalness: 0.1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6, metalness: 0.0 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a3040, roughness: 0.05, metalness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: 0x1e2c48, roughness: 0.55 }), // nitrile gloves: you're still a doctor
  sleeve: new THREE.MeshStandardMaterial({ color: 0x4a4e58, roughness: 0.9 }),
  coat: new THREE.MeshStandardMaterial({ color: 0xc8c8c0, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb89a40, roughness: 0.35, metalness: 0.9 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xa0a4a8, roughness: 0.25, metalness: 0.95 }),
};
const bx = (g, m, w, h, d, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
const cy = (g, m, r, l, x, y, z, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
function hands(g, { lx = -0.05, ly = -0.07, lz = -0.2, rx = 0, ry = -0.08, rz = 0.02 } = {}) {
  // right hand on the grip, left under the front; sleeves running back out of view
  const r = new THREE.Group(); r.position.set(rx, ry, rz); g.add(r);
  bx(r, M.skin, 0.045, 0.09, 0.08, 0, 0, 0); bx(r, M.sleeve, 0.08, 0.09, 0.32, 0.01, -0.03, 0.2, -0.15);
  const l = new THREE.Group(); l.position.set(lx, ly, lz); g.add(l);
  bx(l, M.skin, 0.08, 0.045, 0.09, 0, 0, 0); bx(l, M.sleeve, 0.085, 0.085, 0.34, -0.04, -0.04, 0.18, -0.2);
  return { r, l };
}
function buildModels() {
  const G = {};
  { // pistol
    const g = new THREE.Group();
    bx(g, M.steel, 0.034, 0.038, 0.19, 0, 0.02, -0.06); bx(g, M.black, 0.03, 0.025, 0.16, 0, -0.008, -0.05);
    bx(g, M.poly, 0.032, 0.11, 0.05, 0, -0.07, 0.015, 0.22); bx(g, M.black, 0.012, 0.02, 0.02, 0, 0.044, -0.14);
    bx(g, M.black, 0.03, 0.01, 0.045, 0, -0.03, -0.035);
    hands(g, { lx: -0.008, ly: -0.075, lz: 0.02, rx: 0.012, ry: -0.07, rz: 0.03 });
    g.userData = { muzzle: new THREE.Vector3(0, 0.02, -0.17), hip: new THREE.Vector3(0.16, -0.17, -0.38), ads: new THREE.Vector3(0, -0.056, -0.3), slide: g.children[0] };
    G.pistol = g;
  }
  { // SMG
    const g = new THREE.Group();
    bx(g, M.black, 0.05, 0.07, 0.3, 0, 0, -0.08); bx(g, M.poly, 0.035, 0.17, 0.045, 0, -0.11, -0.1, 0.1);
    bx(g, M.poly, 0.035, 0.09, 0.04, 0, -0.07, 0.05, 0.25); cy(g, M.steel, 0.012, 0.1, 0, 0.012, -0.27);
    bx(g, M.steel, 0.012, 0.04, 0.2, 0.0, 0.0, 0.14); bx(g, M.black, 0.02, 0.025, 0.06, 0, 0.045, -0.02);
    hands(g, { lx: 0, ly: -0.07, lz: -0.15, rx: 0.01, ry: -0.08, rz: 0.06 });
    g.userData = { muzzle: new THREE.Vector3(0, 0.012, -0.33), hip: new THREE.Vector3(0.16, -0.16, -0.36), ads: new THREE.Vector3(0, -0.058, -0.28) };
    G.smg = g;
  }
  { // service rifle
    const g = new THREE.Group();
    bx(g, M.olive, 0.05, 0.08, 0.32, 0, 0, -0.02); bx(g, M.black, 0.055, 0.07, 0.24, 0, 0.0, -0.29);
    cy(g, M.steel, 0.011, 0.24, 0, 0.005, -0.52); bx(g, M.black, 0.035, 0.16, 0.06, 0, -0.11, -0.05, 0.25);
    bx(g, M.poly, 0.035, 0.1, 0.045, 0, -0.08, 0.1, 0.3); bx(g, M.olive, 0.045, 0.09, 0.24, 0, -0.02, 0.26);
    bx(g, M.black, 0.02, 0.05, 0.05, 0, 0.065, -0.03); bx(g, M.black, 0.01, 0.04, 0.012, 0, 0.055, -0.38);
    hands(g, { lx: -0.005, ly: -0.065, lz: -0.27, rx: 0.012, ry: -0.08, rz: 0.1 });
    g.userData = { muzzle: new THREE.Vector3(0, 0.005, -0.65), hip: new THREE.Vector3(0.15, -0.17, -0.36), ads: new THREE.Vector3(0, -0.088, -0.26) };
    G.rifle = g;
  }
  { // hunting rifle with scope
    const g = new THREE.Group();
    bx(g, M.wood, 0.05, 0.07, 0.6, 0, -0.02, -0.1); bx(g, M.wood, 0.045, 0.1, 0.24, 0, -0.04, 0.3, 0.12);
    bx(g, M.steel, 0.04, 0.05, 0.22, 0, 0.03, -0.02); cy(g, M.steel, 0.012, 0.5, 0, 0.03, -0.45);
    cy(g, M.black, 0.022, 0.3, 0, 0.09, -0.05, 14); cy(g, M.glass, 0.026, 0.02, 0, 0.09, -0.2, 14); cy(g, M.black, 0.028, 0.05, 0, 0.09, 0.11, 14);
    const bolt = bx(g, M.steel, 0.07, 0.012, 0.012, 0.04, 0.03, 0.06);
    hands(g, { lx: -0.005, ly: -0.07, lz: -0.3, rx: 0.012, ry: -0.08, rz: 0.13 });
    g.userData = { muzzle: new THREE.Vector3(0, 0.03, -0.7), hip: new THREE.Vector3(0.15, -0.17, -0.34), ads: new THREE.Vector3(0, -0.09, -0.2), bolt };
    G.sniper = g;
  }
  { // the door gun
    const g = new THREE.Group();
    bx(g, M.olive, 0.12, 0.12, 0.26, 0, 0, 0.02); bx(g, M.olive, 0.1, 0.16, 0.18, -0.13, -0.04, 0.06);
    const barrels = new THREE.Group(); barrels.position.set(0, 0, -0.12); g.add(barrels);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cy(barrels, M.steel, 0.009, 0.62, Math.cos(a) * 0.034, Math.sin(a) * 0.034, -0.3, 6); }
    cy(barrels, M.black, 0.05, 0.03, 0, 0, -0.06, 12); cy(barrels, M.black, 0.05, 0.03, 0, 0, -0.5, 12);
    bx(g, M.black, 0.03, 0.03, 0.18, 0, 0.11, 0.0); bx(g, M.black, 0.03, 0.08, 0.03, 0, 0.08, 0.08);
    hands(g, { lx: -0.03, ly: 0.135, lz: 0.0, rx: 0.02, ry: -0.08, rz: 0.12 });
    g.userData = { muzzle: new THREE.Vector3(0, 0, -0.75), hip: new THREE.Vector3(0.24, -0.3, -0.55), ads: new THREE.Vector3(0.12, -0.25, -0.5), barrels };
    G.minigun = g;
  }
  { // knife (comes up for a swing)
    const g = new THREE.Group();
    bx(g, M.black, 0.025, 0.03, 0.1, 0, 0, 0.03); const b = bx(g, M.blade, 0.006, 0.03, 0.17, 0, 0.005, -0.1); void b;
    bx(g, M.skin, 0.05, 0.08, 0.08, 0, -0.02, 0.04); bx(g, M.sleeve, 0.08, 0.09, 0.3, 0.01, -0.04, 0.22, -0.15);
    g.userData = { hip: new THREE.Vector3(0.2, -0.2, -0.32) };
    G.knife = g;
  }
  return G;
}
function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,0.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = gr; for (let k = 0; k < 6; k++) { g.save(); g.translate(32, 32); g.rotate(k / 6 * Math.PI * 2); g.beginPath(); g.moveTo(-5, 0); g.lineTo(0, -32); g.lineTo(5, 0); g.fill(); g.restore(); }
  g.beginPath(); g.arc(32, 32, 14, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- the arsenal ----------
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Vector3();
export function createWeapons({ camera, world, zombies, gore, fx, onNoise, onHitMarker, onShot, extra }) {
  const scene = new THREE.Scene();
  const vmCam = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
  const hemi = new THREE.HemisphereLight(0xb0b8c8, 0x302820, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(0.5, 1, 0.6); scene.add(sun);
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 3, 2); scene.add(muzzleLight);
  const torch = new THREE.SpotLight(0xfff0d8, 0, 3, 0.8, 0.5, 1); torch.position.set(0.1, 0.1, 0.2); torch.target.position.set(0, -0.1, -1); scene.add(torch, torch.target);
  const models = buildModels();
  for (const g of Object.values(models)) { g.visible = false; scene.add(g); g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); }
  const flashSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flashSpr.visible = false; scene.add(flashSpr);
  // world effects: muzzle light at you, tracers, sparks
  const worldFlash = new THREE.PointLight(0xffb060, 0, 14, 2); world.add(worldFlash);
  const tracerGeo = new THREE.BufferGeometry(); const TR = 24; const trPos = new Float32Array(TR * 6); tracerGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); tracers.frustumCulled = false; world.add(tracers);
  const trLife = new Float32Array(TR); let trHead = 0;
  const sparkTex = flashTexture();
  const sparks = Array.from({ length: 30 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: 0xffe0b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; s.userData.t = 0; world.add(s); return s; });
  const puffs = Array.from({ length: 20 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x9a948a, transparent: true, opacity: 0.5, depthWrite: false })); s.visible = false; s.userData.t = 0; world.add(s); return s; });
  let sparkHead = 0, puffHead = 0;

  const S = {
    owned: { pistol: false, smg: false, rifle: false, sniper: false, minigun: false }, mag: {}, reserve: {}, cur: null, prev: null,
    cool: 0, reloadT: 0, switchT: 0, switchTo: null, aim: 0, spin: 0, kick: 0, kickRot: 0, bob: 0, knifeT: 0, knifeCd: 0, boltT: 0, triggerHeld: false, shots: 0,
    recoilPitch: 0, recoilYaw: 0, kickPitch: 0, flashT: 0, barrelRot: 0, firedThisFrame: false,
  };
  for (const k of ORDER) { S.mag[k] = 0; S.reserve[k] = 0; }

  function give(k, mag = GUNS[k].mag, reserve = GUNS[k].mag * 2) {
    const first = !S.owned[k]; S.owned[k] = true;
    if (first) S.mag[k] = mag; S.reserve[k] = Math.min(GUNS[k].max, S.reserve[k] + reserve);
    if (first) equip(k);
    return first;
  }
  function addAmmo(k, n) { if (!S.owned[k]) { S.reserve[k] = Math.min(GUNS[k].max, S.reserve[k] + n); return; } S.reserve[k] = Math.min(GUNS[k].max, S.reserve[k] + n); }
  function equip(k) {
    if (!S.owned[k] || S.cur === k && !S.switchTo) return;
    if (S.cur) { S.switchTo = k; S.switchT = 0.32; S.reloadT = 0; return; }
    S.cur = k; S.switchT = -0.3;
  }
  function cycle(dir) { const own = ORDER.filter((k) => S.owned[k]); if (!own.length) return; const i = own.indexOf(S.switchTo || S.cur); equip(own[(i + dir + own.length) % own.length]); }
  function reload() {
    const k = S.cur; if (!k || S.reloadT > 0 || S.switchT > 0) return;
    const G = GUNS[k]; if (S.mag[k] >= G.mag || S.reserve[k] <= 0) return;
    S.reloadT = G.reload; S.reloadStart = G.reload; A.mech('out');
  }
  function knife() {
    if (S.knifeCd > 0) return false;
    S.knifeT = 0.42; S.knifeCd = 0.6; A.swing();
    return true;
  }

  function fire(P) {
    const k = S.cur, G = GUNS[k];
    S.mag[k]--; S.cool = 60 / G.rpm; S.shots++;
    if (G.bolt) S.boltT = 0.9;
    A.gunshot(G.snd, P.indoors ? 1 : 0); if (k !== 'minigun' || S.shots % 3 === 0) A.shell();
    onNoise?.(P.x, P.z, G.noise);
    S.flashT = 0.05; S.kick = Math.min(1, S.kick + (k === 'minigun' ? 0.12 : k === 'sniper' ? 1 : 0.5));
    // recoil on the camera: up, a little sideways; less when aimed
    const rk = G.recoil * (1 - S.aim * 0.45);
    const up = rk * (0.8 + Math.random() * 0.4); S.recoilPitch += up * 0.2; S.kickPitch += up * 0.8; S.recoilYaw += rk * (Math.random() - 0.5) * 0.6; // most of the kick comes back down by itself
    // spread grows when moving and when you hold the trigger
    const base = G.spread[0] + (G.spread[1] - G.spread[0]) * S.aim;
    const spread = base * (1 + P.moving * 0.6 + (P.airborne ? 1 : 0)) * (k === 'sniper' && S.aim > 0.9 ? 0 : 1) + (G.auto ? Math.min(0.02, S.shots * 0.0015) * (1 - S.aim * 0.6) : 0);
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * spread;
    _d.addScaledVector(_r, Math.cos(a) * rr).addScaledVector(_u, Math.sin(a) * rr).normalize();
    // the round: through up to G.pierce + 1 bodies, until a wall
    let wh = worldRay(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, 220);
    let wallT = wh ? wh.t : 220;
    // anything else that can be shot (the Mass): it stops the round like a wall does
    const ex = extra?.(); let exHit = null;
    if (ex) for (const t of ex) { const h = t.raycast(_o, _d, wallT); if (h && (!exHit || h.t < exHit.t)) exHit = h; }
    if (exHit) { wallT = exHit.t; wh = null; const r = exHit.hit(G.dmg, _d.clone()); onHitMarker?.(r && r.part !== 'body', false); }
    const ignore = new Set(); let dmg = G.dmg, endT = wallT, hits = 0, killed = 0;
    for (let n = 0; n <= G.pierce; n++) {
      const h = zombies.raycast(_o, _d, wallT, ignore);
      if (!h) break;
      ignore.add(h.zb); hits++;
      if (zombies.damage(h.zb, h.part, dmg, _d.clone(), h.point, { head: G.head, cut: G.cut, gun: k })) killed++;
      onHitMarker?.(h.part === 'head', h.zb.state === 'dead');
      endT = h.t; dmg *= 0.7;
    }
    if (!hits || G.pierce) endT = wallT;
    if (wh && (!hits || G.pierce)) impact(wh, _d);
    // tracer from the muzzle
    if (k !== 'pistol' || Math.random() < 0.3) {
      _m.set(0.14, -0.14, -0.7).applyMatrix4(camera.matrixWorld);
      const e = _o.clone().addScaledVector(_d, Math.min(endT, 120)), i = trHead++ % TR;
      const st = _m.clone().lerp(e, 0.05);
      trPos.set([st.x, st.y, st.z, e.x, e.y, e.z], i * 6); trLife[i] = 0.05;
    }
    onShot?.(k, hits, killed);
  }
  function impact(h, d) {
    const s = sparks[sparkHead++ % sparks.length]; s.position.set(h.x - d.x * 0.05, h.y - d.y * 0.05, h.z - d.z * 0.05); s.visible = true; s.userData.t = 0.06; s.scale.setScalar(0.25 + Math.random() * 0.2);
    const p = puffs[puffHead++ % puffs.length]; p.position.set(h.x + h.nx * 0.1, h.y + h.ny * 0.1, h.z + h.nz * 0.1); p.visible = true; p.userData.t = 0.6; p.scale.setScalar(0.2);
    A.impact(h, h.mat === 1 ? 'metal' : 'stone');
    void fx;
  }

  // ---------- each frame ----------
  // I = { fire (held), fireHit (pressed), aim (held), reloadHit, knifeHit, swap: -1|0|1, slot: 0..5 }
  function update(dt, I, P) {
    S.firedThisFrame = false;
    S.cool -= dt; S.knifeCd -= dt; S.boltT = Math.max(0, S.boltT - dt);
    if (I.slot) equip(ORDER[I.slot - 1]);
    if (I.swap) cycle(I.swap);
    if (I.reloadHit) reload();
    if (I.knifeHit && S.reloadT <= 0) knife();
    const k = S.cur, G = k ? GUNS[k] : null;
    // switching: down, swap, up
    if (S.switchT > 0) { S.switchT -= dt; if (S.switchT <= 0 && S.switchTo) { S.prev = S.cur; S.cur = S.switchTo; S.switchTo = null; S.switchT = -0.3; A.mech('slide'); } }
    else if (S.switchT < 0) S.switchT = Math.min(0, S.switchT + dt);
    const ready = k && S.switchT === 0 && S.knifeT <= 0;
    // reload
    if (S.reloadT > 0) {
      const before = S.reloadT; S.reloadT -= dt;
      const f0 = 1 - before / S.reloadStart, f1 = 1 - S.reloadT / S.reloadStart;
      if (f0 < 0.55 && f1 >= 0.55) A.mech(k === 'minigun' ? 'belt' : 'in');
      if (f0 < 0.85 && f1 >= 0.85) A.mech(k === 'sniper' ? 'bolt' : 'slide');
      if (S.reloadT <= 0) { const need = G.mag - S.mag[k], take = Math.min(need, S.reserve[k]); S.mag[k] += take; S.reserve[k] -= take; S.reloadT = 0; }
    }
    // aim
    const wantAim = I.aim && ready && S.reloadT <= 0 && !P.sprinting;
    S.aim += ((wantAim ? 1 : 0) - S.aim) * Math.min(1, dt * (k === 'sniper' ? 9 : 12));
    // the minigun spins while you hold the trigger (or aim)
    if (k === 'minigun') { const want = (I.fire || I.aim) && ready && S.reloadT <= 0 ? 1 : 0; S.spin += (want - S.spin) * Math.min(1, dt / (want ? G.spin : 0.8)) * 3; S.spin = Math.max(0, Math.min(1, S.spin)); A.spin(S.spin); }
    else if (S.spin > 0) { S.spin = 0; A.spin(0); }
    // trigger
    if (ready && S.reloadT <= 0 && !P.sprinting) {
      const pull = G.auto ? I.fire : I.fireHit;
      if (pull && S.cool <= 0 && S.boltT <= 0 && (k !== 'minigun' || S.spin > 0.92)) {
        if (S.mag[k] > 0) {
          let n = 0; while (S.cool <= 0 && S.mag[k] > 0 && n < 4) { fire(P); n++; if (!G.auto) break; S.cool += 0; }
          S.firedThisFrame = true;
        } else if (I.fireHit) { A.dryFire(); if (S.reserve[k] > 0) reload(); S.cool = 0.25; }
      }
      if (!I.fire) S.shots = 0;
    }
    if (ready && S.mag[k] === 0 && S.reserve[k] > 0 && S.reloadT <= 0 && S.cool <= 0 && !I.fire) reload();
    // knife
    if (S.knifeT > 0) { const was = S.knifeT; S.knifeT -= dt; if (was > 0.26 && S.knifeT <= 0.26) S.knifeHits = P.onKnife?.(); }
    animate(dt, P);
    // fx
    for (let i = 0; i < TR; i++) if (trLife[i] > 0) { trLife[i] -= dt; if (trLife[i] <= 0) trPos.fill(0, i * 6, i * 6 + 6); }
    tracerGeo.attributes.position.needsUpdate = true;
    for (const s of sparks) if (s.visible && (s.userData.t -= dt) <= 0) s.visible = false;
    for (const p of puffs) if (p.visible) { p.userData.t -= dt; p.scale.multiplyScalar(1 + dt * 3); p.material.opacity = Math.max(0, p.userData.t) * 0.7; if (p.userData.t <= 0) p.visible = false; }
    S.flashT -= dt;
    const fl = S.flashT > 0;
    flashSpr.visible = fl && !(k === 'sniper' && S.aim > 0.9); muzzleLight.intensity = fl ? 4 : 0; worldFlash.intensity = fl ? (k === 'minigun' ? 20 : 30) : 0;
    camera.getWorldPosition(worldFlash.position);
    // the camera's recoil returns
    const back = Math.min(1, dt * 9);
    S.kickPitch *= Math.exp(-dt * 11);
    const out = { pitch: S.recoilPitch * back, yaw: S.recoilYaw * back }; S.recoilPitch -= out.pitch; S.recoilYaw -= out.yaw;
    return out;
  }
  const _hip = new THREE.Vector3();
  function animate(dt, P) {
    for (const [n, g] of Object.entries(models)) g.visible = n === S.cur && S.knifeT <= 0 || n === 'knife' && S.knifeT > 0;
    const k = S.cur;
    S.kick = Math.max(0, S.kick - dt * (k === 'sniper' ? 4 : 12));
    S.bob += dt * (P.moving > 0.1 ? (P.sprinting ? 13 : 8.5) : 1.5);
    const bobA = (P.moving > 0.1 ? (P.sprinting ? 0.03 : 0.014) : 0.003) * (1 - S.aim * 0.85);
    if (S.knifeT > 0) {
      const g = models.knife, t = 1 - S.knifeT / 0.42, sw = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      g.position.set(0.22 - sw * 0.3, -0.2 + sw * 0.06, -0.34 - sw * 0.12); g.rotation.set(-0.3 - sw * 0.4, 0.6 - sw * 1.6, -0.6 + sw * 0.9);
      return;
    }
    if (!k) return;
    const g = models[k], U = g.userData;
    _hip.copy(U.hip).lerp(U.ads, S.aim);
    let dip = 0;
    if (S.switchT > 0) dip = 1 - S.switchT / 0.32; else if (S.switchT < 0) dip = -S.switchT / 0.3;
    let rl = 0; if (S.reloadT > 0) { const f = 1 - S.reloadT / S.reloadStart; rl = Math.sin(Math.min(1, f) * Math.PI); }
    const sprint = P.sprinting ? 1 : 0;
    g.position.set(_hip.x + Math.cos(S.bob * 0.5) * bobA + sprint * 0.04, _hip.y - Math.abs(Math.sin(S.bob * 0.5)) * bobA - dip * 0.3 - rl * 0.08 - sprint * 0.03, _hip.z + S.kick * (k === 'sniper' ? 0.08 : 0.035));
    g.rotation.set(S.kick * (k === 'sniper' ? 0.25 : 0.08) + rl * 0.5 - sprint * 0.35, sprint * 0.6 + rl * 0.3, rl * 0.6 + sprint * 0.2);
    if (U.barrels) { S.barrelRot += dt * S.spin * 40; U.barrels.rotation.z = S.barrelRot; }
    if (U.slide) U.slide.position.z = -0.06 + (S.flashT > 0 ? 0.03 : 0);
    if (U.bolt) U.bolt.position.z = 0.06 + (S.boltT > 0.2 && S.boltT < 0.7 ? 0.05 : 0);
    // the flash sits on the muzzle
    flashSpr.position.copy(U.muzzle).applyEuler(g.rotation).add(g.position); flashSpr.scale.setScalar(k === 'minigun' ? 0.16 : k === 'sniper' ? 0.3 : 0.2); flashSpr.material.rotation = Math.random() * 6;
    muzzleLight.position.copy(flashSpr.position);
  }
  function setLight(sunCol, sunI, hemiI, torchOn) { sun.color.set(sunCol); sun.intensity = sunI; hemi.intensity = hemiI; torch.intensity = torchOn ? 2 : 0; }
  function resize(aspect) { vmCam.aspect = aspect; vmCam.updateProjectionMatrix(); }
  function snapshot() { return { owned: { ...S.owned }, mag: { ...S.mag }, reserve: { ...S.reserve }, cur: S.cur }; }
  function restore(s) { if (!s) return; Object.assign(S.owned, s.owned); Object.assign(S.mag, s.mag); Object.assign(S.reserve, s.reserve); S.cur = s.cur && S.owned[s.cur] ? s.cur : null; S.reloadT = 0; S.switchT = 0; S.switchTo = null; S.aim = 0; S.spin = 0; A.spin(0); S.knifeT = 0; }
  return { scene, vmCam, S, give, addAmmo, equip, cycle, reload, update, setLight, resize, snapshot, restore, models };
}
