// The Mass: what the trial ward became. Every REM-7 patient who came back to Halcyon, grown together into one
// thing that fills the cold storage. Noah is in the middle of it. It doesn't walk. It reaches.
//   - four glowing tumours keep it alive: shoot them
//   - its arms rear up, then slam where you were standing
//   - it births the dead from its sides
//   - when the tumours are gone it opens, and you see him
import * as THREE from 'three';
import * as TX from './tex.js';
import * as A from './audio.js';
import { fill, clearRect, W } from './city.js';
import { makeRig } from './zombies.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
export function createMass(scene, gore, opts) {
  const C = W.marks.mass, root = new THREE.Group(); root.position.set(C.x, 0.15, C.z); scene.add(root);
  const skin = new THREE.MeshStandardMaterial({ map: TX.deadSkin('mass', 0x8a5a50, 99, 1), roughness: 0.35, metalness: 0.05, emissive: 0x300404, emissiveIntensity: 0.4 });
  // the body: a lumpy blob, squashed
  const geo = new THREE.IcosahedronGeometry(3, 4), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i); const n = Math.sin(_v.x * 1.7) * Math.cos(_v.z * 1.9) * 0.35 + Math.sin(_v.y * 3.1 + _v.x) * 0.2 + Math.sin(_v.z * 5 + _v.y * 4) * 0.08; _v.multiplyScalar(1 + n / 3); pos.setXYZ(i, _v.x, _v.y, _v.z); }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, skin); body.scale.set(1.15, 0.7, 0.85); body.position.y = 1.4; body.castShadow = true; root.add(body);
  // faces in it: rigs half sunk into the flesh
  const sunk = [];
  for (let k = 0; k < 5; k++) {
    const r = makeRig('walker', 300 + k * 17, k % 2 ? 'patient' : 'doctor'); const a = k / 5 * Math.PI * 2 + 0.4;
    r.root.position.set(Math.cos(a) * 2.6, 0.2 + (k % 2) * 0.5, Math.sin(a) * 1.9); r.root.rotation.set(0.6 * Math.sin(a), -a + Math.PI / 2, 0.4 * Math.cos(a));
    r.armL.up.rotation.x = -2.4; r.armR.up.rotation.x = -2.0 - k * 0.2; root.add(r.root); sunk.push(r);
  }
  // Noah, at the top
  const noah = makeRig('child', 7, 'noah'); noah.root.scale.setScalar(0.65); noah.root.position.set(0, 2.2, 0.3); root.add(noah.root);
  noah.armL.up.rotation.set(-0.3, 0, 0.9); noah.armR.up.rotation.set(-0.3, 0, -0.9); noah.neck.rotation.x = 0.5;
  // the shell over him, until the tumours are gone
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 2), skin); shell.position.set(0, 2.85, 0.3); shell.scale.set(1, 0.9, 0.8); root.add(shell);
  // tumours
  const tumMat = new THREE.MeshStandardMaterial({ color: 0xc84a2a, emissive: 0xff5a20, emissiveIntensity: 1.4, roughness: 0.3 });
  const tums = [[2.4, 1.6, 1.3], [-2.5, 1.4, 1.0], [1.2, 2.2, -1.5], [-1.4, 2.0, 1.7]].map(([x, y, z]) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), tumMat.clone()); m.position.set(x, y, z); root.add(m); return { m, hp: 360, dead: false, r: 0.62 }; });
  const glow = new THREE.PointLight(0xff4a20, 6, 14, 2); glow.position.set(0, 2.5, 1.5); root.add(glow);
  // arms: chains of segments
  const segGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.7, 8); segGeo.translate(0, 0.35, 0);
  const arms = [0.6, 2.6, 4.4].map((a) => {
    const base = new THREE.Group(); base.position.set(Math.cos(a) * 2.3, 1.2, Math.sin(a) * 1.7); root.add(base);
    const segs = []; let parent = base;
    for (let i = 0; i < 9; i++) { const s = new THREE.Group(); s.position.y = i ? 0.7 : 0; const m = new THREE.Mesh(segGeo, skin); m.scale.setScalar(1 - i * 0.08); m.castShadow = true; s.add(m); parent.add(s); segs.push(s); parent = s; }
    return { base, segs, a, state: 'idle', t: Math.random() * 3, cd: 2 + Math.random() * 3, aim: new THREE.Vector3(), phase: Math.random() * 6 };
  });
  fill(C.x - 3.2, C.z - 2.4, C.x + 3.2, C.z + 2.4, 3.5, 4);
  const S = { core: 600, open: false, dead: false, spawnT: 6, hurt: 0, beat: 0, children: [] };

  function hitSphere(o, d, c, r, max) {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
    if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0 && t < max ? t : null;
  }
  // a bullet: tumours first, then Noah (when open), then the body soaks it up
  function raycast(o, d, max) {
    if (S.dead) return null;
    root.updateMatrixWorld(true);
    _w.set(C.x, 1.45, C.z); const tb = hitSphere(o, d, _w, 2.4, max);
    let best = null;
    // the tumours and Noah sit in the flesh: they win if they're about as near as the body is
    for (const T of tums) { if (T.dead) continue; T.m.getWorldPosition(_v); const t = hitSphere(o, d, _v, T.r, max); if (t !== null && (tb === null || t < tb + 0.8) && (!best || t < best.t)) best = { t, kind: 'tum', T }; }
    if (S.open) { noah.spine.getWorldPosition(_v); _v.y += 0.15; const t = hitSphere(o, d, _v, 0.45, max); if (t !== null && (tb === null || t < tb + 3.2) && (!best || t < best.t)) best = { t, kind: 'core' }; }
    if (!best && tb !== null) best = { t: tb, kind: 'body' };
    if (!best) return null;
    const point = o.clone().addScaledVector(d, best.t);
    return { t: best.t, point, hit: (dmg, dir) => hit(best, dmg, dir, point) };
  }
  function hit(b, dmg, dir, point) {
    const g = opts.gore();
    if (g > 0) gore.spray(point, _v.set(-dir.x, 0.5, -dir.z), Math.round(6 + 14 * g), 2.5, 0.8);
    A.impact(point, 'flesh');
    if (b.kind === 'tum') {
      b.T.hp -= dmg; b.T.m.material.emissiveIntensity = 4; S.hurt = 0.15;
      if (b.T.hp <= 0 && !b.T.dead) {
        b.T.dead = true; b.T.m.visible = false; A.crunch(point, 1); A.roar(point, 0.8); opts.shake?.(0.6);
        if (g > 0) { gore.spray(point, _v.set(0, 1, 0), Math.round(90 * g), 5, 1.4); opts.gib?.(point, dir, 10); }
        opts.onTumour?.(tums.filter((t) => !t.dead).length);
        if (tums.every((t) => t.dead)) openUp();
      }
      return { part: 'tum' };
    }
    if (b.kind === 'core') {
      S.core -= dmg * 1.5; S.hurt = 0.15;
      if (S.core <= 0) die(point, dir);
      return { part: 'core' };
    }
    return { part: 'body' };
  }
  function openUp() {
    S.open = true; shell.visible = false; A.roar(root.position, 1); opts.shake?.(1);
    if (opts.gore() > 0) gore.spray(_v.set(C.x, 3, C.z + 0.3), _w.set(0, 1, 0), Math.round(120 * opts.gore()), 4, 1.5);
    opts.onOpen?.();
  }
  function die(point, dir) {
    S.dead = true; A.roar(root.position, 1); A.crunch(point, 1); opts.shake?.(1.2);
    if (opts.gore() > 0.5) opts.gib?.(point, dir, 20);
    glow.intensity = 0; for (const T of tums) T.m.visible = false;
    noah.neck.rotation.x = 1.1; noah.armL.up.rotation.set(0.2, 0, 0.2); noah.armR.up.rotation.set(0.2, 0, -0.2);
    for (const a of arms) a.state = 'dying';
    opts.onDefeat?.();
  }

  function update(dt) {
    const P = opts.player();
    S.beat += dt * (S.open ? 2.4 : 1.4);
    const pulse = 1 + Math.max(0, Math.sin(S.beat * Math.PI * 2)) * (S.dead ? 0 : 0.04);
    body.scale.set(1.15 * pulse, 0.7 * (2 - pulse), 0.85 * pulse);
    if (!S.dead && Math.sin(S.beat * Math.PI * 2) > 0.98 && !S.thumped) { S.thumped = true; A.heartbeat(1, 60, 0.5); } else if (Math.sin(S.beat * Math.PI * 2) < 0.5) S.thumped = false;
    if (S.hurt > 0) { S.hurt -= dt; } for (const T of tums) if (!T.dead) T.m.material.emissiveIntensity += (1.4 + Math.sin(S.beat * 6) * 0.3 - T.m.material.emissiveIntensity) * Math.min(1, dt * 8);
    glow.intensity = S.dead ? 0 : 5 + Math.sin(S.beat * 6) * 1.5;
    if (S.open && !S.dead) { noah.neck.rotation.x = 0.2 + Math.sin(S.beat) * 0.1; noah.neck.rotation.y = Math.atan2(P.x - C.x, P.z - C.z) * 0.6; }
    for (const r of sunk) { r.neck.rotation.z = Math.sin(S.beat * 2 + r.root.position.x) * 0.3; r.armR.up.rotation.x = -2.0 + Math.sin(S.beat * 3 + r.root.position.z) * 0.4; }
    // arms
    for (const a of arms) {
      a.t += dt; a.cd -= dt; a.phase += dt;
      const toP = _v.set(P.x - (C.x + a.base.position.x), 0, P.z - (C.z + a.base.position.z)), dist = toP.length();
      if (a.state === 'dying') { a.segs.forEach((s) => { s.rotation.x += (0.25 - s.rotation.x) * dt * 2; }); continue; }
      if (a.state === 'idle') {
        a.segs.forEach((s, i) => { s.rotation.x = Math.sin(a.phase * 1.3 + i * 0.6) * 0.18 + 0.1; s.rotation.z = Math.cos(a.phase + i * 0.5) * 0.15; });
        a.base.rotation.y = -a.a + Math.PI / 2;
        if (a.cd <= 0 && dist < 9 && P.alive) { a.state = 'rear'; a.t = 0; a.aim.set(P.x, 0, P.z); A.groan(_w.set(C.x, 2, C.z), 0.1, 0.6, 0, 0.9); }
      } else if (a.state === 'rear') { // rising up, swaying towards you: the tell
        const k = Math.min(1, a.t / 0.9);
        a.base.rotation.y += (Math.atan2(a.aim.x - (C.x + a.base.position.x), a.aim.z - (C.z + a.base.position.z)) - a.base.rotation.y) * Math.min(1, dt * 6);
        a.segs.forEach((s, i) => { s.rotation.x = -0.05 * k * (i < 3 ? 2 : -1) - (i > 5 ? 0.3 * k : 0); s.rotation.z = 0; });
        a.aim.lerp(_w.set(P.x, 0, P.z), dt * 1.5);
        if (a.t > 0.9) { a.state = 'slam'; a.t = 0; }
      } else if (a.state === 'slam') {
        const k = Math.min(1, a.t / 0.18);
        a.segs.forEach((s, i) => { s.rotation.x = k * (i < 2 ? 0.55 : 0.18); });
        if (a.t >= 0.18 && !a.hit) {
          a.hit = true; A.thud(a.aim, 1, 0, 45); opts.shake?.(0.5);
          const reach = Math.hypot(a.aim.x - (C.x + a.base.position.x), a.aim.z - (C.z + a.base.position.z));
          const pd = Math.hypot(P.x - a.aim.x, P.z - a.aim.z);
          if (pd < 1.6 && reach < 8.5) opts.onAttack?.(30);
          if (opts.gore() > 0.3) gore.splat(_w.set(a.aim.x, 0.17, a.aim.z), 0.8);
        }
        if (a.t > 0.9) { a.state = 'idle'; a.hit = false; a.cd = 1.6 + Math.random() * 2.2 - (S.open ? 0.8 : 0); }
      }
    }
    // the dead it births
    if (!S.dead && (S.spawnT -= dt) <= 0) {
      S.spawnT = S.open ? 5 : 8;
      S.children = S.children.filter((z) => z.state !== 'dead');
      if (S.children.length < 5) {
        const a = Math.random() * Math.PI * 2, x = C.x + Math.cos(a) * 4, z = C.z + Math.sin(a) * 3.2;
        const zb = opts.spawn(Math.random() < 0.4 ? 'crawler' : Math.random() < 0.3 ? 'runner' : 'walker', x, Math.min(130, Math.max(117.5, z)), { outfit: 'patient', scripted: true, state: 'chase' });
        if (zb) S.children.push(zb);
        if (opts.gore() > 0) gore.spray(_w.set(x, 1, z), _v.set(0, 1, 0), Math.round(30 * opts.gore()), 2, 1);
        A.splat(_w, 0.6);
      }
    }
  }
  function remove() { scene.remove(root); clearRect(C.x - 3.2, C.z - 2.4, C.x + 3.2, C.z + 2.4); }
  function finishDead() { S.dead = true; S.open = true; shell.visible = false; glow.intensity = 0; for (const T of tums) { T.dead = true; T.m.visible = false; } for (const a of arms) a.state = 'dying'; noah.neck.rotation.x = 1.1; }
  return { S, root, raycast, update, remove, finishDead, tums };
}
