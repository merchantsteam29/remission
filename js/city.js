// The city: a 7 x 7 grid of blocks with streets between, walled in by the army's quarantine barrier.
// Most blocks are towers you can't enter. Five places you can: Halcyon Biotech (where it started), the 9th
// Precinct, St. Agnes Hospital, your apartment building, and a few corner shops. The park in the middle,
// the army checkpoint on Bell Street.
//
// Everything solid is also written into one height grid (0.5 m cells). Walking, the zombies' paths, bullets
// and lines of sight all read that grid, so what you see is what stops you.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './tex.js';

export const CELL = 0.5, HALF = 212, N = Math.round((HALF * 2) / CELL);
export const H = new Uint8Array(N * N);   // solid height in 0.1 m (0 = open ground)
export const MAT = new Uint8Array(N * N); // 0 stone, 1 metal, 2 glass, 3 wood, 4 flesh-ish (the growth)
export const PITCH = 56, ST = 12, NB = 7, EDGE = 196; // block pitch, street width, blocks per side, first street at -EDGE
export const SX = Array.from({ length: NB + 1 }, (_, k) => -EDGE + k * PITCH); // street centre lines
export const blockMin = (i) => SX[i] + ST / 2, blockMax = (i) => SX[i + 1] - ST / 2;
const ci = (x) => Math.floor((x + HALF) / CELL);
export const cellOf = ci;
export const cellX = (i) => (i + 0.5) * CELL - HALF;
export const SOLID = 5; // 0.5 m and up blocks walking

export const W = {
  interiors: [], // { x0, z0, x1, z1, name, ceil }
  fixtures: [],  // lights: { x, y, z, color, power, dist, kind: 'lamp'|'ceil'|'fire'|'flood', on, flick }
  doors: [],     // { id, x0, z0, x1, z1, mesh, open }
  loot: [],      // spots for supplies: { x, z, y, where }
  cars: [],      // { x, z, rot, burning }
  fires: [],     // { x, y, z, sprite }
  marks: {},     // named places: { x, z }
  footprints: [],// for the map: { x0, z0, x1, z1, kind }
  decals: [],    // blood on the street (shown by gore level): { x, z, s, rot, y, wall? }
  props: [],     // interactive props named by the story: { id, obj }
  mats: {}, meshes: {}, stats: {},
};

// ---------- the grid ----------
export function fill(x0, z0, x1, z1, h = 255, mat = 0) {
  const i0 = Math.max(0, ci(Math.min(x0, x1) + 1e-4)), i1 = Math.min(N - 1, ci(Math.max(x0, x1) - 1e-4));
  const j0 = Math.max(0, ci(Math.min(z0, z1) + 1e-4)), j1 = Math.min(N - 1, ci(Math.max(z0, z1) - 1e-4));
  const hv = Math.min(255, Math.round(h * 10));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * N + i; if (hv >= H[k]) { H[k] = hv; MAT[k] = mat; } }
}
function fillOBB(cx, cz, w, d, rot, h, mat = 1) {
  const c = Math.cos(rot), s = Math.sin(rot), r = Math.hypot(w, d) / 2 + CELL;
  const hv = Math.min(255, Math.round(h * 10));
  for (let j = ci(cz - r); j <= ci(cz + r); j++) for (let i = ci(cx - r); i <= ci(cx + r); i++) {
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const x = cellX(i) - cx, z = cellX(j) - cz, lx = x * c - z * s, lz = x * s + z * c;
    if (Math.abs(lx) <= w / 2 + 0.1 && Math.abs(lz) <= d / 2 + 0.1) { const k = j * N + i; if (hv >= H[k]) { H[k] = hv; MAT[k] = mat; } }
  }
}
export function clearRect(x0, z0, x1, z1) {
  for (let j = Math.max(0, ci(z0 + 1e-4)); j <= Math.min(N - 1, ci(z1 - 1e-4)); j++) for (let i = Math.max(0, ci(x0 + 1e-4)); i <= Math.min(N - 1, ci(x1 - 1e-4)); i++) H[j * N + i] = 0;
}
export function heightAt(x, z) { const i = ci(x), j = ci(z); if (i < 0 || j < 0 || i >= N || j >= N) return 99; return H[j * N + i] * 0.1; }
export function solid(x, z) { const i = ci(x), j = ci(z); if (i < 0 || j < 0 || i >= N || j >= N) return true; return H[j * N + i] >= SOLID; }
export function solidCell(i, j) { if (i < 0 || j < 0 || i >= N || j >= N) return true; return H[j * N + i] >= SOLID; }
// the ground: blocks (sidewalk, park grass, building floors) are a kerb's height up from the road
export function groundY(x, z) {
  const fx = ((x + EDGE) % PITCH + PITCH) % PITCH, fz = ((z + EDGE) % PITCH + PITCH) % PITCH;
  if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) return 0;
  return fx > ST / 2 && fx < PITCH - ST / 2 && fz > ST / 2 && fz < PITCH - ST / 2 ? 0.15 : 0;
}
export function indoorAt(x, z) { for (const r of W.interiors) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r; return null; }
export const onStreet = (x, z) => groundY(x, z) === 0 && Math.abs(x) < EDGE + 4 && Math.abs(z) < EDGE + 4;

// push a circle out of solid cells (returns true if it touched anything)
export function collide(p, r = 0.35) {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const i0 = ci(p.x - r), i1 = ci(p.x + r), j0 = ci(p.z - r), j1 = ci(p.z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!solidCell(i, j)) continue;
      const x0 = i * CELL - HALF, z0 = j * CELL - HALF;
      const qx = Math.max(x0, Math.min(p.x, x0 + CELL)), qz = Math.max(z0, Math.min(p.z, z0 + CELL));
      let dx = p.x - qx, dz = p.z - qz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 < 1e-8) { // centre inside the cell: out the nearest side
        const l = p.x - x0, rr = x0 + CELL - p.x, t = p.z - z0, b = z0 + CELL - p.z, m = Math.min(l, rr, t, b);
        if (m === l) p.x = x0 - r; else if (m === rr) p.x = x0 + CELL + r; else if (m === t) p.z = z0 - r; else p.z = z0 + CELL + r;
        continue;
      }
      const d = Math.sqrt(d2), push = (r - d) / d; p.x += dx * push; p.z += dz * push;
    }
  }
  return hit;
}

// a ray through the grid (and the ground). Returns { t, x, y, z, nx, ny, nz, mat } or null
export function raycast(ox, oy, oz, dx, dy, dz, max = 200) {
  const lenXZ = Math.hypot(dx, dz);
  let tGround = dy < -1e-6 ? (groundY(ox, oz) - oy) / dy : Infinity; if (tGround < 0) tGround = Infinity;
  let best = Math.min(tGround, max);
  if (lenXZ > 1e-6) {
    let i = ci(ox), j = ci(oz);
    const stepI = dx > 0 ? 1 : -1, stepJ = dz > 0 ? 1 : -1;
    const nextX = (i + (dx > 0 ? 1 : 0)) * CELL - HALF, nextZ = (j + (dz > 0 ? 1 : 0)) * CELL - HALF;
    let tMaxX = Math.abs(dx) > 1e-9 ? (nextX - ox) / dx : Infinity, tMaxZ = Math.abs(dz) > 1e-9 ? (nextZ - oz) / dz : Infinity;
    const tdX = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity, tdZ = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    let t0 = 0, side = -1;
    for (let n = 0; n < 2000 && t0 < best; n++) {
      if (i < 0 || j < 0 || i >= N || j >= N) break;
      const h = H[j * N + i];
      if (h > 0) {
        const hh = h * 0.1, t1 = Math.min(tMaxX, tMaxZ), y0 = oy + dy * t0, y1 = oy + dy * t1;
        if (y0 <= hh) { // hit the side
          if (t0 < best) { const nx = side === 0 ? -stepI : 0, nz = side === 1 ? -stepJ : 0; return { t: t0, x: ox + dx * t0, y: y0, z: oz + dz * t0, nx, ny: 0, nz, mat: MAT[j * N + i] }; }
        } else if (y1 <= hh) { // came down on top of it
          const tt = (hh - oy) / dy; if (tt < best) return { t: tt, x: ox + dx * tt, y: hh, z: oz + dz * tt, nx: 0, ny: 1, nz: 0, mat: MAT[j * N + i] };
        }
      }
      if (tMaxX < tMaxZ) { t0 = tMaxX; tMaxX += tdX; i += stepI; side = 0; } else { t0 = tMaxZ; tMaxZ += tdZ; j += stepJ; side = 1; }
    }
  }
  if (tGround <= max && tGround === best) return { t: tGround, x: ox + dx * tGround, y: oy + dy * tGround, z: oz + dz * tGround, nx: 0, ny: 1, nz: 0, mat: 0 };
  return null;
}
export function clearLine(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if (L < 1e-4) return true;
  const h = raycast(ax, ay, az, dx / L, dy / L, dz / L, L);
  return !h || h.t >= L - 0.3;
}

// ---------- geometry ----------
const GEO = {}; // material key -> [geometries]
const _col = new THREE.Color();
function addGeo(key, geo, color = 0xffffff) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3); _col.set(color);
  for (let i = 0; i < n; i++) { c[i * 3] = _col.r; c[i * 3 + 1] = _col.g; c[i * 3 + 2] = _col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (geo.index) geo = geo.toNonIndexed();
  (GEO[key] || (GEO[key] = [])).push(geo);
}
// a box with UVs in world units (tile = [u metres, v metres]), placed at its centre
function boxGeo(cx, cy, cz, w, h, d, tile = [1, 1], rot = 0) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile[0], uv.getY(i) * dims[f][1] / tile[1]); }
  if (rot) g.rotateY(rot);
  g.translate(cx, cy, cz); return g;
}
export function box(key, x0, y0, z0, x1, y1, z1, { color = 0xffffff, tile = [1, 1], solidH = null, mat = 0, rot = 0 } = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  addGeo(key, boxGeo((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, w, h, d, tile, rot), color);
  if (solidH !== null) fill(x0, z0, x1, z1, solidH, mat);
}
function cyl(key, x, y0, z, r0, r1, h, seg = 8, color = 0xffffff) { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y0 + h / 2, z); addGeo(key, g, color); }
function ball(key, x, y, z, r, color = 0xffffff, sx = 1, sy = 1, sz = 1) { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(sx, sy, sz); g.translate(x, y, z); addGeo(key, g, color); }
function plane(key, x0, z0, x1, z1, y, tile = [1, 1], color = 0xffffff, rotUV = false) {
  const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (rotUV) uv.setXY(i, v * d / tile[0], u * w / tile[1]); else uv.setXY(i, u * w / tile[0], v * d / tile[1]); }
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); addGeo(key, g, color);
}

// walls with gaps. A wall along x at z (from x0 to x1), gaps = [[a, b], ...] in x; thickness T, centred on the line.
const T = 0.5;
function wallX(key, z, x0, x1, gaps = [], h = 4, y0 = 0.15, opts = {}) {
  const segs = cut(x0, x1, gaps);
  for (const [a, b] of segs) box(key, a, y0, z - T / 2, b, y0 + h, z + T / 2, { tile: opts.tile || [3, 3], color: opts.color ?? 0xffffff, solidH: h + y0, mat: opts.mat || 0 });
  if (opts.lintel !== false) for (const [a, b] of gaps) if (h > 3) box(key, a, y0 + 2.7, z - T / 2, b, y0 + h, z + T / 2, { tile: opts.tile || [3, 3], color: opts.color ?? 0xffffff });
}
function wallZ(key, x, z0, z1, gaps = [], h = 4, y0 = 0.15, opts = {}) {
  const segs = cut(z0, z1, gaps);
  for (const [a, b] of segs) box(key, x - T / 2, y0, a, x + T / 2, y0 + h, b, { tile: opts.tile || [3, 3], color: opts.color ?? 0xffffff, solidH: h + y0, mat: opts.mat || 0 });
  if (opts.lintel !== false) for (const [a, b] of gaps) if (h > 3) box(key, x - T / 2, y0 + 2.7, a, x + T / 2, y0 + h, b, { tile: opts.tile || [3, 3], color: opts.color ?? 0xffffff });
}
function cut(a, b, gaps) {
  const out = []; let s = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) out.push([s, g0]); s = Math.max(s, g1); }
  if (s < b) out.push([s, b]); return out;
}

// a building you can walk into: outer shell (facade outside, plaster inside), floor, ceiling, roof
function hollow(name, x0, z0, x1, z1, h, fac, doors, { ceil = 4, floor = 'tile', color = 0xffffff, inner = 0xd8d4c8 } = {}) {
  const gx = (side) => doors.filter((d) => d[0] === side).map((d) => [d[1], d[2]]);
  // facade skin (outside), the inside lining is the plaster walls drawn just inside
  for (const [side, z] of [['n', z0], ['s', z1]]) for (const [a, b] of cut(x0, x1, gx(side))) box(fac, a, 0.15, z - (side === 'n' ? 0 : T), b, h, z + (side === 'n' ? T : 0), { tile: [4, 3.5], color, solidH: h });
  for (const [side, x] of [['w', x0], ['e', x1]]) for (const [a, b] of cut(z0, z1, gx(side))) box(fac, x - (side === 'w' ? 0 : T), 0.15, a, x + (side === 'w' ? T : 0), h, b, { tile: [4, 3.5], color, solidH: h });
  for (const [side, a, b] of doors) { // above the doors: facade again
    if (side === 'n' || side === 's') { const z = side === 'n' ? z0 : z1 - T; box(fac, a, 3.0, z, b, h, z + T, { tile: [4, 3.5], color }); }
    else { const x = side === 'w' ? x0 : x1 - T; box(fac, x, 3.0, a, x + T, h, b, { tile: [4, 3.5], color }); }
  }
  // plaster lining inside (thin, no collision of its own), cut where the doors are; floor and ceiling
  const e = 0.02, top = 0.15 + ceil;
  for (const [a, b] of cut(x0 + T, x1 - T, gx('n'))) box('plaster', a, 0.15, z0 + T, b, top, z0 + T + e, { tile: [3, 3], color: inner });
  for (const [a, b] of cut(x0 + T, x1 - T, gx('s'))) box('plaster', a, 0.15, z1 - T - e, b, top, z1 - T, { tile: [3, 3], color: inner });
  for (const [a, b] of cut(z0 + T, z1 - T, gx('w'))) box('plaster', x0 + T, 0.15, a, x0 + T + e, top, b, { tile: [3, 3], color: inner });
  for (const [a, b] of cut(z0 + T, z1 - T, gx('e'))) box('plaster', x1 - T - e, 0.15, a, x1 - T, top, b, { tile: [3, 3], color: inner });
  plane(floor, x0, z0, x1, z1, 0.152, floor === 'wood' ? [3, 3] : [4, 4]);
  box('ceiling', x0 + T, 0.15 + ceil, z0 + T, x1 - T, 0.35 + ceil, z1 - T, { tile: [2, 2] });
  box('roof', x0, h - 0.2, z0, x1, h, z1, { tile: [8, 8] });
  W.interiors.push({ x0: x0 + T, z0: z0 + T, x1: x1 - T, z1: z1 - T, name, ceil: 0.15 + ceil });
  W.footprints.push({ x0, z0, x1, z1, kind: name });
  // door holes in the lining: dark-free gaps are simplest done by drawing the frame over them
  for (const [side, a, b] of doors) {
    if (side === 'n' || side === 's') { const z = side === 'n' ? z0 + T : z1 - T - e; box('trim', a - 0.15, 0.15, z - 0.04, a, 2.9, z + 0.06); box('trim', b, 0.15, z - 0.04, b + 0.15, 2.9, z + 0.06); }
    else { const x = side === 'w' ? x0 + T : x1 - T - e; box('trim', x - 0.04, 0.15, a - 0.15, x + 0.06, 2.9, a); box('trim', x - 0.04, 0.15, b, x + 0.06, 2.9, b + 0.15); }
  }
}
// the lining must not cover door openings: punch them by drawing black "void" quads is ugly, so instead the
// lining for walls with doors is rebuilt here in pieces
function lining(x0, z0, x1, z1, ceil, doors, inner) {
  void x0; void z0; void x1; void z1; void ceil; void doors; void inner;
}
function ceilLight(x, z, y = 4.1, on = true, flick = 0, color = 0xe8f0ff) {
  box(on ? 'panelOn' : 'panelOff', x - 0.6, y - 0.03, z - 0.3, x + 0.6, y + 0.02, z + 0.3);
  W.fixtures.push({ x, y: y - 0.3, z, color, power: 5, dist: 11, kind: 'ceil', on, flick });
}
function desk(x, z, rot = 0, color = 0x6a5440) {
  const c = Math.cos(rot), s = Math.sin(rot);
  addGeo('wood', boxGeo(x, 0.9, z, 1.6, 0.06, 0.8, [1, 1], rot), color);
  for (const [a, b] of [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]]) addGeo('metalDark', boxGeo(x + a * c + b * s, 0.52, z - a * s + b * c, 0.05, 0.74, 0.05), 0x888888);
  fillOBB(x, z, 1.6, 0.8, rot, 0.9, 3);
}
function shelf(x, z, w, d, h = 1.9, rot = 0, color = 0x8a8a84) {
  addGeo('metal', boxGeo(x, 0.15 + h / 2, z, w, h, d, [1, 1], rot), color);
  for (let k = 0; k < 4; k++) addGeo('box', boxGeo(x + (Math.random() - 0.5) * w * 0.6, 0.15 + 0.4 + k * 0.45, z, w * 0.3, 0.25, d * 0.6, [0.5, 0.5], rot), [0x9a7a50, 0x6a7a8a, 0xaa4a3a, 0xd0c8b0][k]);
  fillOBB(x, z, w, d, rot, h, 1);
}
function bed(x, z, rot = 0, sheet = 0xd8d8e0) {
  addGeo('metal', boxGeo(x, 0.45, z, 0.95, 0.12, 2.0, [1, 1], rot), 0xaaaaaa);
  addGeo('fabric', boxGeo(x, 0.6, z, 0.9, 0.18, 1.95, [1, 1], rot), sheet);
  fillOBB(x, z, 0.95, 2.0, rot, 0.7, 3);
}
function counter(x0, z0, x1, z1, h = 1.05, color = 0x5a5048) { box('wood', x0, 0.15, z0, x1, h, z1, { color, solidH: h, mat: 3 }); }
function locker(x, z, rot = 0, color = 0x5a6a74) { addGeo('metal', boxGeo(x, 1.05, z, 0.55, 1.8, 0.5, [0.5, 1.8], rot), color); fillOBB(x, z, 0.55, 0.5, rot, 1.9, 1); }
function crate(x, z, s = 1, color = 0x4a5a34) { box('box', x - s / 2, 0.15, z - s / 2, x + s / 2, 0.15 + s, z + s / 2, { color, tile: [s, s], solidH: s + 0.15, mat: 3 }); }

// ---------- the city ----------
const FAC = ['facGrey', 'facBrick', 'facBeige', 'facGlass', 'facBrown', 'facDark'];
export function buildCity(scene) {
  const R = TX.rng(20261121);
  // materials
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  const night = (seed) => { const t = TX.towerNight('night' + seed, seed, 0.06); const c = t.clone(); c.needsUpdate = true; c.repeat.set(0.125, 0.125); return c; };
  const fac = (key, tex) => { W.mats[key] = std({ map: tex, emissiveMap: night(key.length * 7 + 3), emissive: 0xffffff, emissiveIntensity: 0 }); };
  fac('facGrey', TX.tower('t-grey', 0x8a8c8c, 'office', 1)); fac('facBrick', TX.tower('t-brick', 0x7a3a2c, 'brick', 2)); fac('facBeige', TX.tower('t-beige', 0xa89a80, 'concrete', 3));
  fac('facGlass', TX.tower('t-glass', 0x5a6a78, 'glass', 4)); fac('facBrown', TX.tower('t-brown', 0x5a3a2a, 'brick', 5)); fac('facDark', TX.tower('t-dark', 0x4a4c50, 'office', 6));
  fac('facLab', TX.tower('t-lab', 0xc8ccd0, 'glass', 7)); fac('facHosp', TX.tower('t-hosp', 0xd8d0c0, 'concrete', 8)); fac('facCop', TX.tower('t-cop', 0x6a6a70, 'brick', 9));
  Object.assign(W.mats, {
    road: std({ map: TX.road() }), asphalt: std({ map: TX.asphalt('asph', 13) }), walk: std({ map: TX.paving() }), grass: std({ map: TX.grass() }),
    roof: std({ map: TX.concrete('roofc', 0x3a3a3c, 5) }), concrete: std({ map: TX.concrete('conc', 0x8a8680, 9) }),
    plaster: std({ map: TX.plaster('plast', 0xd0ccc0, 6) }), tile: std({ map: TX.labTile('lab', 24, 0.6) }), wood: std({ map: TX.wood('wd', 0x7a5a3a, 7) }),
    floorWood: std({ map: TX.planks('planks', 0x6a4a30, 2) }), ceiling: std({ map: TX.plaster('ceil', 0x9a9890, 11) }), trim: std({ color: 0xffffff, roughness: 0.7 }),
    metal: std({ map: TX.metal('met', 0x8a9096, 23, 0.5), roughness: 0.55, metalness: 0.4 }), metalDark: std({ color: 0xffffff, roughness: 0.5, metalness: 0.5 }),
    car: std({ map: TX.metal('carm', 0xc0c0c0, 27, 0.8), roughness: 0.45, metalness: 0.35 }), glassDark: std({ color: 0x0a0c10, roughness: 0.15, metalness: 0.6 }),
    fabric: std({ map: TX.fabric('fab', 0xb0b0b0, 8) }), box: std({ map: TX.wood('crate', 0xa08860, 17) }), hazard: std({ map: TX.hazard() }),
    bark: std({ color: 0xffffff, roughness: 1 }), leaves: std({ color: 0xffffff, roughness: 1 }), sand: std({ map: TX.fabric('sandbag', 0x8a7a5a, 19) }),
    panelOn: std({ color: 0x404448, emissive: 0xe8f0ff, emissiveIntensity: 1.2 }), panelOff: std({ color: 0x303234 }),
    lampOn: std({ color: 0x302a20, emissive: 0xffd8a0, emissiveIntensity: 0 }), lampOff: std({ color: 0x24262a, roughness: 0.6, metalness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false }),
    growth: std({ map: TX.deadSkin('growthwall', 0x8a5048, 77, 1), roughness: 0.4 }),
  });
  W.mats.floorWoodKey = 'floorWood';

  // ---- ground: roads, intersections, blocks ----
  for (let k = 0; k <= NB; k++) {
    const s = SX[k];
    plane('road', s - ST / 2, -EDGE - ST / 2, s + ST / 2, EDGE + ST / 2, 0, [ST, ST]);         // north-south
    plane('road', -EDGE - ST / 2, s - ST / 2, EDGE + ST / 2, s + ST / 2, 0.004, [ST, ST], 0xffffff, true); // east-west
    for (let m = 0; m <= NB; m++) plane('asphalt', s - ST / 2, SX[m] - ST / 2, s + ST / 2, SX[m] + ST / 2, 0.008, [6, 6]);
  }
  plane('asphalt', -HALF - 40, -HALF - 40, HALF + 40, HALF + 40, -0.02, [8, 8], 0x707070); // under everything, past the wall
  const special = { '3,5': 'halcyon', '1,3': 'precinct', '5,1': 'hospital', '1,0': 'apartment', '3,3': 'park' };
  const shops = new Set(['0,2', '2,1', '4,4', '5,5', '2,6', '6,3', '4,0', '0,5']);
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    const x0 = blockMin(i), x1 = blockMax(i), z0 = blockMin(j), z1 = blockMax(j), key = i + ',' + j;
    if (special[key] === 'park') { plane('grass', x0, z0, x1, z1, 0.15, [6, 6]); kerb(x0, z0, x1, z1); continue; }
    plane('walk', x0, z0, x1, z1, 0.15, [3, 3]); kerb(x0, z0, x1, z1);
    if (special[key]) continue;
    genericBlock(i, j, R, shops.has(key));
  }
  buildHalcyon(); buildPrecinct(); buildHospital(); buildApartment(); buildPark(R); buildCheckpoint();
  streetLife(R, special);
  quarantineWall();

  // ---- merge everything into one mesh per material ----
  for (const [key, list] of Object.entries(GEO)) {
    const m = W.mats[key] || W.mats.concrete;
    const geo = mergeGeometries(list, false); list.length = 0;
    const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.castShadow = !['road', 'asphalt', 'walk', 'grass', 'tile', 'floorWood', 'glass', 'panelOn', 'lampOn'].includes(key);
    mesh.receiveShadow = true; mesh.name = key;
    scene.add(mesh); W.meshes[key] = mesh;
  }
  W.meshes.glass && (W.meshes.glass.renderOrder = 2, W.meshes.glass.castShadow = false);
  W.stats = { meshes: Object.keys(W.meshes).length, fixtures: W.fixtures.length, interiors: W.interiors.length };
  // locked doors are their own meshes (they open)
  const doorMat = new THREE.MeshStandardMaterial({ map: TX.metal('doorm', 0x6a7078, 29, 0.3), roughness: 0.5, metalness: 0.5 });
  for (const d of W.doors) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(d.x1 - d.x0, 2.9, d.z1 - d.z0), doorMat);
    m.position.set((d.x0 + d.x1) / 2, 0.15 + 1.45, (d.z0 + d.z1) / 2); m.castShadow = m.receiveShadow = true; scene.add(m); d.mesh = m;
    fill(d.x0, d.z0, d.x1, d.z1, 3.1, 1);
  }
  // fires: flickering billboards
  const fireTex = fireTexture();
  for (const f of W.fires) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: 0xffa050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(f.x, f.y, f.z); sp.scale.set(2.4, 2.8, 1); scene.add(sp); f.sprite = sp;
    const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: 0x222222, depthWrite: false, transparent: true, opacity: 0.55 }));
    smoke.position.set(f.x, f.y + 6, f.z); smoke.scale.set(8, 14, 1); scene.add(smoke); f.smoke = smoke;
  }
  return W;
}
export function setDoor(id, open) {
  const d = W.doors.find((q) => q.id === id); if (!d || d.open === open) return;
  d.open = open; d.mesh.visible = !open;
  if (open) clearRect(d.x0, d.z0, d.x1, d.z1); else fill(d.x0, d.z0, d.x1, d.z1, 3.1, 1);
}
function kerb(x0, z0, x1, z1) {
  box('concrete', x0, 0, z0, x1, 0.15, z0 + 0.25, { color: 0x9a9690, tile: [2, 0.3] }); box('concrete', x0, 0, z1 - 0.25, x1, 0.15, z1, { color: 0x9a9690, tile: [2, 0.3] });
  box('concrete', x0, 0, z0, x0 + 0.25, 0.15, z1, { color: 0x9a9690, tile: [0.3, 2] }); box('concrete', x1 - 0.25, 0, z0, x1, 0.15, z1, { color: 0x9a9690, tile: [0.3, 2] });
}

// a block of towers: split into lots with alleys, each a tower (taller towards downtown), now and then a car park.
function genericBlock(i, j, R, shop) {
  const x0 = blockMin(i) + 3, x1 = blockMax(i) - 3, z0 = blockMin(j) + 3, z1 = blockMax(j) - 3;
  const nx = R() < 0.5 ? 2 : R() < 0.5 ? 1 : 3, nz = R() < 0.5 ? 2 : 1;
  const down = 1 - Math.hypot(i - 3, j - 3) / 4.3;
  const lw = (x1 - x0 - (nx - 1) * 3) / nx, ld = (z1 - z0 - (nz - 1) * 3) / nz;
  let shopDone = !shop;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const bx0 = snap(x0 + a * (lw + 3)), bx1 = snap(bx0 + lw), bz0 = snap(z0 + b * (ld + 3)), bz1 = snap(bz0 + ld);
    if (!shopDone && (a === 0 || a === nx - 1) && (b === 0 || b === nz - 1)) { shopDone = true; cornerShop(bx0, bz0, bx1, bz1, a === 0 ? 'w' : 'e', b === 0 ? 'n' : 's', R); continue; }
    if (R() < 0.1) { carPark(bx0, bz0, bx1, bz1, R); continue; }
    const h = Math.round((10 + R() * 18 + Math.max(0, down) * (20 + R() * 30)) / 3.5) * 3.5;
    const f = FAC[(R() * FAC.length) | 0], tint = [0xffffff, 0xe8e0d8, 0xd8dce0, 0xc8c0b8][(R() * 4) | 0];
    box(f, bx0, 0.15, bz0, bx1, 0.15 + h, bz1, { tile: [4, 3.5], color: tint, solidH: h, mat: f === 'facGlass' ? 2 : 0 });
    box('roof', bx0 - 0.3, h + 0.1, bz0 - 0.3, bx1 + 0.3, h + 0.6, bz1 + 0.3, { tile: [8, 8] });
    if (R() < 0.5) box('metal', bx0 + 2, h + 0.6, bz0 + 2, bx0 + 5, h + 2.4, bz0 + 4, { tile: [1, 1], color: 0x888888 });
    // ground floor: a door, maybe a shutter, an awning
    const side = R() < 0.5 ? 'n' : 's', zf = side === 'n' ? bz0 - 0.06 : bz1 + 0.06, mx = (bx0 + bx1) / 2 + (R() - 0.5) * (bx1 - bx0) * 0.4;
    box('glassDark', mx - 1.2, 0.15, Math.min(zf, zf + (side === 'n' ? 0.06 : -0.06)), mx + 1.2, 2.6, Math.max(zf, zf + (side === 'n' ? 0.06 : -0.06)));
    if (R() < 0.45) { const c = [0x6a1a14, 0x1a3a5a, 0x2a4a2a, 0x5a4a1a][(R() * 4) | 0]; box('fabric', bx0 + 0.5, 3.0, side === 'n' ? bz0 - 1.4 : bz1, bx1 - 0.5, 3.15, side === 'n' ? bz0 : bz1 + 1.4, { color: c }); }
    if (R() < 0.3) W.loot.push({ x: mx, z: side === 'n' ? bz0 - 1.2 : bz1 + 1.2, where: 'street' });
    W.footprints.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, kind: 'tower' });
  }
}
const snap = (v) => Math.round(v * 2) / 2;
function carPark(x0, z0, x1, z1, R) {
  plane('asphalt', x0, z0, x1, z1, 0.16, [6, 6], 0x9a9a9a);
  for (let x = x0 + 2; x < x1 - 2; x += 3) if (R() < 0.5) car(x + 1, (z0 + z1) / 2 + (R() < 0.5 ? -3 : 3), Math.PI / 2 + (R() - 0.5) * 0.2, R, R() < 0.05, 0.15);
  W.footprints.push({ x0, z0, x1, z1, kind: 'lot' });
  W.loot.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, where: 'lot' });
}
// a small shop on a corner, door facing the street: shelves, a counter, supplies
function cornerShop(x0, z0, x1, z1, sx, sz, R) {
  const w = Math.min(14, x1 - x0), d = Math.min(11, z1 - z0);
  const a0 = sx === 'w' ? x0 : x1 - w, a1 = a0 + w, b0 = sz === 'n' ? z0 : z1 - d, b1 = b0 + d;
  const mx = snap((a0 + a1) / 2);
  hollow('shop', a0, b0, a1, b1, 4.6, 'facBrick', [[sz, mx - 1.5, mx + 1.5]], { ceil: 3.6, floor: 'tile' });
  for (let k = 0; k < 3; k++) shelf(a0 + 3 + k * 3.5, (b0 + b1) / 2 + (sz === 'n' ? 1 : -1), 0.8, 4.5);
  counter(a1 - 4, sz === 'n' ? b1 - 3 : b0 + 1.5, a1 - 1, sz === 'n' ? b1 - 1.5 : b0 + 3);
  ceilLight((a0 + a1) / 2, (b0 + b1) / 2, 3.75, R() < 0.5, 0.3);
  // the rest of the lot is a tower
  const rest = sx === 'w' ? [a1 + 0.5, z0, x1, z1] : [x0, z0, a0 - 0.5, z1];
  if (rest[2] - rest[0] > 4) { const h = 14 + Math.round(R() * 5) * 3.5; box('facBeige', rest[0], 0.15, rest[1], rest[2], h, rest[3], { tile: [4, 3.5], solidH: h }); W.footprints.push({ x0: rest[0], z0: rest[1], x1: rest[2], z1: rest[3], kind: 'tower' }); }
  const rest2 = sz === 'n' ? [a0, b1 + 0.5, a1, z1] : [a0, z0, a1, b0 - 0.5];
  if (rest2[3] - rest2[1] > 4) { const h = 10.5 + Math.round(R() * 4) * 3.5; box('facGrey', rest2[0], 0.15, rest2[1], rest2[2], h, rest2[3], { tile: [4, 3.5], solidH: h }); W.footprints.push({ x0: rest2[0], z0: rest2[1], x1: rest2[2], z1: rest2[3], kind: 'tower' }); }
  W.loot.push({ x: a0 + 3 + 1.75, z: (b0 + b1) / 2, where: 'shop' }, { x: a1 - 2.5, z: sz === 'n' ? b1 - 2.2 : b0 + 2.2, where: 'shop' });
  const sn = Object.keys(W.marks).filter((k) => k.startsWith('shopDoor')).length;
  W.marks['shopDoor' + sn] = { x: mx, z: sz === 'n' ? b0 - 2 : b1 + 2 }; W.marks['shop' + sn] = { x: a0 + 4.75, z: (b0 + b1) / 2 };
  // the sign over the door
  addSign(mx, 3.4, sz === 'n' ? b0 - 0.08 : b1 + 0.08, sz === 'n' ? Math.PI : 0, ['CORNER MART', 'QUIK STOP', 'DELI 24H', 'PHARMACY'][(R() * 4) | 0]);
}
const signs = [];
function addSign(x, y, z, rot, text, w = 4, h = 0.8, colors = {}) { signs.push({ x, y, z, rot, text, w, h, colors }); }
export function buildSigns(scene) {
  for (const s of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshStandardMaterial({ map: TX.sign(s.text, { w: 512, h: 96, bg: s.colors.bg || '#1a2a3a', fg: s.colors.fg || '#e8e0d0', font: 'bold ' + Math.min(54, Math.floor(880 / Math.max(8, s.text.length))) + 'px Arial, sans-serif' }), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.06, emissiveMap: null }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.rot; scene.add(m);
  }
}

// ---------- Halcyon Biotech: where REM-7 was made, and where you wake up ----------
function buildHalcyon() {
  const x0 = -19, x1 = 19, z0 = 93, z1 = 131;
  hollow('halcyon', x0, z0, x1, z1, 24.5, 'facLab', [['n', -3, 3]], { ceil: 4, floor: 'tile' });
  const P = 'plaster';
  wallX(P, 103, x0 + 0.5, x1 - 0.5, [[-16, -13.5], [-1.5, 1.5], [13.5, 16]]);
  wallX(P, 107, x0 + 0.5, x1 - 0.5, [[-14.5, -12], [-4.5, -2], [1.5, 4], [11, 13.5]]);
  wallZ(P, -6, 107, 116); wallZ(P, 0, 107, 116); wallZ(P, 6, 107, 116);
  wallX(P, 116, x0 + 0.5, x1 - 0.5, [[-1.5, 1.5]]);
  W.doors.push({ id: 'storage', x0: -1.5, z0: 115.75, x1: 1.5, z1: 116.25, open: false });
  // lobby: reception, the glass doors smashed, chairs
  counter(-4, 97, 4, 98.2, 1.1, 0xd8d8d8);
  addSign(0, 3.4, 102.7, Math.PI, 'HALCYON BIOTECH', 6, 0.9, { bg: '#e8ecf0', fg: '#1a4a7a' });
  addSign(0, 3.6, 92.9, Math.PI, 'HALCYON', 8, 1.4, { bg: '#d8dce0', fg: '#1a4a7a' });
  for (let k = 0; k < 4; k++) box('fabric', -16 + k * 1.2, 0.15, 95, -15.2 + k * 1.2, 0.6, 95.8, { color: 0x3a5a7a });
  ceilLight(-10, 98); ceilLight(10, 98, 4.1, false); ceilLight(0, 100);
  // corridor
  ceilLight(-12, 105, 4.1, true, 0.5); ceilLight(0, 105, 4.1, false); ceilLight(12, 105, 4.1, true, 0.2);
  // lab A: benches, the incubators
  desk(-15, 111, 0, 0xe0e0e0); desk(-10, 111, 0, 0xe0e0e0); desk(-15, 114.5, 0, 0xe0e0e0);
  for (let k = 0; k < 3; k++) { cyl('glass', -8.2, 0.15, 109 + k * 2.4, 0.5, 0.5, 2.0, 12); cyl('metal', -8.2, 0.15, 109 + k * 2.4, 0.55, 0.55, 0.3, 12, 0x888888); fill(-8.8, 108.4 + k * 2.4, -7.6, 109.6 + k * 2.4, 2.2, 2); }
  ceilLight(-12, 111.5, 4.1, true, 0.15);
  // your office: desk, papers, the couch you slept on
  desk(-3, 109.5, 0, 0x5a4030); box('fabric', -5.5, 0.15, 112.5, -4.6, 0.75, 115.4, { color: 0x4a3a30, solidH: 0.75 });
  shelf(-0.8, 113, 0.5, 2.5, 2.2, 0, 0x6a5040);
  ceilLight(-3, 112, 4.1, true, 0.35);
  W.marks.wake = { x: -3.2, z: 113.6 }; W.marks.office = { x: -3, z: 109.5 };
  // security: lockers along the wall, the monitors
  for (let k = 0; k < 4; k++) locker(1.0 + k * 0.6, 115.4);
  desk(3, 109.2, 0, 0x404040); box('glassDark', 2.2, 0.98, 108.9, 3.8, 1.6, 109.0);
  ceilLight(3, 112, 4.1, true, 0.6);
  W.marks.security = { x: 3, z: 112 }; W.marks.lockers = { x: 2.4, z: 114.8 };
  // lab B: the trial records, the tape
  for (let k = 0; k < 3; k++) shelf(8 + k * 3.5, 115.3, 2.4, 0.5);
  desk(12, 110, 0, 0xe0e0e0); ceilLight(12, 111.5, 4.1, true, 0.1);
  W.marks.labB = { x: 12, z: 110 };
  // cold storage / the trial ward: where the Mass grows
  for (let k = 0; k < 6; k++) { const x = -15 + k * 6; bed(x, 128.5, 0, 0xc8d0d8); }
  for (let k = 0; k < 5; k++) ceilLight(-12 + k * 6, 123.5, 4.1, k % 2 === 0, 0.4, 0xd0e8ff);
  W.marks.mass = { x: 0, z: 124 }; W.marks.halcyonDoor = { x: 0, z: 90.5 }; W.marks.storageDoor = { x: 0, z: 114.5 };
  W.loot.push({ x: -14, z: 105, where: 'halcyon' }, { x: 14, z: 96, where: 'halcyon' });
}

// ---------- 9th Precinct ----------
function buildPrecinct() {
  const x0 = -127, x1 = -93, z0 = -15, z1 = 15;
  hollow('precinct', x0, z0, x1, z1, 14, 'facCop', [['e', -1.5, 1.5]], { ceil: 4 });
  const P = 'plaster';
  wallZ(P, -103, z0 + 0.5, z1 - 0.5, [[-1.5, 1.5]]);
  wallX(P, -2, x0 + 0.5, -103, [[-121, -118.5], [-110, -107.5]]);
  wallX(P, 2, x0 + 0.5, -103, [[-121, -118.5], [-110, -107.5]]);
  wallZ(P, -115, z0 + 0.5, -2); wallZ(P, -115, 2, z1 - 0.5);
  W.doors.push({ id: 'armory', x0: -121, z0: 1.75, x1: -118.5, z1: 2.25, open: false });
  counter(-99, -6, -97.8, 6, 1.15, 0x3a3a40);
  addSign(-92.9, 3.6, 0, Math.PI / 2, '9TH PRECINCT', 6, 1.0, { bg: '#1a2a4a', fg: '#e8e8f0' });
  ceilLight(-98, -8); ceilLight(-98, 8, 4.1, false);
  // corridor (the lights go out here)
  ceilLight(-109, 0, 4.1, true, 0); ceilLight(-121, 0, 4.1, true, 0);
  W.marks.flicker = { x: -112, z: 0 };
  // cells: bars
  for (let k = 0; k < 3; k++) { const zc = -13 + k * 0; void zc; }
  for (let x = -126.5; x < -115.5; x += 0.35) cyl('metal', x, 0.15, -7, 0.025, 0.025, 2.9, 5, 0x707070);
  fill(-127, -7.25, -115.5, -6.75, 3, 1);
  for (const x of [-123, -119]) { box(P, x - 0.15, 0.15, -14.5, x + 0.15, 4.15, -7.25, { solidH: 4.15 }); }
  ceilLight(-121, -10, 4.1, false);
  // offices
  desk(-111, -8); desk(-107, -11); desk(-111, -12); ceilLight(-109, -9, 4.1, true, 0.3);
  // armory: racks
  for (let k = 0; k < 3; k++) shelf(-126.3, 5 + k * 3, 0.6, 2.2, 2, 0, 0x5a5a5a);
  crate(-117, 13, 1, 0x3a4a3a); ceilLight(-121, 8);
  W.marks.armory = { x: -121, z: 8 }; W.marks.armoryDoor = { x: -119.7, z: 0.8 };
  // break room
  desk(-109, 8); box('metal', -105, 0.15, 13.5, -104, 2, 14.5, { color: 0xdddddd, solidH: 2 }); ceilLight(-109, 9, 4.1, true, 0.7);
  W.marks.precinctDoor = { x: -90, z: 0 };
  W.loot.push({ x: -108, z: 12, where: 'precinct' }, { x: -98, z: 10, where: 'precinct' }, { x: -112, z: -13, where: 'precinct' });
}

// ---------- St. Agnes Hospital: Dr. Kaur, behind the glass ----------
function buildHospital() {
  const x0 = 93, x1 = 131, z0 = -131, z1 = -93;
  hollow('hospital', x0, z0, x1, z1, 31.5, 'facHosp', [['w', -113.5, -110.5]], { ceil: 4 });
  const P = 'plaster';
  wallZ(P, 105, z0 + 0.5, z1 - 0.5, [[-113.5, -110.5]]);
  wallX(P, -114, 105, x1 - 0.5, [[110, 112.5], [123, 125.5]]);
  wallX(P, -110, 105, x1 - 0.5, [[110, 112.5], [123, 125.5]]);
  wallZ(P, 118, z0 + 0.5, -114); wallZ(P, 118, -110, z1 - 0.5);
  counter(99, -120, 100.2, -104, 1.1, 0xd8d8d8);
  addSign(92.9, 3.8, -112, -Math.PI / 2, 'ST. AGNES  EMERGENCY', 8, 1.1, { bg: '#a8100a', fg: '#ffffff' });
  for (let k = 0; k < 3; k++) bed(96 + k * 2.2, -126, 0.1 * k, 0xd8d8e0);
  ceilLight(99, -124); ceilLight(99, -112, 4.1, true, 0.4); ceilLight(99, -100, 4.1, false);
  ceilLight(112, -112, 4.1, true, 0.2); ceilLight(124, -112, 4.1, false);
  // ward A: gurneys and body bags (one sits up)
  for (let k = 0; k < 4; k++) bed(107.5 + k * 2.8, -124, 0, 0x2a2a2e);
  for (let k = 0; k < 4; k++) bed(107.5 + k * 2.8, -118.5, 0, 0xc8d0d8);
  ceilLight(111, -121, 4.1, true, 0.6);
  W.marks.wardA = { x: 111, z: -121 }; W.marks.gurney = { x: 113.1, z: -118.5 };
  // ward B
  for (let k = 0; k < 4; k++) bed(120.5 + k * 2.8, -125, 0, 0xc8d0d8);
  ceilLight(124, -121, 4.1, false);
  // supply room
  for (let k = 0; k < 3; k++) shelf(107 + k * 3.5, -95, 2.4, 0.5); ceilLight(111, -101);
  W.loot.push({ x: 108, z: -97, where: 'hospital' }, { x: 115, z: -97, where: 'hospital' }, { x: 98, z: -108, where: 'hospital' });
  // isolation lab: you on this side of the glass, Kaur on the other
  ceilLight(124.5, -106); ceilLight(124.5, -97, 4.1, true, 0, 0xd8ffe8);
  box('glass', 118.25, 0.15, -101.15, 130.5, 4.15, -100.85, { solidH: 4.15, mat: 2 });
  box('metal', 118.25, 0.15, -101.2, 130.5, 1.0, -100.8, { color: 0xbbbbbb });
  desk(124.5, -97.5, 0, 0xe0e0e0); desk(128, -97.5, 0, 0xe0e0e0);
  box('metal', 119, 0.15, -95, 120.2, 2.0, -93.6, { color: 0xdddddd, solidH: 2 });
  W.marks.kaur = { x: 124.5, z: -99 }; W.marks.glass = { x: 124.5, z: -102.5 }; W.marks.hospitalDoor = { x: 90.5, z: -112 };
}

// ---------- your building: the flat, Mara, the study; Gus across the hall ----------
function buildApartment() {
  const x0 = -131, x1 = -93, z0 = -187, z1 = -149;
  hollow('apartment', x0, z0, x1, z1, 21.15, 'facBrick', [['s', -113.5, -110.5]], { ceil: 3.4, floor: 'floorWood', color: 0xd8c8b8, inner: 0xc8b8a0 });
  const P = 'plaster', h = 3.4;
  wallZ(P, -114, z0 + 0.5, z1 - 0.5, [[-158, -155.5]], h);
  wallZ(P, -110, z0 + 0.5, z1 - 0.5, [[-170, -167.5]], h);
  wallX(P, -163, x0 + 0.5, -114, [[-127, -124.5], [-119, -116.5]], h);
  wallZ(P, -121, -175, -163, [], h); wallZ(P, -121, z0 + 0.5, -175, [[-182, -179.5]], h);
  wallX(P, -175, x0 + 0.5, -114, [[-127, -124.5]], h);
  wallX(P, -168, -110, x1 - 0.5, [[-104, -101.5]], h);
  // hallway lights, mailboxes
  ceilLight(-112, -152, 3.5, true, 0.5); ceilLight(-112, -166, 3.5, false); ceilLight(-112, -180, 3.5, true, 0.3);
  box('metal', -113.6, 1.0, -160, -113.5, 2.0, -158.5, { color: 0x8a7a50 });
  // living room: couch, TV, the photos
  box('fabric', -130, 0.15, -160, -128.8, 0.95, -153, { color: 0x5a4a3a, solidH: 0.95 });
  box('glassDark', -116, 0.75, -157, -115.2, 1.6, -154.5); box('wood', -116.2, 0.15, -157.3, -114.8, 0.75, -154.2, { solidH: 0.75, mat: 3 });
  ceilLight(-122, -156, 3.5, false);
  // bedroom
  bed(-128, -168.5, 0, 0xb8a8c0); bed(-126.9, -168.5, 0, 0xb8a8c0); ceilLight(-126, -169, 3.5, false);
  W.marks.bedroom = { x: -126, z: -169 };
  // bathroom: the mirror
  box('metal', -116.6, 0.15, -174.5, -114.6, 0.6, -173.5, { color: 0xeeeeee, solidH: 0.6 });
  box('glass', -120.7, 1.2, -170, -120.65, 2.2, -168.6); ceilLight(-117.5, -169, 3.5, true, 0.8);
  W.marks.bath = { x: -117.5, z: -169 }; W.marks.mirror = { x: -120.4, z: -169.3 };
  // study: your desk, the notes
  desk(-128, -183, 0, 0x4a3020); shelf(-130.3, -179, 0.4, 3, 2.2, 0, 0x5a4030); ceilLight(-126, -181, 3.5, true, 0.1);
  W.marks.study = { x: -127, z: -182 }; W.marks.notes = { x: -128, z: -183 };
  // kitchen
  counter(-120.5, -186.5, -114.5, -185.5, 0.95, 0xd8d0c0); box('metal', -115.5, 0.15, -184.5, -114.6, 1.9, -183.6, { color: 0xdddddd, solidH: 1.9 });
  ceilLight(-117.5, -181, 3.5, false);
  W.loot.push({ x: -117.5, z: -183, where: 'apartment' });
  // Gus: crates, a gun safe, the chair
  for (let k = 0; k < 3; k++) crate(-95 - k * 1.3, -186, 1, 0x5a4a2a);
  box('metal', -94.6, 0.15, -160, -93.6, 1.9, -158.8, { color: 0x2a3a2a, solidH: 1.9 });
  box('fabric', -100, 0.15, -159, -99, 1.1, -158, { color: 0x6a3a2a, solidH: 1.1 });
  ceilLight(-101, -158, 3.5, true, 0.5); ceilLight(-101, -178, 3.5, false);
  W.marks.gus = { x: -96, z: -159.4 }; W.marks.gusSafe = { x: -95, z: -159.4 };
  W.loot.push({ x: -101, z: -183, where: 'apartment' });
  W.marks.apartmentDoor = { x: -112, z: -146 };
  addSign(-112, 3.2, -148.92, 0, 'HARROW COURT', 4, 0.7, { bg: '#2a1a14', fg: '#e8d8b8' });
}

// ---------- the park: trees, the fountain, the helicopter that came down ----------
function buildPark(R) {
  const x0 = blockMin(3), x1 = blockMax(3), z0 = blockMin(3), z1 = blockMax(3);
  // paths
  plane('walk', -1.5, z0, 1.5, z1, 0.155, [3, 3]); plane('walk', x0, -1.5, x1, 1.5, 0.156, [3, 3]);
  // fountain
  cyl('concrete', 0, 0.15, 0, 4, 4, 0.6, 20, 0x9a9690); cyl('glassDark', 0, 0.15, 0, 3.6, 3.6, 0.62, 20); cyl('concrete', 0, 0.15, 0, 0.6, 0.4, 2.4, 10, 0x9a9690);
  for (let j = ci(-4); j <= ci(4); j++) for (let i = ci(-4); i <= ci(4); i++) if (Math.hypot(cellX(i), cellX(j)) < 4) { H[j * N + i] = 6; }
  // trees, but not in the crash
  for (let k = 0; k < 60; k++) {
    const x = x0 + 2 + R() * (x1 - x0 - 4), z = z0 + 2 + R() * (z1 - z0 - 4);
    if (Math.abs(x) < 3 || Math.abs(z) < 3 || Math.hypot(x, z) < 6 || Math.hypot(x - 10, z + 9) < 9) continue;
    tree(x, z, R);
  }
  for (const [x, z] of [[-6, 3], [6, -3], [-3, -6], [3, 6]]) box('wood', x - 0.9, 0.15, z - 0.25, x + 0.9, 0.6, z + 0.25, { color: 0x5a4030, solidH: 0.6, mat: 3 });
  // the helicopter: fuselage on its side, tail snapped, a rotor blade in the grass
  const hx = 10, hz = -9;
  addGeo('metal', boxGeo(hx, 1.6, hz, 3.0, 2.6, 7.5, [2, 2], 0.5), 0x3a4232);
  addGeo('glassDark', boxGeo(hx - 3.5 * Math.sin(0.5), 1.9, hz - 3.5 * Math.cos(0.5), 2.4, 1.6, 1.2, [1, 1], 0.5));
  addGeo('metal', boxGeo(hx + 6 * Math.sin(0.5) + 1, 1.2, hz + 6 * Math.cos(0.5), 0.9, 0.9, 6, [2, 2], 0.9), 0x3a4232);
  addGeo('metal', boxGeo(hx - 4, 0.3, hz + 2, 0.4, 0.08, 7.5, [1, 1], 1.2), 0x222222);
  addGeo('metal', boxGeo(hx + 1, 3.1, hz, 0.4, 0.08, 6.5, [1, 1], -0.3), 0x222222);
  fillOBB(hx, hz, 3.2, 7.6, 0.5, 3, 1); fillOBB(hx + 6 * Math.sin(0.5) + 1, hz + 6 * Math.cos(0.5), 1, 6, 0.9, 1.6, 1);
  W.fires.push({ x: hx + 1.5, y: 2.6, z: hz + 2.5 }); W.fixtures.push({ x: hx + 1.5, y: 3, z: hz + 2.5, color: 0xff8030, power: 14, dist: 22, kind: 'fire', on: true, flick: 1 });
  for (let k = 0; k < 3; k++) crate(hx - 4 + k * 1.2, hz - 5, 0.9, 0x3a4a2a);
  W.marks.heli = { x: hx - 2.2, z: hz - 2.0 }; W.marks.park = { x: 0, z: 0 };
  W.footprints.push({ x0, z0, x1, z1, kind: 'park' });
}
function tree(x, z, R) {
  const h = 4 + R() * 3; cyl('bark', x, 0.15, z, 0.22, 0.14, h, 6, 0x3a2a20);
  for (let k = 0; k < 3; k++) ball('leaves', x + (R() - 0.5) * 1.4, h - 0.5 + R() * 1.6, z + (R() - 0.5) * 1.4, 1.2 + R() * 0.8, [0x2a3a1a, 0x3a3a1e, 0x4a3a1a][k], 1, 0.8, 1);
  fill(x - 0.25, z - 0.25, x + 0.25, z + 0.25, h, 3);
}

// ---------- the army checkpoint on Bell Street (x = 28, z = -84) ----------
function buildCheckpoint() {
  const cx = SX[4], cz = SX[2];
  // sandbag walls across the street with a gap, concrete barriers
  for (const [a, b] of [[cx - 6, cx - 1.5], [cx + 1.5, cx + 6]]) { box('sand', a, 0, cz + 5, b, 1.2, cz + 6, { tile: [0.8, 0.4], solidH: 1.2, mat: 3 }); box('sand', a, 0, cz - 6, b, 1.2, cz - 5, { tile: [0.8, 0.4], solidH: 1.2, mat: 3 }); }
  for (const [a, b] of [[cz - 6, cz - 1.5], [cz + 1.5, cz + 6]]) { box('sand', cx - 6, 0, a, cx - 5, 1.2, b, { tile: [0.8, 0.4], solidH: 1.2, mat: 3 }); box('sand', cx + 5, 0, a, cx + 6, 1.2, b, { tile: [0.8, 0.4], solidH: 1.2, mat: 3 }); }
  // the tent with the guns, a truck
  box('fabric', cx - 4, 0, cz - 3.5, cx - 0.5, 2.6, cz - 0.5, { color: 0x4a5a3a, solidH: 2.6, mat: 3 });
  clearRect(cx - 3.5, cz - 1.0, cx - 1.0, cz - 0.4); // its open flap
  box('fabric', cx - 3.8, 0, cz - 0.6, cx - 0.7, 2.4, cz - 0.4, { color: 0x3a4a2a });
  addGeo('metal', boxGeo(cx + 3, 1.3, cz + 2, 2.4, 2.2, 6.5), 0x3a4232); addGeo('fabric', boxGeo(cx + 3, 2.9, cz + 3, 2.4, 1.2, 4), 0x4a5a3a); fill(cx + 1.8, cz - 1.25, cx + 4.2, cz + 5.25, 2.4, 1);
  for (const [x, z] of [[cx - 5.5, cz - 5.5], [cx + 5.5, cz + 5.5]]) { cyl('metal', x, 0, z, 0.06, 0.06, 4, 6, 0x444444); box('metal', x - 0.4, 4, z - 0.2, x + 0.4, 4.5, z + 0.2, { color: 0x333333 }); W.fixtures.push({ x, y: 4, z, color: 0xffffff, power: 10, dist: 26, kind: 'flood', on: true, flick: 0.05 }); }
  addSign(cx, 1.6, cz + 6.05, 0, 'QUARANTINE CHECKPOINT  -  NO ENTRY', 5, 0.5, { bg: '#d8b020', fg: '#111' });
  W.marks.checkpoint = { x: cx, z: cz }; W.marks.tent = { x: cx - 2.2, z: cz - 2 };
  W.loot.push({ x: cx + 1, z: cz - 3, where: 'checkpoint' }, { x: cx - 3, z: cz + 3, where: 'checkpoint' });
}

// ---------- the street: wrecked cars, a bus, lamps (most dead), fires, blood ----------
function streetLife(R, special) {
  void special;
  // lamps every 14 m along every street, alternating sides, none in the crossings
  const nearX = (v) => SX.some((q) => Math.abs(q - v) < 9);
  for (let k = 0; k <= NB; k++) {
    let n = 0;
    for (let s = -EDGE + 14; s < EDGE - 3; s += 14) {
      if (nearX(s)) continue;
      const side = n++ % 2 ? 1 : -1, off = SX[k] + side * (ST / 2 + 0.6);
      lamp(off, s, -side, 0, R); lamp(s, off, 0, -side, R);
    }
  }
  // wrecks
  for (let n = 0; n < 150; n++) {
    const k = (R() * (NB + 1)) | 0, along = -EDGE + 10 + R() * (EDGE * 2 - 20), lane = (R() < 0.5 ? -1 : 1) * (1.8 + R() * 1.6);
    const ns = R() < 0.5; const x = ns ? SX[k] + lane : along, z = ns ? along : SX[k] + lane;
    if (near(x, z, SX[4], SX[2], 9)) continue; // keep the checkpoint clear
    if (W.cars.some((c) => Math.hypot(c.x - x, c.z - z) < 6)) continue;
    car(x, z, (ns ? 0 : Math.PI / 2) + (R() - 0.5) * 0.9 + (R() < 0.5 ? Math.PI : 0), R, R() < 0.06, 0);
  }
  // a bus across 3rd avenue
  addGeo('car', boxGeo(SX[3] + 1, 1.7, SX[4] - 8, 2.6, 3.0, 11, [2, 2], 0.3), 0xc8a020); addGeo('glassDark', boxGeo(SX[3] + 1, 2.4, SX[4] - 8, 2.65, 0.9, 10.5, [1, 1], 0.3));
  fillOBB(SX[3] + 1, SX[4] - 8, 2.6, 11, 0.3, 3.2, 1);
  // blood on the street
  for (let n = 0; n < 90; n++) { const k = (R() * (NB + 1)) | 0, along = -EDGE + R() * EDGE * 2, off = (R() - 0.5) * 10; const ns = R() < 0.5; W.decals.push({ x: ns ? SX[k] + off : along, z: ns ? along : SX[k] + off, s: 0.8 + R() * 2.4, rot: R() * 6.3, y: 0.02 }); }
}
const near = (x, z, a, b, r) => Math.hypot(x - a, z - b) < r;
function lamp(x, z, fx, fz, R) {
  const on = R() < 0.35;
  cyl('metalDark', x, 0, z, 0.09, 0.07, 6, 6, 0x3a3c40);
  box('metalDark', x, 5.9, z - 0.05, x + fx * 1.4 + 0.05, 6.0, z + fz * 1.4 + 0.05, { color: 0x3a3c40 });
  const hx = x + fx * 1.4, hz = z + fz * 1.4;
  box(on ? 'lampOn' : 'lampOff', hx - 0.3, 5.75, hz - 0.3, hx + 0.3, 5.9, hz + 0.3);
  fill(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 6, 1);
  if (on) W.fixtures.push({ x: hx, y: 5.6, z: hz, color: 0xffc888, power: 7, dist: 18, kind: 'lamp', on: true, flick: R() < 0.2 ? 0.5 : 0 });
}
const CAR_COL = [0x8a2a20, 0x2a3a5a, 0xc8c8c0, 0x1a1a1c, 0x5a6a5a, 0x8a7a50, 0x3a5a6a, 0x9a9a9a];
function car(x, z, rot, R, burning, y0 = 0) {
  const col = burning ? 0x1a1614 : CAR_COL[(R() * CAR_COL.length) | 0];
  const c = Math.cos(rot), s = Math.sin(rot); void c; void s;
  addGeo('car', boxGeo(x, y0 + 0.65, z, 1.85, 0.75, 4.4, [2, 1], rot), col);
  addGeo('car', boxGeo(x - Math.sin(rot) * 0.2, y0 + 1.28, z - Math.cos(rot) * 0.2, 1.65, 0.55, 2.3, [2, 1], rot), col);
  addGeo('glassDark', boxGeo(x - Math.sin(rot) * 0.2, y0 + 1.28, z - Math.cos(rot) * 0.2, 1.67, 0.42, 2.0, [1, 1], rot));
  for (const [a, b] of [[-0.8, -1.4], [0.8, -1.4], [-0.8, 1.4], [0.8, 1.4]]) { const g = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10); g.rotateZ(Math.PI / 2); g.rotateY(rot); g.translate(x + a * Math.cos(rot) + b * Math.sin(rot), y0 + 0.34, z - a * Math.sin(rot) + b * Math.cos(rot)); addGeo('metalDark', g, 0x151515); }
  fillOBB(x, z, 1.9, 4.5, rot, y0 + 1.5, 1);
  W.cars.push({ x, z, rot, burning });
  if (burning) { W.fires.push({ x, y: y0 + 1.7, z }); W.fixtures.push({ x, y: y0 + 2.2, z, color: 0xff7a30, power: 12, dist: 18, kind: 'fire', on: true, flick: 1 }); }
}
function quarantineWall() {
  const E = EDGE + ST / 2 + 1;
  for (const s of [-1, 1]) {
    box('concrete', -E - 1, 0, s * E - 0.5, E + 1, 7, s * E + 0.5, { color: 0x7a7a74, tile: [4, 7], solidH: 25.5 });
    box('concrete', s * E - 0.5, 0, -E - 1, s * E + 0.5, 7, E + 1, { color: 0x7a7a74, tile: [4, 7], solidH: 25.5 });
    box('hazard', -E, 5.4, s * E - s * 0.52 - 0.01, E, 6.0, s * E - s * 0.52 + 0.01, { tile: [2, 0.6] });
    box('hazard', s * E - s * 0.52 - 0.01, 5.4, -E, s * E - s * 0.52 + 0.01, 6.0, E, { tile: [2, 0.6] });
  }
  fill(-HALF, -HALF, HALF, -E, 25.5); fill(-HALF, E, HALF, HALF, 25.5); fill(-HALF, -HALF, -E, HALF, 25.5); fill(E, -HALF, HALF, HALF, 25.5);
  for (const [x, z, r] of [[0, -E + 0.6, Math.PI], [0, E - 0.6, 0], [-E + 0.6, 0, Math.PI / 2], [E - 0.6, 0, -Math.PI / 2], [-100, -E + 0.6, Math.PI], [100, E - 0.6, 0]]) addSign(x, 3.5, z, r, 'QUARANTINE ZONE  -  LETHAL FORCE AUTHORIZED', 9, 0.8, { bg: '#d8b020', fg: '#111' });
}

// ---------- textures that move ----------
function fireTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 100, 2, 32, 80, 60); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.3, 'rgba(255,150,40,0.9)'); gr.addColorStop(0.7, 'rgba(180,40,10,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(8, 128); g.quadraticCurveTo(0, 60, 32, 0); g.quadraticCurveTo(64, 60, 56, 128); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let smokeT = null;
function smokeTexture() {
  if (smokeT) return smokeT;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 18; i++) { const y = 128 - i * 7, r = 10 + i * 1.3, gr = g.createRadialGradient(32 + Math.sin(i) * 6, y, 0, 32 + Math.sin(i) * 6, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); }
  smokeT = new THREE.CanvasTexture(c); return smokeT;
}

// ---------- the map ----------
export function drawMap(g, size, marks = []) {
  const S = size / (HALF * 2), X = (x) => (x + HALF) * S;
  g.fillStyle = '#121416'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#2a2c30'; g.fillRect(X(-EDGE - ST / 2), X(-EDGE - ST / 2), (EDGE * 2 + ST) * S, (EDGE * 2 + ST) * S);
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) { g.fillStyle = '#4a4a48'; g.fillRect(X(blockMin(i)), X(blockMin(j)), 44 * S, 44 * S); }
  const col = { tower: '#6a6a6a', lot: '#3a3a3a', park: '#3a5a2a', shop: '#8a7a50', halcyon: '#5a8ab8', precinct: '#4a5a8a', hospital: '#b85a5a', apartment: '#8a5a3a' };
  for (const f of W.footprints) { g.fillStyle = col[f.kind] || '#6a6a6a'; g.fillRect(X(f.x0), X(f.z0), (f.x1 - f.x0) * S, (f.z1 - f.z0) * S); }
  g.strokeStyle = '#d8b020'; g.lineWidth = 2; g.strokeRect(X(-EDGE - ST / 2 - 1), X(-EDGE - ST / 2 - 1), (EDGE * 2 + ST + 2) * S, (EDGE * 2 + ST + 2) * S);
  g.font = `bold ${Math.max(10, size / 60)}px Arial`; g.textAlign = 'center'; g.fillStyle = '#e8e8e8';
  for (const m of marks) g.fillText(m.name, X(m.x), X(m.z));
}
void lining;
