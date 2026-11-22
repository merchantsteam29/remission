// The dead. REM-7 taught cancer cells to stop dying; then it taught the rest of the body. They walk by day,
// a few run at night, and the ones it grew the most (the Growths) are big as doors.
//
// Each body is a little rig of boxes: hips, spine, head, two arms and two legs in two pieces each. Bullets
// are tested against capsules along those bones, so a shot lands where you aimed it. With gore on, limbs
// come off at the joint (a leg makes it crawl), heads burst, and what's left lies in the street.
// Paths: one flow field (a breadth-first search out from you over the city grid, 80 m across) shared by all.
import * as THREE from 'three';
import * as TX from './tex.js';
import { N, H, CELL, HALF, SOLID, cellOf, collide, clearLine, groundY, indoorAt, solid, onStreet } from './city.js';
import * as A from './audio.js';

// ---------- shared rig parts ----------
const G = {
  torso: new THREE.BoxGeometry(0.42, 0.6, 0.24).translate(0, 0.3, 0),
  belly: new THREE.BoxGeometry(0.38, 0.22, 0.22).translate(0, -0.05, 0),
  head: new THREE.SphereGeometry(0.135, 14, 10).scale(0.92, 1.08, 1),
  upper: new THREE.BoxGeometry(0.12, 0.32, 0.12).translate(0, -0.16, 0),
  fore: new THREE.BoxGeometry(0.1, 0.3, 0.1).translate(0, -0.15, 0),
  hand: new THREE.BoxGeometry(0.09, 0.12, 0.05).translate(0, -0.36, 0),
  thigh: new THREE.BoxGeometry(0.16, 0.44, 0.16).translate(0, -0.22, 0),
  shin: new THREE.BoxGeometry(0.13, 0.44, 0.13).translate(0, -0.22, 0),
  foot: new THREE.BoxGeometry(0.12, 0.08, 0.26).translate(0, -0.46, 0.05),
  stump: new THREE.SphereGeometry(0.07, 8, 6),
  lump: new THREE.IcosahedronGeometry(0.16, 1),
  eyes: (() => { const a = new THREE.SphereGeometry(0.016, 6, 4).translate(-0.045, 0.01, 0.118), b = new THREE.SphereGeometry(0.016, 6, 4).translate(0.045, 0.01, 0.118); const g = new THREE.BufferGeometry(); const pa = a.attributes.position.array, pb = b.attributes.position.array, p = new Float32Array(pa.length + pb.length); p.set(pa); p.set(pb, pa.length); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const ia = a.index.array, ib = b.index.array, idx = new Uint16Array(ia.length + ib.length); idx.set(ia); for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + pa.length / 3; g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); return g; })(),
  gib: new THREE.IcosahedronGeometry(0.06, 0),
};
const lam = (o) => new THREE.MeshLambertMaterial(o);
const MAT = { skins: [], faces: {}, shirts: [], pants: [], stump: null, eyes: null, lump: null };
const SKIN = [0x8a9480, 0x9a9a88, 0x7a8478, 0xa49884, 0x6a7466];
const SHIRT = [[0x6a6a70, 'plain'], [0x3a4a6a, 'plain'], [0x8a2a24, 'stripe'], [0xb8b0a0, 'plain'], [0x2a3a2a, 'plain'], [0x5a4a3a, 'stripe'], [0x9a8a5a, 'plain']];
const OUTFIT = {
  patient: [0xa8b8c8, 'gown'], doctor: [0xd8d8d4, 'plain'], cop: [0x1a2236, 'uniform'], soldier: [0x4a5232, 'uniform'], guard: [0x2a2a30, 'uniform'],
  mara: [0x6a4a7a, 'plain'], noah: [0xc8d4e0, 'gown'], kaur: [0xe8e8e8, 'plain'], gus: [0x6a3a2a, 'stripe'],
};
let built = false;
function buildMats() {
  if (built) return; built = true;
  SKIN.forEach((s, i) => MAT.skins.push(lam({ map: TX.deadSkin('ds' + i, s, 41 + i) })));
  SHIRT.forEach(([c, p], i) => MAT.shirts.push(lam({ map: TX.rags('sh' + i, c, p, 50 + i, 0.6) })));
  [0x2a2a34, 0x3a3428, 0x1a1a1e, 0x4a4438].forEach((c, i) => MAT.pants.push(lam({ map: TX.rags('pa' + i, c, 'plain', 60 + i, 0.3) })));
  for (const [k, [c, p]] of Object.entries(OUTFIT)) MAT['o_' + k] = lam({ map: TX.rags('o' + k, c, p, 70 + k.length, k === 'kaur' ? 0 : k === 'noah' ? 0.8 : 0.7) });
  MAT.stump = lam({ map: TX.meat() });
  MAT.eyes = new THREE.MeshBasicMaterial({ color: 0x9a9a70 });
  MAT.lump = lam({ map: TX.deadSkin('lump', 0xa06050, 88, 1) });
  MAT.alive = lam({ color: 0xc89a7a });
  MAT.hair = lam({ color: 0x1a1410 });
}
function faceMat(kind, i, alive = false) {
  const key = kind + i + (alive ? 'a' : '');
  if (!MAT.faces[key]) {
    if (alive) MAT.faces[key] = lam({ map: TX.face('alive' + i, { skin: 0xb88a6a, eye: 0x2a1a10, hair: 0x1a1410, brow: 0x1a1410, lips: 0x8a4a40, age: 45 }) });
    else MAT.faces[key] = lam({ map: TX.deadFace('df' + key, SKIN[i % SKIN.length], 43 + i * 7, kind) });
  }
  return MAT.faces[key];
}

// a body. outfit: null (random clothes) or a key of OUTFIT. alive: Dr. Kaur
export function makeRig(kind = 'walker', seed = Math.random() * 1000 | 0, outfit = null, alive = false) {
  buildMats();
  const si = seed % SKIN.length;
  const skin = alive ? MAT.alive : MAT.skins[si];
  const shirt = outfit ? MAT['o_' + outfit] : MAT.shirts[seed % MAT.shirts.length];
  const pants = outfit === 'patient' || outfit === 'noah' ? shirt : MAT.pants[(seed >> 2) % MAT.pants.length];
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; return o; };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const torso = mesh(G.torso, shirt); spine.add(torso); hips.add(mesh(G.belly, pants));
  const neck = new THREE.Group(); neck.position.y = 0.66; spine.add(neck);
  const head = mesh(G.head, faceMat(kind === 'runner' ? 'runner' : outfit === 'noah' ? 'child' : 'walker', seed % 5, alive)); head.position.y = 0.1; neck.add(head);
  const eyes = new THREE.Mesh(G.eyes, MAT.eyes); eyes.position.y = 0.1; neck.add(eyes); if (alive) eyes.visible = false;
  const arm = (s) => {
    const up = new THREE.Group(); up.position.set(s * 0.27, 0.56, 0); spine.add(up); up.add(mesh(G.upper, shirt));
    const lo = new THREE.Group(); lo.position.y = -0.32; up.add(lo); lo.add(mesh(G.fore, outfit === 'doctor' || outfit === 'kaur' ? shirt : skin)); lo.add(mesh(G.hand, skin));
    return { up, lo };
  };
  const leg = (s) => {
    const up = new THREE.Group(); up.position.set(s * 0.11, -0.05, 0); hips.add(up); up.add(mesh(G.thigh, pants));
    const lo = new THREE.Group(); lo.position.y = -0.44; up.add(lo); lo.add(mesh(G.shin, pants)); lo.add(mesh(G.foot, MAT.pants[2]));
    return { up, lo };
  };
  const R = { root, hips, spine, neck, head, eyes, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), torso };
  if (kind === 'brute') { // the Growth: lumps on the shoulders and back, one arm swollen
    for (const [x, y, z, s] of [[0.22, 0.6, -0.05, 1.4], [-0.15, 0.5, -0.12, 1.1], [0.05, 0.3, -0.15, 1.3], [0.3, 0.45, 0.05, 0.9], [-0.25, 0.62, 0, 0.8]]) { const l = mesh(G.lump, MAT.lump); l.position.set(x, y, z); l.scale.setScalar(s); spine.add(l); }
    R.armR.up.scale.set(1.7, 1.15, 1.7);
  }
  return R;
}
// the bones bullets are tested against: [name, object, local start, local end, radius]
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function hitParts(R) {
  return [
    ['head', R.neck, V(0, 0.02, 0), V(0, 0.2, 0), 0.15],
    ['torso', R.spine, V(0, 0.0, 0), V(0, 0.55, 0), 0.24],
    ['armL', R.armL.up, V(0, 0, 0), V(0, -0.3, 0), 0.08], ['armL', R.armL.lo, V(0, 0, 0), V(0, -0.36, 0), 0.07],
    ['armR', R.armR.up, V(0, 0, 0), V(0, -0.3, 0), 0.08], ['armR', R.armR.lo, V(0, 0, 0), V(0, -0.36, 0), 0.07],
    ['legL', R.legL.up, V(0, 0, 0), V(0, -0.42, 0), 0.1], ['legL', R.legL.lo, V(0, 0, 0), V(0, -0.44, 0), 0.08],
    ['legR', R.legR.up, V(0, 0, 0), V(0, -0.42, 0), 0.1], ['legR', R.legR.lo, V(0, 0, 0), V(0, -0.44, 0), 0.08],
  ];
}
const KIND = {
  walker: { hp: 100, speed: [0.9, 1.5], dmg: 14, sight: 1, reach: 1.35 },
  runner: { hp: 75, speed: [4.2, 5.0], dmg: 11, sight: 1.3, reach: 1.3 },
  brute: { hp: 650, speed: [1.5, 1.8], dmg: 32, sight: 0.9, reach: 1.8, scale: 1.35 },
  crawler: { hp: 60, speed: [0.6, 0.8], dmg: 10, sight: 0.6, reach: 1.1 },
  child: { hp: 9999, speed: [3, 3], dmg: 0, sight: 1, reach: 0 },
};

// ---------- the flow field ----------
const FW = 176, FH = FW / 2; // cells across (88 m)
const queue = new Int32Array(FW * FW);
// one field per player (everyone in a co-op game is hunted)
const makeField = () => ({ dist: new Int16Array(FW * FW), fi0: 0, fj0: 0, ready: false });
function buildFlow(F, px, pz) {
  const pi = cellOf(px), pj = cellOf(pz); F.fi0 = pi - FH; F.fj0 = pj - FH;
  const dist = F.dist, fi0 = F.fi0, fj0 = F.fj0;
  dist.fill(-1); let qh = 0, qt = 0;
  const start = FH * FW + FH; dist[start] = 0; queue[qt++] = start;
  const nb = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10]];
  while (qh < qt) {
    const c = queue[qh++], ci = c % FW, cj = (c / FW) | 0, d = dist[c];
    for (const [dx, dz] of nb) {
      const ni = ci + dx, nj = cj + dz; if (ni < 0 || nj < 0 || ni >= FW || nj >= FW) continue;
      const n = nj * FW + ni; if (dist[n] >= 0) continue;
      const gi = fi0 + ni, gj = fj0 + nj; if (gi < 0 || gj < 0 || gi >= N || gj >= N || H[gj * N + gi] >= SOLID) { dist[n] = 30000; continue; }
      dist[n] = d + 1; queue[qt++] = n;
    }
  }
  F.ready = true;
}
const FD = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// which way to go from (x, z) to reach the player; null when outside the field or cut off
function flowDir(F, x, z, out) {
  if (!F || !F.ready) return null;
  const dist = F.dist, fi0 = F.fi0, fj0 = F.fj0;
  const li = cellOf(x) - fi0, lj = cellOf(z) - fj0;
  if (li < 1 || lj < 1 || li >= FW - 1 || lj >= FW - 1) return null;
  const here = dist[lj * FW + li]; if (here < 0 || here >= 30000) return null;
  let best = here, bx = 0, bz = 0;
  for (const [dx, dz] of FD) {
    const d = dist[(lj + dz) * FW + li + dx]; if (d < 0 || d >= 30000) continue;
    if (dx && dz) { const a = dist[lj * FW + li + dx], b = dist[(lj + dz) * FW + li]; if (a < 0 || a >= 30000 || b < 0 || b >= 30000) continue; } // no corner cutting
    const dd = d + (dx && dz ? 0.4 : 0);
    if (dd < best) { best = dd; bx = dx; bz = dz; }
  }
  if (!bx && !bz) return null;
  // aim at the centre of that cell
  const tx = (fi0 + li + bx + 0.5) * CELL - HALF, tz = (fj0 + lj + bz + 0.5) * CELL - HALF;
  out.x = tx - x; out.z = tz - z; const l = Math.hypot(out.x, out.z) || 1; out.x /= l; out.z /= l; out.steps = here;
  return out;
}

// ---------- the horde ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Vector3();
export function createZombies(scene, gore, opts) {
  const list = [], corpses = [];
  const noises = [];
  let flowT = 0, seedN = 1;
  const S = { max: 30, killed: 0, spawnT: 0, density: 1, quiet: false, puppet: false, nextNid: 1 };
  const byNid = new Map(), fields = new Map();
  let fieldI = 0;
  const players = () => (opts.players ? opts.players() : [opts.player()]);

  function spawn(kind = 'walker', x, z, o = {}) {
    const K = KIND[kind] || KIND.walker;
    const seed = o.seed ?? (seedN++ * 37 + ((Math.random() * 100) | 0));
    const R = makeRig(kind, seed, o.outfit || null);
    const sc = o.exactScale || (K.scale || 1) * (o.scale || 1) * (0.94 + Math.random() * 0.12);
    R.root.scale.setScalar(sc);
    const y = groundY(x, z);
    R.root.position.set(x, y, z);
    scene.add(R.root);
    const zb = {
      R, kind, K, x, z, y, heading: o.heading ?? Math.random() * 6.28, hp: o.hp ?? K.hp, maxHp: o.hp ?? K.hp,
      speed: (K.speed[0] + Math.random() * (K.speed[1] - K.speed[0])) * (o.speedMul || 1), state: o.state || 'idle', t: 0, phase: Math.random() * 10,
      atk: 0, atkCd: 0, voiceT: 2 + Math.random() * 6, vary: Math.random(), lost: { armL: false, armR: false, legL: false, legR: false, head: false },
      crawl: kind === 'crawler', parts: hitParts(R), target: { x, z }, seen: 0, lastSeen: null, stag: 0, scripted: !!o.scripted, id: o.id || null,
      percT: Math.random() * 0.3, deadT: 0, fall: 0, fallDir: 1, feeding: !!o.feeding, scale: sc, onDeath: o.onDeath || null, noDespawn: !!o.noDespawn,
      dmgPart: {}, outfit: o.outfit || null, wanderT: 0, stuck: 0, lastX: x, lastZ: z, spawnT: 0, sprint: o.sprint || 0, indoor: !!indoorAt(x, z),
    };
    zb.seed = seed; zb.nid = o.nid ?? S.nextNid++; zb.puppet = !!o.puppet; zb.nx = x; zb.nz = z; zb.nh = zb.heading; byNid.set(zb.nid, zb);
    if (zb.crawl) setCrawl(zb, true);
    if (o.state === 'chase') zb.seen = 1;
    if (kind === 'child') { R.eyes.material = new THREE.MeshBasicMaterial({ color: 0xffffff }); }
    list.push(zb);
    return zb;
  }
  function setCrawl(zb, on) {
    zb.crawl = on;
    if (on) { zb.speed = Math.min(zb.speed, 0.7); zb.K = { ...zb.K, reach: 1.1, dmg: Math.round(zb.K.dmg * 0.7) }; }
  }

  // ---------- hitting them ----------
  // nearest body part along a ray; ignore = bodies already passed through (for piercing rounds)
  function raycast(o, d, max = 200, ignore = null) {
    let best = null;
    for (const zb of list) {
      if (zb.state === 'dead' || zb.kind === 'child' || (ignore && ignore.has(zb))) continue;
      const dx = zb.x - o.x, dz = zb.z - o.z, along = dx * d.x + dz * d.z;
      if (along < -1 || along > max + 1) continue;
      const perp = Math.abs(dx * d.z - dz * d.x); if (perp > 1.6 * zb.scale) continue;
      zb.R.root.updateMatrixWorld(true);
      for (const [name, obj, la, lb, r] of zb.parts) {
        if (zb.lost[name]) continue;
        _a.copy(la).applyMatrix4(obj.matrixWorld); _b.copy(lb).applyMatrix4(obj.matrixWorld);
        const t = rayCapsule(o, d, _a, _b, r * zb.scale);
        if (t !== null && t < max && (!best || t < best.t)) best = { zb, part: name, t, point: o.clone().addScaledVector(d, t) };
      }
    }
    return best;
  }
  // what a hit does. part: head/torso/armL/armR/legL/legR. weapon: { dmg, gore (how violent), head (multiplier) }
  function damage(zb, part, dmg, dir, point, w = {}) {
    if (zb.state === 'dead') return false;
    const g = opts.gore();
    if (S.puppet) { // a co-op client: the host decides; show the blood now
      if (g > 0) gore.spray(point, _d.copy(dir).multiplyScalar(0.6).add(_q.set(0, 0.4, 0)), Math.round((8 + dmg * 0.4) * g), 2.5 + g * 2, 0.7);
      A.impact(point, 'flesh');
      opts.sendHit?.(zb.nid, part, dmg, dir, point, w);
      return false;
    }
    const mult = part === 'head' ? (w.head || 3) : part === 'torso' ? 1 : 0.65;
    const dd = dmg * mult;
    zb.hp -= dd; zb.dmgPart[part] = (zb.dmgPart[part] || 0) + dmg;
    // blood
    if (g > 0) {
      const n = Math.round((8 + dd * 0.25) * g);
      gore.spray(point, _d.copy(dir).multiplyScalar(0.6).add(_q.set(0, 0.4, 0)), n, 2.5 + g * 2, 0.7);
      if (g > 0.15 && Math.random() < 0.5 + g * 0.5) gore.splat(_p.set(point.x + dir.x * 0.6, groundY(point.x, point.z) + 0.005, point.z + dir.z * 0.6), 0.25 + Math.random() * 0.4 * g);
      if (g > 0.4) opts.wallSplat?.(point, dir, g);
    }
    A.impact(point, 'flesh');
    // pieces
    // pieces: the more gore, the easier they come off. A killing head shot takes the head at High and up.
    const canCut = g >= 0.35;
    const cutAt = { head: 70, armL: 45, armR: 45, legL: 60, legR: 60 }[part] * (w.cut || 1) * (1.3 - g * 0.6) * (zb.kind === 'brute' ? 3 : 1);
    if (canCut && part !== 'torso' && !zb.lost[part]) {
      const killing = zb.hp <= 0;
      if (part === 'head') {
        if (zb.dmgPart.head >= cutAt || (killing && zb.kind !== 'brute' && Math.random() < (g >= 0.7 ? 1 : 0.35))) { burstHead(zb, dir, g >= 0.7 && (dmg >= 60 || Math.random() < g - 0.35)); zb.hp = 0; }
      } else if (zb.dmgPart[part] >= cutAt || (killing && Math.random() < g * 0.45)) sever(zb, part, dir);
    }
    if (zb.hp <= 0) { kill(zb, dir, part, w); return true; }
    // it felt that
    zb.stag = Math.min(0.5, (zb.stag || 0) + dd / (zb.kind === 'brute' ? 400 : 120));
    if (zb.state !== 'chase') { zb.state = 'chase'; zb.seen = 1; zb.lastSeen = w.from ? { x: w.from.x, z: w.from.z } : { x: zb.x, z: zb.z }; }
    return false;
  }
  function sever(zb, part, dir) {
    zb.lost[part] = true;
    const limb = part === 'armL' ? zb.R.armL.up : part === 'armR' ? zb.R.armR.up : part === 'legL' ? zb.R.legL.up : zb.R.legR.up;
    const parent = limb.parent, at = limb.position.clone();
    gore.loose(limb, _d.copy(dir).multiplyScalar(2 + Math.random() * 2).add(_q.set((Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5))), 10, opts.gore() > 0.2);
    const st = new THREE.Mesh(G.stump, MAT.stump); st.position.copy(at); st.scale.set(1.2, 0.8, 1.2); parent.add(st);
    zb.parts = zb.parts.filter((p) => p[0] !== part);
    zb.bleed = 3;
    A.splat(zb.R.root.position, 0.5);
    if (part === 'legL' || part === 'legR') setCrawl(zb, true);
  }
  function burstHead(zb, dir, explode) {
    zb.lost.head = true; zb.burst = !!explode;
    const head = zb.R.neck;
    head.updateMatrixWorld(true); head.getWorldPosition(_p);
    if (explode) {
      head.visible = false;
      opts.gib?.(_p.clone(), dir, 14);
      gore.spray(_p, _q.set(dir.x, 0.8, dir.z), Math.round(80 * opts.gore()), 5, 1.2);
      A.crunch(_p, 0.9);
    } else {
      gore.loose(head, _d.copy(dir).multiplyScalar(3).add(_q.set(0, 2.5, 0)), 8, true);
      A.splat(_p, 0.7);
    }
    const st = new THREE.Mesh(G.stump, MAT.stump); st.position.set(0, 0.66, 0); zb.R.spine.add(st);
    zb.parts = zb.parts.filter((p) => p[0] !== 'head');
    zb.bleed = 4;
  }
  function kill(zb, dir, part, w = {}) {
    zb.state = 'dead'; zb.deadT = 0; zb.fall = 0;
    // fall away from the shot (or forward, now and then)
    const fwd = Math.sin(zb.heading) * dir.x + Math.cos(zb.heading) * dir.z;
    zb.fallDir = fwd > 0 ? 1 : -1;
    S.killed++;
    A.bodyfall(zb.R.root.position);
    if (zb.kind === 'runner' && Math.random() < 0.3) A.snarl(zb.R.root.position, zb.vary, 0.3);
    opts.onKill?.(zb, part, w);
    zb.onDeath?.(zb);
    if (opts.gore() > 0.3) gore.pool(_p.set(zb.x, groundY(zb.x, zb.z) + 0.005, zb.z), 0.7 + opts.gore() * 0.9, 0.3);
    corpses.push(zb);
    while (corpses.length > 22) removeBody(corpses.shift());
  }
  function removeBody(zb) {
    scene.remove(zb.R.root); byNid.delete(zb.nid);
    const i = list.indexOf(zb); if (i >= 0) list.splice(i, 1);
    const k = corpses.indexOf(zb); if (k >= 0) corpses.splice(k, 1);
  }
  // knife / shove: everything in front of you within reach
  function melee(p, dir, reach = 1.8, dmg = 40) {
    let hit = 0;
    for (const zb of list) {
      if (zb.state === 'dead' || zb.kind === 'child') continue;
      const dx = zb.x - p.x, dz = zb.z - p.z, d = Math.hypot(dx, dz); if (d > reach * (zb.crawl ? 1.2 : 1)) continue;
      if ((dx * dir.x + dz * dir.z) / (d || 1) < 0.5) continue;
      hit++;
      const pt = _p.set(zb.x - dx / d * 0.25, zb.y + (zb.crawl ? 0.3 : 1.3), zb.z - dz / d * 0.25).clone();
      if (!damage(zb, zb.crawl ? 'torso' : 'head', dmg, _d.set(dx / d, 0, dz / d).clone(), pt, { head: 1.5 })) { zb.stag = 0.6; zb.x += dx / d * 0.8; zb.z += dz / d * 0.8; zb.atk = 0; }
    }
    return hit;
  }
  function noise(x, z, r) { noises.push({ x, z, r, t: 0.4 }); }

  // ---------- each frame ----------
  const dirTmp = { x: 0, z: 0 };
  function update(dt, C) {
    if (S.puppet) return puppetUpdate(dt, C);
    const PL = players(), me = PL[0], live = PL.filter((p) => p.alive && !p.downed);
    // the paths: one field per player, rebuilt in turn
    for (const id of [...fields.keys()]) if (!PL.some((p) => p.id === id)) fields.delete(id);
    flowT -= dt; if (flowT <= 0) { flowT = 0.3 / Math.max(1, PL.length); const p = PL[fieldI++ % PL.length]; let F = fields.get(p.id); if (!F) fields.set(p.id, F = makeField()); buildFlow(F, p.x, p.z); }
    for (let i = noises.length - 1; i >= 0; i--) if ((noises[i].t -= dt) <= 0) noises.splice(i, 1);
    if (!S.quiet && live.length) population(dt, C, live[(Math.random() * live.length) | 0], live.length);
    for (let i = list.length - 1; i >= 0; i--) {
      const zb = list[i];
      if (zb.state === 'dead') { deadUpdate(zb, dt); continue; }
      // who it's after: the nearest of you who can still fight (it keeps its target unless someone is much closer)
      let P = null, best = 1e9, near = 1e9;
      for (const p of PL) { const d = Math.hypot(p.x - zb.x, p.z - zb.z); near = Math.min(near, d); if (!p.alive || p.downed) continue; const dd = d * (p.id === zb.tgt ? 0.7 : 1); if (dd < best) { best = dd; P = p; } }
      if (!P) P = me;
      zb.tgt = P.id;
      const dx = P.x - zb.x, dz = P.z - zb.z, dist = Math.hypot(dx, dz);
      // too far from all of you to matter
      if (!zb.noDespawn && !zb.scripted && (near > 130 || (near > 85 && zb.state !== 'chase'))) { removeBody(zb); continue; }
      const mine = Math.hypot(me.x - zb.x, me.z - zb.z);
      zb.R.root.visible = mine < C.far;
      think(zb, dt, P, dist, dx, dz, C);
      move(zb, dt, P, dist, dx, dz);
      animate(zb, dt, mine);
      if (zb.bleed > 0 && opts.gore() > 0.2) { zb.bleed -= dt; if (Math.random() < dt * 10) { zb.R.spine.getWorldPosition(_p); _p.y += 0.6; gore.spray(_p, _q.set(0, 1, 0), 3, 1.5, 0.8); } }
    }
    // keep them apart
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; if (a.state === 'dead') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]; if (b.state === 'dead') continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, r = 0.6 * (a.scale + b.scale) / 2;
        if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2), push = (r - d) / 2 / d; a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push; }
      }
    }
  }
  function population(dt, C, P, nPl = 1) {
    S.spawnT -= dt; if (S.spawnT > 0) return; S.spawnT = 0.8 / nPl;
    const night = C.night, target = Math.round((C.max ?? S.max) * S.density * (0.65 + night * 0.55) * (C.indoors ? 0.5 : 1) * (1 + 0.6 * (nPl - 1)));
    let alive = 0; for (const z of list) if (z.state !== 'dead' && !z.scripted) alive++;
    if (alive >= target) return;
    // somewhere out of sight, on the street, 28-55 m off
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * 6.283, d = 28 + Math.random() * 27, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      if (solid(x, z) || indoorAt(x, z) || Math.abs(x) > 200 || Math.abs(z) > 200) continue;
      const facing = Math.cos(a) * P.lookDir.x + Math.sin(a) * P.lookDir.z;
      if (facing > 0.35 && clearLine(P.x, 1.6, P.z, x, 1.6, z) && d < 45) continue;
      const roll = Math.random(), runner = roll < night * 0.32 + C.chapter * 0.015, brute = !runner && C.chapter >= 3 && roll > 0.97 - night * 0.02;
      const zb = spawn(runner ? 'runner' : brute ? 'brute' : 'walker', x, z, { state: Math.random() < 0.25 ? 'wander' : 'idle', feeding: Math.random() < 0.15 });
      if (night > 0.5 && Math.random() < 0.3) { zb.state = 'alert'; zb.target = { x: P.x + (Math.random() - 0.5) * 20, z: P.z + (Math.random() - 0.5) * 20 }; }
      void onStreet;
      return;
    }
  }
  function think(zb, dt, P, dist, dx, dz, C) {
    zb.t += dt; zb.atkCd -= dt; zb.stag = Math.max(0, (zb.stag || 0) - dt);
    if (zb.kind === 'child') return;
    // perception
    if ((zb.percT -= dt) <= 0) {
      zb.percT = 0.2 + Math.random() * 0.1;
      const range = (C.night > 0.5 ? (P.lit ? 30 : 15) : 34) * zb.K.sight * (C.indoors && !zb.indoor ? 0.3 : 1) * (zb.feeding ? 0.5 : 1);
      const fwd = (Math.sin(zb.heading) * dx + Math.cos(zb.heading) * dz) / (dist || 1);
      if (dist < range && (fwd > -0.2 || dist < 4) && P.alive && !P.downed && clearLine(zb.x, 1.6, zb.z, P.x, 1.5, P.z)) {
        if (zb.state !== 'chase' && zb.state !== 'attack') { zb.feeding = false; if (zb.kind === 'runner') A.shriek(zb.R.root.position); else A.groan(zb.R.root.position, zb.vary, 0.5, 0, 0.8); opts.onSpot?.(zb); }
        zb.state = zb.state === 'attack' ? 'attack' : 'chase'; zb.seen = 1; zb.lastSeen = { x: P.x, z: P.z };
      } else if (zb.state === 'chase') {
        zb.seen -= 0.2 / (zb.kind === 'runner' ? 8 : 5);
        if (zb.seen <= 0) { zb.state = 'alert'; zb.target = zb.lastSeen || { x: P.x, z: P.z }; }
      }
      if (zb.state !== 'chase' && zb.state !== 'attack') for (const n of noises) if (Math.hypot(n.x - zb.x, n.z - zb.z) < n.r) { zb.state = 'alert'; zb.feeding = false; zb.target = { x: n.x + (Math.random() - 0.5) * 6, z: n.z + (Math.random() - 0.5) * 6 }; break; }
    }
    if (zb.state === 'chase' && dist < zb.K.reach * zb.scale && zb.atkCd <= 0 && !zb.stag) { zb.state = 'attack'; zb.atk = 0; }
    if (zb.state === 'attack') {
      zb.atk += dt;
      if (zb.atk > 0.45 && !zb.struck) {
        zb.struck = true;
        if (dist < (zb.K.reach + 0.45) * zb.scale && P.alive && !P.downed) opts.onAttack?.(zb, zb.K.dmg, P);
        else A.snarl(zb.R.root.position, zb.vary, 0.3);
      }
      if (zb.atk > 0.9) { zb.state = 'chase'; zb.atkCd = 0.5 + Math.random() * 0.4; zb.struck = false; }
    }
    if (zb.state === 'wander' && (zb.wanderT -= dt) <= 0) { zb.wanderT = 4 + Math.random() * 6; const a = Math.random() * 6.28; zb.target = { x: zb.x + Math.cos(a) * 8, z: zb.z + Math.sin(a) * 8 }; }
    if ((zb.voiceT -= dt) <= 0) {
      zb.voiceT = (zb.state === 'chase' ? 1.5 : 4) + Math.random() * 5;
      if (dist < 40) { if (zb.state === 'chase' && zb.kind === 'runner') A.snarl(zb.R.root.position, zb.vary, 0.4); else A.groan(zb.R.root.position, zb.vary, zb.state === 'chase' ? 0.42 : 0.28, 0, zb.kind === 'brute' ? 1.8 : 1.2); }
    }
  }
  function move(zb, dt, P, dist, dx, dz) {
    if (zb.kind === 'child') return;
    let mx = 0, mz = 0, sp = 0;
    if (zb.state === 'chase' || zb.state === 'attack') {
      const close = dist < 2.5 && clearLine(zb.x, 1.0, zb.z, P.x, 1.0, P.z);
      const f = close ? null : flowDir(fields.get(P.id), zb.x, zb.z, dirTmp);
      if (f) { mx = f.x; mz = f.z; } else { mx = dx / (dist || 1); mz = dz / (dist || 1); }
      sp = zb.state === 'attack' ? 0.15 : zb.speed * (zb.sprint ? 1.25 : 1);
      if (dist < 0.9) sp = 0;
    } else if (zb.state === 'alert' || zb.state === 'wander') {
      const tx = zb.target.x - zb.x, tz = zb.target.z - zb.z, d = Math.hypot(tx, tz);
      if (d < 1) { zb.state = zb.state === 'alert' ? 'wander' : 'wander'; zb.wanderT = 2 + Math.random() * 4; if (zb.state === 'wander' && Math.random() < 0.4) zb.state = 'idle'; }
      else { mx = tx / d; mz = tz / d; sp = zb.state === 'alert' ? Math.min(zb.speed, 1.6) : 0.55; }
    } else if (zb.state === 'idle' && Math.random() < dt * 0.05) { zb.state = 'wander'; zb.wanderT = 0; }
    if (zb.stag) sp *= 0.2;
    if (zb.crawl) sp = Math.min(sp, 0.75);
    if (sp > 0) {
      const want = Math.atan2(mx, mz); let dh = want - zb.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      zb.heading += Math.max(-1, Math.min(1, dh)) * Math.min(1, dt * (zb.kind === 'runner' ? 9 : 5));
      const k = Math.max(0, Math.cos(dh));
      zb.x += Math.sin(zb.heading) * sp * dt * (0.3 + k * 0.7); zb.z += Math.cos(zb.heading) * sp * dt * (0.3 + k * 0.7);
    } else if (zb.state === 'chase' || zb.state === 'attack') {
      const want = Math.atan2(dx, dz); let dh = want - zb.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); zb.heading += dh * Math.min(1, dt * 6);
    }
    const p = { x: zb.x, z: zb.z }; collide(p, 0.3 * zb.scale); zb.x = p.x; zb.z = p.z;
    // stuck against something while chasing: slide sideways for a moment
    zb.stuck = Math.hypot(zb.x - zb.lastX, zb.z - zb.lastZ) < sp * dt * 0.2 && sp > 0.3 ? zb.stuck + dt : 0;
    if (zb.stuck > 0.6) { zb.heading += (Math.random() < 0.5 ? 1 : -1) * 1.2; zb.stuck = 0; }
    zb.lastX = zb.x; zb.lastZ = zb.z;
    zb.y += (groundY(zb.x, zb.z) - zb.y) * Math.min(1, dt * 12);
    zb.moving = sp;
  }
  function animate(zb, dt, dist) {
    const R = zb.R; R.root.position.set(zb.x, zb.y, zb.z); R.root.rotation.y = zb.heading;
    const cs = dist < 26; if (zb.cs !== cs) { zb.cs = cs; R.root.traverse((o) => { if (o.isMesh) o.castShadow = cs; }); } // only the near ones cast shadows
    if (dist > 60) return;
    const sp = zb.moving || 0, run = zb.kind === 'runner' && sp > 2;
    zb.phase += dt * (run ? 11 : 2.2 + sp * 2.6);
    const s = Math.sin(zb.phase), c = Math.cos(zb.phase);
    if (zb.kind === 'child') {
      R.hips.position.y = 0.95; R.spine.rotation.x = 0.1; R.neck.rotation.set(0.35, 0, 0.25);
      R.armL.up.rotation.set(0, 0, 0.05); R.armR.up.rotation.set(0, 0, -0.05); R.legL.up.rotation.x = 0; R.legR.up.rotation.x = 0;
      return;
    }
    if (zb.crawl) {
      R.hips.position.y = 0.22; R.hips.rotation.x = 1.45; R.spine.rotation.x = 0.1; R.neck.rotation.x = -1.1;
      R.armL.up.rotation.set(-2.6 + s * 0.5, 0, 0.2); R.armR.up.rotation.set(-2.6 - s * 0.5, 0, -0.2);
      R.armL.lo.rotation.x = -0.4 - Math.max(0, c) * 0.6; R.armR.lo.rotation.x = -0.4 - Math.max(0, -c) * 0.6;
      R.legL.up.rotation.x = 0.1 + s * 0.15; R.legR.up.rotation.x = 0.1 - s * 0.15; R.legL.lo.rotation.x = 0.3; R.legR.lo.rotation.x = 0.3;
      return;
    }
    if (zb.feeding && zb.state === 'idle') { // kneeling over something in the road
      R.hips.position.y = 0.5; R.hips.rotation.x = 0.2; R.spine.rotation.x = 0.9; R.neck.rotation.x = 0.4 + Math.sin(zb.t * 7) * 0.15;
      R.legL.up.rotation.x = -1.5; R.legL.lo.rotation.x = 2.2; R.legR.up.rotation.x = -0.4; R.legR.lo.rotation.x = 1.9;
      R.armL.up.rotation.set(-0.9 + Math.sin(zb.t * 5) * 0.2, 0, 0.2); R.armR.up.rotation.set(-1.0 + Math.cos(zb.t * 6) * 0.2, 0, -0.2); R.armL.lo.rotation.x = -0.8; R.armR.lo.rotation.x = -0.8;
      return;
    }
    R.hips.rotation.x = 0;
    const amp = Math.min(1, sp / 1.4);
    R.hips.position.y = 0.95 - Math.abs(c) * 0.04 * amp - (run ? 0.06 : 0);
    R.hips.rotation.z = Math.sin(zb.phase * 0.5) * 0.06;
    R.spine.rotation.x = (run ? 0.45 : 0.18) + (zb.stag ? -zb.stag * 0.9 : 0);
    R.spine.rotation.z = Math.sin(zb.phase * 0.5 + 1) * 0.08;
    R.neck.rotation.set(-0.15 + Math.sin(zb.t * 0.7) * 0.1, Math.sin(zb.t * 0.4 + zb.vary * 5) * 0.25, (zb.vary - 0.5) * 0.6);
    R.legL.up.rotation.x = s * (run ? 1.0 : 0.5) * amp; R.legR.up.rotation.x = -s * (run ? 1.0 : 0.5) * amp;
    R.legL.lo.rotation.x = Math.max(0, -c) * (run ? 1.4 : 0.7) * amp; R.legR.lo.rotation.x = Math.max(0, c) * (run ? 1.4 : 0.7) * amp;
    if (zb.state === 'attack') {
      const k = Math.min(1, zb.atk / 0.45), swing = zb.atk > 0.45 ? Math.min(1, (zb.atk - 0.45) / 0.15) : 0;
      R.armL.up.rotation.set(-1.4 - k * 1.0 + swing * 1.4, 0, 0.3); R.armR.up.rotation.set(-1.4 - k * 1.0 + swing * 1.4, 0, -0.3);
      R.armL.lo.rotation.x = -0.3; R.armR.lo.rotation.x = -0.3; R.spine.rotation.x = 0.1 + swing * 0.5;
    } else if (run) {
      R.armL.up.rotation.set(-s * 1.2 - 0.4, 0, 0.35); R.armR.up.rotation.set(s * 1.2 - 0.4, 0, -0.35); R.armL.lo.rotation.x = -1.2; R.armR.lo.rotation.x = -1.2;
    } else {
      const reach = zb.state === 'chase' ? 1.35 : 0.25 + zb.vary * 0.5;
      R.armL.up.rotation.set(-reach + s * 0.12, 0, 0.12 + c * 0.05); R.armR.up.rotation.set(-reach * (0.8 + zb.vary * 0.3) - s * 0.12, 0, -0.12);
      R.armL.lo.rotation.x = -0.2 - zb.vary * 0.3; R.armR.lo.rotation.x = -0.15;
    }
  }
  function deadUpdate(zb, dt) {
    zb.deadT += dt;
    const R = zb.R;
    if (zb.fall < 1) {
      zb.fall = Math.min(1, zb.fall + dt * 2.4);
      const k = zb.fall * zb.fall;
      if (zb.crawl) { R.hips.position.y = 0.16; }
      else {
        R.hips.position.y = 0.95 - k * 0.78; R.hips.rotation.x = zb.fallDir * k * 1.5; R.spine.rotation.x = zb.fallDir * 0.1;
        R.armL.up.rotation.set(-k * 2.6 * (zb.fallDir > 0 ? 0.4 : 1), 0, 0.3 + k * 0.6); R.armR.up.rotation.set(-k * 1.2, 0, -0.4 - k * 0.8);
        R.legL.up.rotation.x = -k * 0.3; R.legR.up.rotation.x = k * 0.2; R.legL.lo.rotation.x = k * 0.4;
      }
      R.root.position.set(zb.x, zb.y, zb.z);
    }
    const g = opts.gore();
    const keep = g <= 0.01 ? 1.5 : 20 + g * 60;
    if (zb.deadT > keep) { R.root.position.y -= dt * 0.25; if (zb.deadT > keep + 3) removeBody(zb); }
    if (zb.bleed > 0 && g > 0.2) { zb.bleed -= dt; if (Math.random() < dt * 6) { R.spine.getWorldPosition(_p); gore.spray(_p, _q.set(0, 0.6, 0), 2, 1.2, 1); } }
  }
  // a body already lying there when you arrive (dressing for a scene)
  function corpse(x, z, heading = Math.random() * 6.28, outfit = null, o = {}) {
    const zb = spawn('walker', x, z, { outfit, heading, noDespawn: true, scripted: true });
    zb.state = 'dead'; zb.fall = 0.999; zb.deadT = -1e9; zb.fallDir = o.face ? 1 : -1;
    zb.R.eyes.visible = false;
    deadUpdate(zb, 0.01);
    if (o.missing) for (const m of o.missing) { if (m === 'head') { zb.R.neck.visible = false; const st = new THREE.Mesh(G.stump, MAT.stump); st.position.set(0, 0.66, 0); zb.R.spine.add(st); } else { const l = zb.R[m].up; l.visible = false; const st = new THREE.Mesh(G.stump, MAT.stump); st.position.copy(l.position); l.parent.add(st); } }
    if (opts.gore() > 0.2) gore.pool(_p.set(x, groundY(x, z) + 0.005, z), 0.6 + opts.gore(), 0);
    zb.decor = true;
    return zb;
  }
  function clear() { for (const zb of [...list]) removeBody(zb); corpses.length = 0; }

  // ---------- co-op: the host sends what they're doing; everyone else draws puppets ----------
  const KINDS = ['walker', 'runner', 'brute', 'crawler', 'child'], OUTF = [null, 'patient', 'doctor', 'cop', 'soldier', 'guard', 'mara', 'noah', 'kaur', 'gus'], STATES = ['idle', 'wander', 'alert', 'chase', 'attack', 'dead'];
  const PARTS = ['armL', 'armR', 'legL', 'legR', 'head'];
  const NF = 12;
  function snapshot(near) {
    const out = [];
    for (const zb of list) {
      if (zb.kind === 'child' || zb.decor || zb.puppet) continue;
      if (near && !near(zb)) continue;
      let lb = 0; PARTS.forEach((p, i) => { if (zb.lost[p]) lb |= 1 << i; }); if (zb.burst) lb |= 32;
      out.push(zb.nid, KINDS.indexOf(zb.kind), zb.seed, Math.max(0, OUTF.indexOf(zb.outfit)), Math.round(zb.x * 20), Math.round(zb.z * 20), Math.round(zb.heading * 100),
        STATES.indexOf(zb.state), (zb.fallDir > 0 ? 1 : 0) | (zb.feeding ? 2 : 0) | (zb.crawl ? 4 : 0), lb, Math.round((zb.atk || 0) * 100), Math.round(zb.scale * 100));
    }
    return out;
  }
  function applySnapshot(arr) {
    const seen = new Set(), g = opts.gore();
    for (let i = 0; i + NF <= arr.length; i += NF) {
      const nid = arr[i]; seen.add(nid);
      const x = arr[i + 4] / 20, z = arr[i + 5] / 20, h = arr[i + 6] / 100, st = STATES[arr[i + 7]] || 'idle', fl = arr[i + 8], lb = arr[i + 9];
      let zb = byNid.get(nid);
      if (!zb) {
        if (st === 'dead') continue; // died before we saw it
        zb = spawn(KINDS[arr[i + 1]] || 'walker', x, z, { seed: arr[i + 2], outfit: OUTF[arr[i + 3]], nid, heading: h, exactScale: arr[i + 11] / 100, puppet: true });
      }
      zb.nx = x; zb.nz = z; zb.nh = h; zb.atk = arr[i + 10] / 100; zb.feeding = !!(fl & 2);
      if ((fl & 4) && !zb.crawl) setCrawl(zb, true);
      const dir = new THREE.Vector3(Math.sin(h + Math.PI), 0, Math.cos(h + Math.PI));
      if (g >= 0.35) PARTS.forEach((p, k) => { if ((lb & (1 << k)) && !zb.lost[p]) { if (p === 'head') burstHead(zb, dir, !!(lb & 32) && g >= 0.7); else sever(zb, p, dir); } });
      if (st === 'dead' && zb.state !== 'dead') {
        zb.state = 'dead'; zb.deadT = 0; zb.fall = 0; zb.fallDir = fl & 1 ? 1 : -1; zb.x = x; zb.z = z;
        A.bodyfall(zb.R.root.position); if (g > 0.3) gore.pool(_p.set(x, groundY(x, z) + 0.005, z), 0.7 + g * 0.9, 0.3);
        corpses.push(zb); while (corpses.length > 26) removeBody(corpses.shift());
      } else if (st !== 'dead') zb.state = st;
    }
    for (const zb of [...list]) if (zb.puppet && !seen.has(zb.nid) && zb.state !== 'dead') removeBody(zb);
  }
  function puppetUpdate(dt, C) {
    const me = players()[0];
    for (let i = list.length - 1; i >= 0; i--) {
      const zb = list[i];
      if (zb.state === 'dead') { deadUpdate(zb, dt); continue; }
      const mine = Math.hypot(me.x - zb.x, me.z - zb.z);
      if (zb.puppet) {
        const k = Math.min(1, dt * 10), ox = zb.x, oz = zb.z;
        zb.x += (zb.nx - zb.x) * k; zb.z += (zb.nz - zb.z) * k;
        if (Math.hypot(zb.nx - zb.x, zb.nz - zb.z) > 6) { zb.x = zb.nx; zb.z = zb.nz; }
        let dh = zb.nh - zb.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); zb.heading += dh * k;
        zb.moving = Math.hypot(zb.x - ox, zb.z - oz) / Math.max(dt, 1e-3);
        zb.y += (groundY(zb.x, zb.z) - zb.y) * Math.min(1, dt * 12); zb.t += dt;
        if ((zb.voiceT -= dt) <= 0) { zb.voiceT = (zb.state === 'chase' ? 1.5 : 4) + Math.random() * 5; if (mine < 40) A.groan(zb.R.root.position, zb.vary, zb.state === 'chase' ? 0.42 : 0.28, 0, zb.kind === 'brute' ? 1.8 : 1.2); }
      }
      zb.R.root.visible = mine < C.far;
      animate(zb, dt, mine);
      if (zb.bleed > 0 && opts.gore() > 0.2) { zb.bleed -= dt; if (Math.random() < dt * 10) { zb.R.spine.getWorldPosition(_p); _p.y += 0.6; gore.spray(_p, _q.set(0, 1, 0), 3, 1.5, 0.8); } }
    }
  }
  const getByNid = (n) => byNid.get(n);

  function setEyes(night) { MAT.eyes && MAT.eyes.color.setScalar(0.35 + night * 0.65); }
  return { list, spawn, raycast, damage, melee, noise, update, clear, corpse, removeBody, setEyes, setCrawl, S, snapshot, applySnapshot, getByNid };
}

// closest approach of a ray (o + t d, |d| = 1) to the capsule a-b of radius r: the t where it enters, or null
function rayCapsule(o, d, a, b, r) {
  const ab = _q.subVectors(b, a), ao = _p.subVectors(o, a);
  const ab2 = ab.dot(ab), abd = ab.dot(d), abo = ab.dot(ao), dd = d.dot(ao);
  const den = ab2 - abd * abd;
  let s = den > 1e-8 ? (abd * dd * -1 + abo) / den : 0; // param on the segment (unclamped)
  // solve properly: minimise |o + t d - (a + s ab)|
  let t;
  if (den > 1e-8) { s = (abo - abd * dd) / den; s = Math.max(0, Math.min(1, s)); }
  else s = 0;
  // best t for that s
  const px = a.x + ab.x * s, py = a.y + ab.y * s, pz = a.z + ab.z * s;
  t = (px - o.x) * d.x + (py - o.y) * d.y + (pz - o.z) * d.z;
  if (t < 0) return null;
  const cx = o.x + d.x * t - px, cy = o.y + d.y * t - py, cz = o.z + d.z * t - pz, d2 = cx * cx + cy * cy + cz * cz;
  if (d2 > r * r) return null;
  return Math.max(0, t - Math.sqrt(r * r - d2));
}
