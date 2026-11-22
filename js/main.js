// REMISSION — the game loop: Dr. Hale, the guns, the day and the night, the dead, the menus, the dying.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { W, buildCity, buildSigns, collide, groundY, indoorAt, setDoor, drawMap, solid, clearLine, raycast as worldRay, HALF } from './city.js';
import { createGore } from './gore.js';
import { createZombies, makeRig } from './zombies.js';
import { createWeapons, GUNS, ORDER } from './weapons.js';
import { createMass } from './boss.js';
import { createSurvival } from './survival.js';
import { createStory, NOTES, ENDINGS, DEATHS } from './story.js';
import * as TX from './tex.js';
import * as A from './audio.js';
import { voice } from './voice.js';
import { Input } from './input.js';
import { createGovernor } from '../perf.js';

const $ = (id) => document.getElementById(id);
const TEST = /[?&]test\b/.test(location.search);
const COARSE = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const SKEY = 'remission.settings', PKEY = 'remission.progress', SAVE = 'remission.save';
const settings = Object.assign({ vol: 0.8, voices: true, subs: true, sens: 1, invert: false, bright: 1, fov: 78, quality: COARSE ? 'low' : 'medium', gore: 60, pads: true, rumble: true, hitmarks: true, assist: true, autofire: true }, load(SKEY) || {});
const progress = Object.assign({ endings: {}, deaths: {}, total: 0, kills: 0, notes: {}, guns: {}, nights: 0, boss: 0, survBest: 0, coop: 0 }, load(PKEY) || {});
let save = load(SAVE);
const goreK = () => Math.max(0, Math.min(1, settings.gore / 100));
const goreName = (v) => v <= 0 ? 'Off' : v <= 30 ? 'Low' : v <= 60 ? 'Medium' : v <= 85 ? 'High' : 'Extreme';

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.info.autoReset = false; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x6a6a68, 0.012);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 220); camera.rotation.order = 'YXZ'; scene.add(camera);
const FX = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, fear: { value: 0 }, bright: { value: 1 }, flash: { value: 0 }, red: { value: 0 }, black: { value: 0 }, night: { value: 0 }, hurt: { value: 0 }, sick: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, fear, bright, flash, red, black, night, hurt, sick; varying vec2 vUv;
    vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); c *= 1.0 / 0.6; return clamp(O * rrt(I * c), 0.0, 1.0); }
    vec3 srgb(vec3 c){ return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308))); }
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv, c = uv - 0.5;
      float ab = 0.0008 + fear * 0.004 + hurt * 0.01;
      vec3 col = vec3(texture2D(tDiffuse, uv + c * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ab).b);
      col = srgb(aces(max(col * 1.2, 0.0)));
      col = pow(col, vec3(1.0 / bright));
      float l = dot(col, vec3(0.3, 0.59, 0.11));
      // a sick, washed-out city by day; blue-black by night, the lights staying warm
      col = mix(col, mix(vec3(l), col, 0.72) * vec3(1.03, 1.0, 0.94), 1.0 - night);
      col = mix(col, mix(col * vec3(0.78, 0.86, 1.12), col, smoothstep(0.06, 0.45, l)), night);
      col = mix(col, vec3(l) * vec3(0.9, 1.05, 0.85), sick * 0.5);
      col += (rnd(uv * vec2(1013.0, 717.0) + fract(time * 7.13)) - 0.5) * (0.025 + fear * 0.04 + night * 0.02);
      float v = smoothstep(0.9 - fear * 0.25, 0.2, length(c * vec2(1.0, 0.8)) * (1.0 + fear * 0.3));
      col *= mix(0.35, 1.0, v);
      float edge = smoothstep(0.25, 0.75, length(c * vec2(1.0, 0.8)));
      col = mix(col, vec3(0.35, 0.0, 0.0), red * edge + hurt * 0.25 * edge);
      col += vec3(1.0, 0.85, 0.7) * flash;
      col *= 1.0 - black;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
let gunPass = null; // added once the weapons exist
const fxPass = new ShaderPass(FX);
const U = fxPass.uniforms;

// sky: a dome that follows you; the sun and moon on it
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, moon: { value: new THREE.Vector3() }, night: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, hor, sun, sunCol, moon; uniform float night; varying vec3 vD;
    float rnd(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.55));
      float s = max(dot(vD, sun), 0.0); c += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 8.0) * 0.25);
      float m = max(dot(vD, moon), 0.0); c += vec3(0.7, 0.75, 0.85) * pow(m, 900.0) * 2.0 * night;
      if (night > 0.3 && h > 0.1) { vec3 q = floor(vD * 260.0); float st = step(0.997, rnd(q)); c += st * 0.5 * night * h; }
      gl_FragColor = vec4(c, 1.0); }`,
}));
sky.renderOrder = -1; scene.add(sky);

const hemi = new THREE.HemisphereLight(0xb8bcc4, 0x3a342c, 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffeedd, 2.2); sun.castShadow = true; scene.add(sun, sun.target);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 200 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
const flash = new THREE.SpotLight(0xfff0d8, 0, 34, 0.38, 0.45, 1.3); flash.position.set(0.18, -0.12, 0); camera.add(flash, flash.target); flash.target.position.set(0, -0.15, -5);
let POOL_N = 6;
const pool = Array.from({ length: 8 }, () => { const l = new THREE.PointLight(0xffc888, 0, 18, 2); scene.add(l); return l; });
let basePR = 1;
const gov = createGovernor({ apply: (s) => { renderer.setPixelRatio(basePR * s); composer.setPixelRatio(basePR * s); } });
const lamb = new Map();
function toLambert(on) {
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || o === sky) return;
    const m = o.material;
    if (on && m.isMeshStandardMaterial && !m.transparent) {
      let l = lamb.get(m);
      if (!l) { l = new THREE.MeshLambertMaterial({ map: m.map, color: m.color, vertexColors: m.vertexColors, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity }); l.userData.std = m; lamb.set(m, l); m.userData.lamb = l; }
      o.material = l;
    } else if (!on && m.isMeshLambertMaterial && m.userData.std) o.material = m.userData.std;
  });
}
let lambertOn = false;
function applyQuality() {
  const q = settings.quality, dpr = devicePixelRatio || 1;
  basePR = q === 'low' ? Math.min(dpr, 1) * (COARSE ? 0.6 : 0.75) : q === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
  POOL_N = q === 'low' ? (COARSE ? 2 : 3) : q === 'high' ? 8 : 6;
  pool.forEach((l, i) => { if (i >= POOL_N) l.intensity = 0; });
  renderer.setPixelRatio(basePR * gov.scale); composer.setPixelRatio(basePR * gov.scale);
  sun.castShadow = q !== 'low'; flash.castShadow = q === 'high';
  if ((q === 'low') !== lambertOn) { lambertOn = q === 'low'; toLambert(lambertOn); }
  const sm = q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; renderer.shadowMap.needsUpdate = true;
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); weapons?.resize(camera.aspect); }
addEventListener('resize', resize);

buildCity(scene); buildSigns(scene);
const gore = createGore(scene, (x, z) => groundY(x, z));
// blood on the streets: one instanced layer, shown by the gore level
const decals = (() => {
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: TX.splat(5), transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }), W.decals.length);
  const o = new THREE.Object3D();
  W.decals.forEach((d, i) => { o.position.set(d.x, groundY(d.x, d.z) + 0.012, d.z); o.rotation.set(0, d.rot, 0); o.scale.set(d.s, 1, d.s * (0.6 + (i % 5) * 0.15)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.renderOrder = 1; scene.add(m); return m;
})();
function applyGore() { const k = goreK(); decals.count = Math.round(W.decals.length * Math.min(1, k * 1.4)); decals.visible = k > 0; }

// ---------- Dr. Hale ----------
const P = { id: 'h', downed: false, dead: false, bleed: 0, shotN: 0, x: -3.2, z: 113.6, y: 0.15, yaw: Math.PI, pitch: 0, eye: 1.62, hp: 100, alive: true, stam: 1, vy: 0, airborne: false, sprinting: false, moving: 0, lit: false, indoors: false, medkits: 1, lookDir: new THREE.Vector3(), bob: 0, stepT: 0, healT: 0, hurtT: 0, lastHit: 0 };
const input = new Input(canvas);
input.pads = settings.pads; input.padSens = settings.sens; input.touchSens = settings.sens; input.rumbleOn = settings.rumble;
voice.on = settings.voices; A.setVolume(settings.vol);
let gameMode = 'story', holdT = 0, holdId = null;
let mode = 'warn', fear = 0, shakeT = 0, shakeK = 0, focus = null, T = 0, hour = 7.5, nightK = 0, readFrom = null, deathKind = null, mapOpen = false, fovPunch = 0, flashlight = false;
let boss = null;

const zombies = createZombies(scene, gore, {
  gore: goreK, player: () => P, players: () => (surv?.active() ? surv.players() : [P]),
  onAttack: (zb, dmg, who) => { const k = zb.kind === 'brute' ? 'growth' : nightK > 0.5 && zb.kind === 'runner' ? 'torn' : 'bitten'; if (!who || who === P) hurt(dmg, k, zb); else surv.hurtRemote(who.id, dmg, k, zb); },
  onKill: (zb, part, w) => { if (!w?.shooter || w.shooter === P.id) { progress.kills++; kills++; if (part === 'head') headshots++; } if (surv?.active()) surv.onKill(zb, w); else drop(zb); },
  sendHit: (...a) => surv.sendHit(...a),
  gib: (at, dir, n) => { if (goreK() >= 0.5) gore.gib(at, dir, Math.round(n * goreK())); },
  wallSplat: (pt, dir, g) => { const h = worldRay(pt.x, pt.y, pt.z, dir.x, dir.y * 0.3, dir.z, 3); if (h && h.ny < 0.5 && Math.random() < g) gore.splat(new THREE.Vector3(h.x, h.y, h.z), 0.3 + Math.random() * 0.5 * g, new THREE.Vector3(h.nx, 0, h.nz)); },
  onSpot: () => { fear = Math.min(1, fear + 0.15); },
});
let kills = 0, headshots = 0;
const weapons = createWeapons({
  camera, world: scene, zombies, gore,
  onNoise: (x, z, r) => { if (surv?.active() && !surv.isHost()) surv.sendNoise(x, z, r); else zombies.noise(x, z, r); },
  onShot: () => { P.shotN++; },
  onHitMarker: (head, dead) => hitMark(head, dead),
  extra: () => boss && !boss.S.dead ? [boss] : null,
});
gunPass = new RenderPass(weapons.scene, weapons.vmCam); gunPass.clear = false; gunPass.clearDepth = true; composer.addPass(gunPass);
composer.addPass(fxPass);
// Dr. Kaur, behind the glass in St. Agnes
const kaur = makeRig('walker', 3, 'kaur', true); kaur.root.position.set(W.marks.kaur.x, 0.15, W.marks.kaur.z); kaur.root.rotation.y = Math.PI; scene.add(kaur.root);
function kaurIdle() {
  const d = Math.hypot(P.x - W.marks.kaur.x, P.z - W.marks.kaur.z); kaur.root.visible = d < 60 && gameMode === 'story'; if (d > 25) return;
  const want = Math.atan2(P.x - W.marks.kaur.x, P.z - W.marks.kaur.z); kaur.root.rotation.y += (want - kaur.root.rotation.y) * 0.05;
  kaur.armL.up.rotation.set(-0.5 + Math.sin(T * 0.8) * 0.05, 0, 0.5); kaur.armR.up.rotation.set(-0.5, 0, -0.5); kaur.armL.lo.rotation.x = -1.6; kaur.armR.lo.rotation.x = -1.6;
  kaur.neck.rotation.x = talkQ ? Math.sin(T * 9) * 0.04 : 0.05; kaur.hips.position.y = 0.95 + Math.sin(T * 1.3) * 0.005;
}
P.onKnife = () => { const n = zombies.melee(P, P.lookDir, 2.0, 45); if (n) { A.impact(P, 'flesh'); input.rumble(0.4, 0.3, 80); } return n; };
applyQuality(); resize(); applyGore();

// ---------- HUD ----------
const ui = {
  subT: 0, toastT: 0, hintT: 0, objT: 0, chT: 0, hitT: 0,
  sub(text, dur = 4, kind = 'think') { if (!settings.subs && kind !== 'think') return; const e = $('sub'); e.innerHTML = text; e.className = 'on ' + kind; this.subT = dur; },
  toast(text) { const e = $('toast'); e.textContent = text; e.classList.add('on'); this.toastT = 3; },
  hint(text) { const e = $('hint'); e.textContent = text; e.classList.add('on'); this.hintT = 7; },
  objective(show = true) {
    const o = objective(); $('objMain').textContent = o.main; $('objSub').innerHTML = o.sub.map((s) => `<div>${s}</div>`).join('');
    if (show) { $('obj').classList.add('on'); this.objT = 6; }
  },
  chapter(text) { if (!text) return; $('chapter').textContent = text; $('chapter').classList.add('on'); this.chT = 4; },
  tick(dt) {
    if (this.subT > 0 && (this.subT -= dt) <= 0) $('sub').classList.remove('on');
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').classList.remove('on');
    if (this.hintT > 0 && (this.hintT -= dt) <= 0) $('hint').classList.remove('on');
    if (this.objT > 0 && (this.objT -= dt) <= 0) $('obj').classList.remove('on');
    if (this.chT > 0 && (this.chT -= dt) <= 0) $('chapter').classList.remove('on');
    if (this.hitT > 0 && (this.hitT -= dt) <= 0) $('hitmark').className = '';
  },
};
function hitMark(head, dead) { if (!settings.hitmarks) return; const e = $('hitmark'); e.className = 'on' + (head ? ' head' : '') + (dead ? ' kill' : ''); ui.hitT = 0.12; if (dead) input.rumble(0.2, 0.4, 60); }
const keyName = (what) => {
  if (input.padMode) return { use: input.label(0), reload: input.label(2), heal: input.label(5), knife: input.label(1), light: input.label(4), map: input.label(8) }[what];
  if (input.touchMode) return { use: 'USE', reload: 'R', heal: 'MED', knife: 'KNIFE', light: 'LIGHT', map: 'MAP' }[what];
  return { use: 'E', reload: 'R', heal: 'H', knife: 'V', light: 'F', map: 'M' }[what];
};
function setHud(on) { $('hud').hidden = !on; $('touch').classList.toggle('on', on && input.touchMode); }
function only(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
function updateHud() {
  const k = weapons.S.cur;
  $('ammo').innerHTML = k ? `<b>${weapons.S.mag[k]}</b><span>/ ${weapons.S.reserve[k]}</span>` : '';
  $('gunName').textContent = k ? `${GUNS[k].name} · ${GUNS[k].type}` : 'Unarmed · V knife';
  $('reloadTip').classList.toggle('on', !!k && weapons.S.mag[k] === 0 && weapons.S.reserve[k] === 0);
  $('slots').innerHTML = ORDER.map((g, i) => `<i class="${weapons.S.owned[g] ? 'own' : ''} ${g === k ? 'cur' : ''}">${i + 1}</i>`).join('');
  $('hpFill').style.width = Math.max(0, P.hp) + '%'; $('hpFill').classList.toggle('low', P.hp < 35);
  $('meds').textContent = '✚ ' + P.medkits;
  $('clock').textContent = clock();
  $('xhair').classList.toggle('aim', weapons.S.aim > 0.5);
  $('scope').classList.toggle('on', k === 'sniper' && weapons.S.aim > 0.9);
  compass();
}
const clock = () => { const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function compass() {
  const el = $('compass'), w = el.clientWidth || 400, yawDeg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360; // 0 = north (-z)
  let html = '';
  for (const [d, n] of [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']]) {
    let rel = ((d - yawDeg + 540) % 360) - 180; if (Math.abs(rel) > 90) continue;
    html += `<span class="${n.length === 1 ? 'big' : ''}" style="left:${(w / 2 + rel / 90 * w / 2).toFixed(0)}px">${n}</span>`;
  }
  const o = objective().at;
  if (o) {
    const bearing = (Math.atan2(o.x - P.x, -(o.z - P.z)) * 180 / Math.PI + 360) % 360, rel = ((bearing - yawDeg + 540) % 360) - 180, d = Math.hypot(o.x - P.x, o.z - P.z);
    html += `<em style="left:${(w / 2 + Math.max(-1, Math.min(1, rel / 90)) * w / 2).toFixed(0)}px">◆<small>${Math.round(d)} m</small></em>`;
  }
  el.innerHTML = html;
}
// ---------- the map ----------
const mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 900;
function openMap(on) {
  mapOpen = on; $('map').hidden = !on;
  if (!on) return;
  if (!mapBase.done) { mapBase.done = true; const M = W.marks; drawMap(mapBase.getContext('2d'), 900, [{ name: 'HALCYON', ...M.halcyonDoor }, { name: '9TH PRECINCT', x: -110, z: 0 }, { name: 'ST. AGNES', x: 112, z: -112 }, { name: 'HARROW COURT (HOME)', x: -112, z: -168 }, { name: 'PARK', x: 0, z: 18 }, { name: 'CHECKPOINT', x: M.checkpoint.x, z: M.checkpoint.z + 10 }]); }
  const c = $('mapC'), g = c.getContext('2d'), S = c.width / (HALF * 2), X = (v) => (v + HALF) * S;
  g.drawImage(mapBase, 0, 0, c.width, c.height);
  for (const p of pickups) if (!p.taken) { g.fillStyle = p.kind === 'med' ? '#e84a4a' : '#d8b040'; g.fillRect(X(p.x) - 2, X(p.z) - 2, 4, 4); }
  const o = objective().at;
  if (o) { g.fillStyle = '#ffd040'; g.beginPath(); g.arc(X(o.x), X(o.z), 7, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); }
  g.save(); g.translate(X(P.x), X(P.z)); g.rotate(-P.yaw); g.fillStyle = '#4ad8ff'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.fill(); g.restore();
  $('mapObj').textContent = objective().main + ' — ' + objective().sub[0];
}

// ---------- supplies ----------
const pickups = [];
const pickMat = { ammo: new THREE.MeshStandardMaterial({ map: TX.metal('ammob', 0x4a5a32, 61, 0.2), roughness: 0.6 }), med: new THREE.MeshStandardMaterial({ map: TX.sign('✚', { w: 64, h: 64, bg: '#e8e8e8', fg: '#c81818', font: 'bold 50px Arial' }), roughness: 0.5 }) };
const pickGeo = { ammo: new THREE.BoxGeometry(0.42, 0.24, 0.26), med: new THREE.BoxGeometry(0.34, 0.24, 0.12) };
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,220,0.8)'); gr.addColorStop(1, 'rgba(255,255,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const objective = () => (gameMode === 'survival' && surv.active() ? surv.objective() : story.objective());
let pickN = 1;
function addPickup(kind, x, z, y = null, temp = false, id = null) {
  const m = new THREE.Mesh(pickGeo[kind], pickMat[kind]); m.castShadow = true;
  const gy = y ?? groundY(x, z); m.position.set(x, gy + 0.3, z); scene.add(m);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: kind === 'med' ? 0xff8080 : 0xffe0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })); s.scale.setScalar(0.9); m.add(s);
  const p = { id: id ?? pickN++, kind, x, z, m, taken: false, temp, t: Math.random() * 6 }; pickups.push(p); return p;
}
function stockLoot(rnd = Math.random) {
  for (const p of [...pickups]) { scene.remove(p.m); } pickups.length = 0;
  W.loot.forEach((l, i) => { if (save?.lootTaken?.includes(i)) return; const r = rnd(); if (r < 0.18) return; const p = addPickup(r < 0.5 ? 'med' : 'ammo', l.x, l.z); p.spot = i; });
}
function removePickup(id) { const i = pickups.findIndex((p) => p.id === id); if (i < 0) return; scene.remove(pickups[i].m); pickups.splice(i, 1); }
function take(p) {
  if (gameMode === 'survival' && !surv.take(p)) return; // co-op: the host says who got it
  p.taken = true; scene.remove(p.m);
  if (p.spot !== undefined && save) { (save.lootTaken ||= []).push(p.spot); }
  applyPickup(p.kind);
}
function applyPickup(kind) {
  A.pickup();
  if (kind === 'med') { P.medkits = Math.min(5, P.medkits + 1); ui.toast('+1 MEDKIT'); return; }
  const own = ORDER.filter((k) => weapons.S.owned[k]);
  if (!own.length) { P.medkits = Math.min(5, P.medkits + 1); ui.toast('+1 MEDKIT'); return; }
  // the gun you're lowest on, by how many magazines you have left
  own.sort((a, b) => weapons.S.reserve[a] / GUNS[a].mag - weapons.S.reserve[b] / GUNS[b].mag);
  const k = Math.random() < 0.6 ? own[0] : own[(Math.random() * own.length) | 0], n = k === 'minigun' ? 120 : k === 'sniper' ? 5 : GUNS[k].mag * 1.5 | 0;
  weapons.addAmmo(k, n); ui.toast(`+${n} ${GUNS[k].name.toUpperCase()} AMMO`);
}
function drop(zb) {
  const r = Math.random(), armed = ['cop', 'soldier', 'guard'].includes(zb.outfit);
  if (r < (armed ? 0.55 : 0.08)) addPickup('ammo', zb.x, zb.z, null, true); else if (r < (armed ? 0.65 : 0.115)) addPickup('med', zb.x, zb.z, null, true);
}

// ---------- story glue ----------
let talkQ = null;
const g = {
  P,
  objective: (show) => ui.objective(show),
  chapterCard: (t) => { ui.chapter(t); A.presence(0.25, 3); },
  checkpoint: () => checkpoint(),
  spawn: (kind, x, z, o) => zombies.spawn(kind, x, z, o),
  corpse: (x, z, h, outfit, o) => zombies.corpse(x, z, h, outfit, o),
  give: (k) => { if (weapons.give(k)) { progress.guns[k] = 1; } },
  ammo: (k, n) => weapons.addAmmo(k, n),
  toast: (t) => ui.toast(t), hint: (t) => ui.hint(t),
  say: (who, text, dur = 3.5) => { ui.sub(`<b>${who === 'HALE' ? 'You' : who === 'MARA' ? 'Mara' : who === 'NOAH' ? '???' : who}:</b> ${text}`, dur, who === 'HALE' ? 'think' : 'voice'); voice.say(who, text); },
  talk: (lines, done) => playLines(lines, done, false),
  radio: (lines, done) => playLines(lines, done, true),
  note: (id) => openNote(id),
  door: (id, open) => setDoor(id, open),
  sfx: (k) => { if (k === 'door') A.doorSound(P, true, false); },
  scare: (zb, k = 1) => scare(zb, k),
  lightsOut: (x, z, r, sec) => lightsOut(x, z, r, sec),
  whisper: () => A.whisper({ x: P.x + Math.sin(P.yaw) * 1.5, y: 1.6, z: P.z + Math.cos(P.yaw) * 1.5 }, 0, 1.2, 0.2),
  noah: (x, z, o) => noah(x, z, o),
  noahBehind: () => noahBehind(),
  horde: (n, rf) => horde(n, rf),
  floodlights: () => { A.siren(P, 4); A.carAlarm(P, 3); for (const f of W.fixtures) if (f.kind === 'flood') f.on = true; ui.hint('The floodlights came on. Everything for blocks heard that.'); zombies.noise(P.x, P.z, 120); },
  boss: (dead) => startBoss(dead),
  liveNear: (r) => zombies.list.filter((z) => z.state !== 'dead' && z.kind !== 'child' && Math.hypot(z.x - P.x, z.z - P.z) < r).length,
  choice: () => { mode = 'choice'; input.unlock(); only('choice'); setHud(false); },
};
const story = createStory(g);
function playLines(lines, done, radio) {
  talkQ = { lines: [...lines], done, radio, t: 0 };
  if (radio) A.squelch();
  nextLine();
}
function nextLine() {
  if (!talkQ) return;
  const l = talkQ.lines.shift();
  if (!l) { const d = talkQ.done, wasRadio = talkQ.radio; talkQ = null; if (wasRadio) A.squelch(); A.radioHiss(0); d?.(); return; }
  const [who, text] = l, dur = Math.max(2.6, text.split(' ').length * 0.36 + 0.8);
  const name = who === 'HALE' ? 'You' : who === 'KAUR' ? 'Dr. Kaur' : who === 'NARRATOR' ? '' : who === 'MARA' ? 'Mara' : who;
  ui.sub(name ? `<b>${name}:</b> ${text}` : `<i>${text}</i>`, dur + 0.3, talkQ.radio && who !== 'HALE' ? 'radio' : who === 'HALE' ? 'think' : 'voice');
  if (who !== 'NARRATOR') voice.say(who, text);
  talkQ.t = dur;
}
function skipLine() { if (talkQ) { voice.cancel(); talkQ.t = 0; } }

// ---------- scares ----------
function scare(zb, k = 1) {
  A.sting(0.55 * k); shakeT = 0.5; shakeK = 0.5 * k; fovPunch = 8 * k; fear = Math.min(1, fear + 0.6 * k); input.rumble(0.8 * k, 0.6, 250);
  if (zb) { zb.state = 'chase'; zb.seen = 1; zb.atkCd = 0.6; }
}
const lightsOff = [];
function lightsOut(x, z, r, sec) { lightsOff.push({ x, z, r, t: sec }); A.flicker({ x, y: 3, z }); }
const apparitions = [];
function noah(x, z, o = {}) {
  const zb = zombies.spawn('child', x, z, { outfit: 'noah', scripted: true, noDespawn: true, scale: 0.62 });
  zb.heading = Math.atan2(P.x - x, P.z - z); zb.state = 'idle';
  apparitions.push({ zb, t: o.dur || 2.5, face: o.face });
  if (o.giggle) A.giggle(zb.R.root.position, 0.2, 0);
  if (o.face) A.whisper(zb.R.root.position, 0, 1.4, 0.25);
  return zb;
}
function noahBehind() {
  const x = P.x - Math.sin(P.yaw) * -1.8, z = P.z - Math.cos(P.yaw) * -1.8; // yaw 0 looks at -z, so behind is +z
  if (solid(x, z)) return;
  const zb = noah(x, z, { dur: 6 }); apparitions[apparitions.length - 1].behind = true;
  A.whisper(zb.R.root.position, 0, 1.6, 0.3);
  setTimeout(() => { if (zb.R.root.parent) { ui.sub('<b>???:</b> Doctor Hale? Am I better now?', 3.5, 'ghost'); voice.say('NOAH', 'Doctor Hale? Am I better now?'); } }, 700);
}
function updateApparitions(dt) {
  for (let i = apparitions.length - 1; i >= 0; i--) {
    const a = apparitions[i], zb = a.zb; a.t -= dt;
    const dx = zb.x - P.x, dz = zb.z - P.z, d = Math.hypot(dx, dz), looking = (dx * P.lookDir.x + dz * P.lookDir.z) / (d || 1);
    zb.heading = Math.atan2(-dx, -dz);
    if (a.behind && looking > 0.75 && !a.seen) { a.seen = true; a.t = 0.25; A.sting(0.7); fovPunch = 10; shakeT = 0.4; shakeK = 0.6; fear = 1; }
    if (!a.behind && (d < 5 || (looking > 0.9 && a.t < (a.dur0 ??= a.t) - 1.2))) a.t = Math.min(a.t, 0.15);
    if (a.t <= 0) { zombies.removeBody(zb); apparitions.splice(i, 1); A.whisper(zb.R.root.position, 0, 0.6, 0.12); }
  }
}
function horde(n, rf = 0.3) {
  let made = 0;
  for (let tries = 0; tries < n * 8 && made < n; tries++) {
    const a = Math.random() * 6.283, d = 20 + Math.random() * 16, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    if (solid(x, z) || indoorAt(x, z) || Math.abs(x) > 200 || Math.abs(z) > 200) continue;
    zombies.spawn(Math.random() < rf ? 'runner' : 'walker', x, z, { state: 'chase', scripted: true }); made++;
  }
}
// night: things in the dark (on a timer, never two close together)
let creepT = 70;
function nightEvents(dt) {
  if (nightK < 0.6 || P.indoors || mode !== 'play' || talkQ || (gameMode === 'story' && story.S.step < 2)) { creepT = Math.max(creepT, 25); return; }
  if ((creepT -= dt) > 0) return;
  creepT = 55 + Math.random() * 60;
  const r = Math.random();
  if (r < 0.3) { // something under the car you're passing
    const c = W.cars.find((c) => Math.hypot(c.x - P.x, c.z - P.z) < 7 && !c.used);
    if (c) { c.used = true; const a = Math.atan2(P.x - c.x, P.z - c.z); const zb = zombies.spawn('crawler', c.x + Math.sin(a) * 1.3, c.z + Math.cos(a) * 1.3, { state: 'chase', scripted: true }); zb.heading = a; scare(zb, 0.8); A.carAlarm(c, 4); return; }
  }
  if (r < 0.55) { // behind you, fast
    const x = P.x + Math.sin(P.yaw) * 9, z = P.z + Math.cos(P.yaw) * 9;
    if (!solid(x, z)) { const zb = zombies.spawn('runner', x, z, { state: 'chase', scripted: true, sprint: 1 }); zb.heading = Math.atan2(P.x - x, P.z - z); A.whisper({ x: P.x + Math.sin(P.yaw) * 2, y: 1.6, z: P.z + Math.cos(P.yaw) * 2 }, 0, 1.0, 0.22); return; }
  }
  if (r < 0.75 && (gameMode === 'story' ? story.S.step >= 6 : surv.R.night >= 2)) { // him, down the street
    const x = P.x - Math.sin(P.yaw) * 26, z = P.z - Math.cos(P.yaw) * 26;
    if (!solid(x, z) && !indoorAt(x, z)) { noah(x, z, { dur: 4, giggle: true }); return; }
  }
  // the radio, on its own
  A.radioHiss(0.8); setTimeout(() => A.radioHiss(0), 2600);
  const lines = ['Doctor Hale? It\'s dark here.', 'You said it wouldn\'t hurt.', 'Am I better now?', 'I can hear all of them. They\'re all so hungry.'];
  const t = lines[(Math.random() * lines.length) | 0];
  ui.sub(`<b>Radio:</b> ${t}`, 3.5, 'ghost'); voice.say('NOAH', t);
}

// ---------- the boss ----------
function startBoss(dead) {
  if (boss) { boss.remove(); boss = null; }
  boss = createMass(scene, gore, {
    gore: goreK, player: () => P, shake: (k) => { shakeT = 0.4; shakeK = k; },
    gib: (at, dir, n) => { if (goreK() >= 0.5) gore.gib(at, dir, Math.round(n * goreK())); },
    onAttack: (d) => hurt(d, 'mass'), spawn: (k, x, z, o) => zombies.spawn(k, x, z, o),
    onTumour: (left) => ui.toast(left ? `${left} LEFT` : 'IT OPENS'),
    onOpen: () => { ui.sub('<b>???:</b> Doctor Hale. You came back for me.', 4, 'ghost'); voice.say('NOAH', 'Doctor Hale. You came back for me.'); },
    onDefeat: () => { progress.boss = 1; persist(); for (const z of zombies.list) if (z.state !== 'dead' && z.scripted && Math.hypot(z.x - P.x, z.z - P.z) < 25) zombies.damage(z, 'torso', 9999, new THREE.Vector3(0, 0, 1), new THREE.Vector3(z.x, 1, z.z)); setTimeout(() => story.go(11), 2500); },
  });
  if (dead) boss.finishDead();
}

// ---------- notes ----------
function openNote(id) {
  const n = NOTES[id]; if (!n) return;
  story.S.notes[id] = 1; progress.notes[id] = 1;
  readFrom = mode; mode = 'read'; input.unlock(); A.paper();
  $('noteTitle').textContent = n.title; $('noteBody').innerHTML = n.html; only('note');
}
function closeNote() { only(null); mode = readFrom === 'paused' ? 'paused' : 'play'; if (mode === 'paused') only('pause'); else input.lock(); readFrom = null; persist(); }

// ---------- getting hurt ----------
function hurt(dmg, kind, zb) {
  if (!P.alive || P.downed || P.dead || !(mode === 'play' || (mode === 'paused' && surv.online()))) return;
  if (TEST && window.__god) dmg = 0;
  P.hp -= dmg; P.hurtT = 0.4; P.lastHit = 0; shakeT = 0.25; shakeK = 0.35;
  U.red.value = Math.min(1, U.red.value + dmg / 30);
  A.bite(P); input.rumble(0.9, 0.5, 200);
  if (zb && goreK() > 0.5 && Math.random() < goreK()) { $('bloodFX').classList.add('on'); setTimeout(() => $('bloodFX').classList.remove('on'), 400 + goreK() * 900); }
  if (zb) { const dx = P.x - zb.x, dz = P.z - zb.z, d = Math.hypot(dx, dz) || 1; P.x += dx / d * 0.35; P.z += dz / d * 0.35; }
  if (P.hp <= 0) { if (gameMode === 'survival') { P.hp = 0; surv.downLocal(kind); } else die(kind); }
}
function die(kind) {
  P.alive = false; P.hp = 0; deathKind = kind; mode = 'dying'; T = 0;
  progress.total++; progress.deaths[kind] = 1; persist();
  A.roar(P, 0.5); A.spin(0); voice.cancel(); talkQ = null;
}
function showDeath() {
  const D = DEATHS[deathKind] || DEATHS.bitten;
  $('deadTitle').textContent = D.title; $('deadLine').textContent = ['Nine days was all you had left anyway.', 'The city keeps you.', 'Another one for the street.', 'You don\'t stay down for long.'][progress.total % 4];
  $('deadLearn').textContent = D.learn; $('deadCount').textContent = `Died ${progress.total} time${progress.total === 1 ? '' : 's'}`;
  only('dead'); setHud(false); input.unlock(); mode = 'dead';
}

// ---------- saving ----------
function snapshot() {
  return { step: story.S.step, flags: { ...story.S.flags, holdT: story.S.flags.holdT }, notes: { ...story.S.notes }, talked: { ...story.S.talked }, guns: weapons.snapshot(), medkits: P.medkits,
    hp: Math.max(P.hp, 70), pos: { x: P.x, z: P.z, yaw: P.yaw }, hour, lootTaken: [...(save?.lootTaken || [])], kills };
}
function checkpoint() { if (!save) save = {}; const s = snapshot(); s.lootTaken = save.lootTaken || []; save = s; persist(); const e = $('saved'); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
function persist() { store(SAVE, save); store(PKEY, progress); syncSave(); }
function resetWorld() {
  zombies.clear(); gore.clear(); if (boss) { boss.remove(); boss = null; }
  for (const a of apparitions) zombies.removeBody(a.zb); apparitions.length = 0;
  for (const d of W.doors) setDoor(d.id, false);
  for (const f of W.fixtures) if (f.kind === 'flood') f.on = false;
  lightsOff.length = 0; talkQ = null; voice.cancel();
}
function startFrom(s) {
  if (surv.active() || surv.net) surv.leave(false);
  gameMode = 'story'; P.downed = false; P.dead = false; zombies.S.puppet = false;
  resetWorld();
  save = s ? JSON.parse(JSON.stringify(s)) : null;
  story.S.step = s ? s.step : 0; story.S.flags = s ? { ...s.flags } : {}; story.S.notes = s ? { ...s.notes } : {}; story.S.talked = s ? { ...s.talked } : {};
  weapons.restore(s ? s.guns : { owned: { pistol: false, smg: false, rifle: false, sniper: false, minigun: false }, mag: {}, reserve: {}, cur: null });
  if (!s) for (const k of ORDER) { weapons.S.mag[k] = 0; weapons.S.reserve[k] = 0; }
  P.medkits = s ? s.medkits : 1; P.hp = s ? s.hp : 100; P.alive = true; P.vy = 0; P.stam = 1;
  if (s) { P.x = s.pos.x; P.z = s.pos.z; P.yaw = s.pos.yaw; hour = s.hour; kills = s.kills || 0; } else { P.x = W.marks.wake.x; P.z = W.marks.wake.z; P.yaw = Math.PI * 0.75; hour = 7.4; kills = 0; }
  P.pitch = 0; P.y = groundY(P.x, P.z);
  if (!save) save = { lootTaken: [] };
  if (story.S.flags.armoryOpen) setDoor('armory', true);
  if (story.S.flags.storageOpen) setDoor('storage', true);
  if (story.S.flags.gusDone) story.S.gus = null;
  stockLoot();
  story.enter(story.S.step);
  if (story.S.step === 5) { story.S.flags.holdT = Math.max(15, story.S.flags.holdT || 30); g.horde(6, 0.3); }
  if (story.S.step === 12 && story.S.talked.k2) story.S.talked.k2 = false;
  if (!s) { save = snapshot(); save.lootTaken = []; persist(); }
  mode = 'play'; only(null); setHud(true); input.lock(); A.initAudio();
  U.black.value = 1; fear = 0; U.red.value = 0;
  ui.objective(true);
  if (!s) { ui.chapter(story.CH_TITLES[1]); setTimeout(() => g.say('HALE', 'My office. How long was I out? ... My arm.', 4), 1800); setTimeout(() => ui.hint(input.touchMode ? 'Left thumb: move · drag on the right: look · tap USE (or the prompt) to use' : input.padMode ? 'Left stick: move · right stick: look · ' + keyName('use') + ' use · ' + keyName('light') + ' flashlight' : `WASD move · mouse look · ${keyName('use')} use · ${keyName('light')} flashlight · ${keyName('map')} map`), 5000); }
}
function newGame() { mode = 'intro'; only('card'); setHud(false); A.initAudio(); introT = 0; introI = 0; showIntro(); }
let introT = 0, introI = 0;
const INTRO = [
  ['HALCYON BIOTECH', 'Trial REM-7. A cure for cancer.'],
  ['DAY 19', 'Twelve patients. Twelve remissions.'],
  ['DAY 31', 'Patient 0104 died at 3:10 a.m. At 3:52 she sat up.'],
  ['DAY 40', 'The army sealed the city.'],
  ['DAY 49', 'Dr. Adrian Hale wakes up on the floor of his office.'],
];
function showIntro() { const [a, b] = INTRO[introI]; $('cardTime').textContent = a; $('cardSub').textContent = b; $('cardTime').style.animation = 'none'; $('cardSub').style.animation = 'none'; void $('cardTime').offsetWidth; $('cardTime').style.animation = ''; $('cardSub').style.animation = ''; }
function endIntro() { store('remission.seenIntro', 1); startFrom(null); }

function ending(id) {
  const E = ENDINGS[id]; progress.endings[id] = 1; persist();
  save = null; store(SAVE, null);
  mode = 'ending'; setHud(false); input.unlock(); only('ending');
  $('endTitle').textContent = E.title; $('endLines').innerHTML = E.lines.map((l, i) => `<p style="animation-delay:${1 + i * 2.6}s">${l}</p>`).join('');
  $('endFoot').style.animationDelay = (2 + E.lines.length * 2.6) + 's';
  $('endWhich').textContent = `${E.foot} Endings found: ${Object.keys(progress.endings).length} of 2 · zombies put down: ${progress.kills}`;
}

// ---------- day and night ----------
const C_DAY = { top: new THREE.Color(0x8a9098), hor: new THREE.Color(0xb8b0a0), fog: new THREE.Color(0x8a8678) };
const C_DUSK = { top: new THREE.Color(0x3a3448), hor: new THREE.Color(0xc0683a), fog: new THREE.Color(0x5a4038) };
const C_NIGHT = { top: new THREE.Color(0x05070c), hor: new THREE.Color(0x10141c), fog: new THREE.Color(0x07090e) };
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _sd = new THREE.Vector3();
function dayNight(dt) {
  if ((mode === 'play' || (mode === 'paused' && surv.online())) && !(surv.active() && !surv.isHost())) hour = (hour + dt / 50) % 24; // a game hour is 50 seconds: a whole day in 20 minutes
  const a = (hour - 6) / 24 * Math.PI * 2, elev = Math.sin(a);
  _sd.set(Math.cos(a) * 0.8, elev, 0.45).normalize();
  const dayK = THREE.MathUtils.smoothstep(elev, -0.12, 0.25), duskK = Math.max(0, 1 - Math.abs(elev - 0.02) / 0.22) * (1 - Math.abs(dayK - 0.5) * 0.4);
  nightK = 1 - dayK;
  _c1.copy(C_NIGHT.top).lerp(C_DAY.top, dayK).lerp(C_DUSK.top, duskK * 0.6); _c2.copy(C_NIGHT.hor).lerp(C_DAY.hor, dayK).lerp(C_DUSK.hor, duskK * 0.7); _c3.copy(C_NIGHT.fog).lerp(C_DAY.fog, dayK).lerp(C_DUSK.fog, duskK * 0.6);
  const sm = sky.material.uniforms; sm.top.value.copy(_c1); sm.hor.value.copy(_c2); sm.sun.value.copy(_sd); sm.sunCol.value.setRGB(1, 0.75 + dayK * 0.2, 0.5 + dayK * 0.4).multiplyScalar(dayK); sm.moon.value.copy(_sd).negate(); sm.night.value = nightK;
  scene.fog.color.copy(_c3); scene.fog.density = 0.011 + nightK * 0.021 + (P.indoors ? 0.01 : 0);
  renderer.setClearColor(_c3);
  const ind = P.indoors ? 0.18 : 1;
  // the sun by day, the moon by night (the same light, moved and recoloured)
  const moonK = THREE.MathUtils.smoothstep(-elev, 0.05, 0.3);
  if (elev > -0.05) { sun.position.copy(_sd); sun.color.setRGB(1, 0.85 + dayK * 0.1, 0.7 + dayK * 0.25); sun.intensity = Math.max(0, elev) * 3.2 * ind; }
  else { sun.position.copy(_sd).negate(); sun.color.setRGB(0.55, 0.65, 0.95); sun.intensity = moonK * 0.55 * ind; }
  sun.position.multiplyScalar(80).add(_v.set(P.x, 0, P.z)); sun.target.position.set(P.x, 0, P.z);
  hemi.intensity = (0.3 + dayK * 1.0) * (P.indoors ? 0.45 : 1); hemi.color.copy(_c1).lerp(_c2, 0.5).offsetHSL(0, -0.1, 0.15);
  // tower windows and streetlamps come on
  for (const k of ['facGrey', 'facBrick', 'facBeige', 'facGlass', 'facBrown', 'facDark', 'facLab', 'facHosp', 'facCop']) { const m = W.mats[k]; m.emissiveIntensity = nightK * 0.6; if (m.userData.lamb) m.userData.lamb.emissiveIntensity = nightK * 0.6; }
  W.mats.lampOn.emissiveIntensity = nightK * 3; if (W.mats.lampOn.userData.lamb) W.mats.lampOn.userData.lamb.emissiveIntensity = nightK * 3;
  zombies.setEyes(nightK);
  camera.far = 90 + dayK * 130; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  weapons.setLight(sun.color, Math.max(0.3, sun.intensity / ind) * (P.indoors ? 0.3 : 0.6), 0.75 + dayK * 0.7 * (P.indoors ? 0.5 : 1), flashlight);
  U.night.value = nightK;
  if (nightK > 0.95 && !progress.nightSeen) { progress.nightSeen = 1; progress.nights++; }
}
const _v = new THREE.Vector3();

// ---------- the nearest lights get real light ----------
let lightT = 0;
const lit = [];
function updateLights(dt) {
  lightT -= dt;
  if (lightT <= 0) {
    lightT = 0.25; lit.length = 0;
    for (const f of W.fixtures) {
      if (!f.on || (f.kind === 'lamp' && nightK < 0.3)) continue;
      const d = Math.hypot(f.x - P.x, f.z - P.z); if (d > 45) continue;
      const inF = indoorAt(f.x, f.z), same = (inF && inF === indoorAt(P.x, P.z)) ? 0 : inF ? 25 : 0;
      lit.push({ f, s: d + same + (f.kind === 'lamp' ? 6 : 0) });
    }
    lit.sort((a, b) => a.s - b.s); lit.length = Math.min(lit.length, POOL_N);
  }
  for (let i = 0; i < pool.length; i++) {
    const L = pool[i], e = lit[i]; if (!e || i >= POOL_N) { L.intensity = 0; continue; }
    const f = e.f; L.position.set(f.x, f.y, f.z); L.color.set(f.color); L.distance = f.dist;
    let k = 1; if (f.flick) k = f.kind === 'fire' ? 0.75 + Math.random() * 0.4 : Math.random() < f.flick * 0.05 ? 0.1 : 1;
    for (const o of lightsOff) if (Math.hypot(f.x - o.x, f.z - o.z) < o.r) k = 0;
    const base = f.kind === 'lamp' ? 30 * nightK : f.kind === 'fire' ? 45 : f.kind === 'flood' ? 90 : 16;
    L.intensity = base * k;
  }
  for (let i = lightsOff.length - 1; i >= 0; i--) if ((lightsOff[i].t -= dt) <= 0) { lightsOff.splice(i, 1); A.flicker(P); }
  // fires
  for (const f of W.fires) { if (!f.sprite) continue; const s = 2.2 + Math.random() * 0.5; f.sprite.scale.set(s, s * 1.25, 1); f.sprite.material.opacity = 0.75 + Math.random() * 0.25; f.smoke.position.y += (f.y + 6 + Math.sin(T * 0.5 + f.x) * 0.5 - f.smoke.position.y) * 0.1; }
}

// ---------- the frame ----------
let last = performance.now(), holdUse = 0;
const prof = { upd: 0, ren: 0, n: 0, calls: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.max(0, (now - last) / 1000); last = now;
  const dt = Math.min(0.05, raw); T += dt; U.time.value = T;
  gov.tick(raw);
  input.pollPad(dt);
  const pad = input.pad;
  const t0 = performance.now();
  if (pad?.pause || input.hit('Escape')) {
    if (mode === 'play') { if (mapOpen) openMap(false); else pause(true); }
    else if (mode === 'paused' && !$('pause').hidden) pause(false);
    else if (mode === 'read') closeNote();
  }
  if (mode === 'intro') {
    introT += dt;
    if (introT > 3.6 || input.hit('KeyE', 'Space', 'Enter') || input.lmbHit || pad?.a) { introT = 0; introI++; if (introI >= INTRO.length) endIntro(); else showIntro(); }
  }
  if (mode === 'read' && (input.hit('KeyE', 'Enter') || pad?.a || pad?.b)) closeNote();
  if (mode === 'play') play(dt, pad);
  if (mode === 'dying') { T += 0; P.eye = Math.max(0.3, P.eye - dt * 1.6); U.black.value = Math.min(1, U.black.value + dt * 0.7); camera.rotation.z += dt * 0.8; zombies.update(dt, ctxZ()); if (U.black.value >= 1) showDeath(); }
  if (mode !== 'dying' && mode !== 'dead') P.eye = 1.62;
  // fades
  if (mode === 'play') U.black.value = Math.max(0, U.black.value - dt * 0.8);
  U.red.value = Math.max(0, U.red.value - dt * 0.9);
  U.hurt.value = Math.max(0, 1 - P.hp / 45) * (P.alive ? 1 : 0);
  U.fear.value += (fear - U.fear.value) * Math.min(1, dt * 3); fear = Math.max(0, fear - dt * 0.12);
  U.bright.value = settings.bright;
  U.sick.value = story.S.step >= 9 ? 0.4 : 0;
  // co-op doesn't stop when you open the menu
  if (mode === 'paused' && surv.online()) { zombies.update(dt, ctxZ()); surv.update(dt); }
  dayNight(mode === 'play' || (mode === 'paused' && surv.online()) ? dt : 0);
  updateLights(dt);
  gore.update(dt);
  ui.tick(dt);
  if (talkQ && (talkQ.t -= dt) <= 0) nextLine();
  if (talkQ) A.radioHiss(talkQ.radio ? 0.35 : 0);
  input.endFrame();
  const t1 = performance.now();
  renderer.info.reset();
  if (sun.castShadow) renderer.shadowMap.needsUpdate = true;
  composer.render();
  const t2 = performance.now(); prof.upd += t1 - t0; prof.ren += t2 - t1; prof.n++; prof.calls += renderer.info.render.calls;
}
const ctxZ = () => ({ night: nightK, indoors: P.indoors, chapter: story.chapter(), far: camera.far * 0.8, max: settings.quality === 'low' ? (COARSE ? 12 : 18) : settings.quality === 'high' ? 34 : 26 });

function play(dt, pad) {
  const surv_ = gameMode === 'survival';
  // out of it (survival): watch through a friend's eyes until dawn
  if (P.dead) {
    const sp = surv.spectate();
    if (sp) { camera.position.set(sp.x, sp.y + 1.62, sp.z); camera.rotation.set(sp.pitch, sp.yaw, 0); P.x += (sp.x - P.x) * 0.1; P.z += (sp.z - P.z) * 0.1; }
    camera.getWorldDirection(P.lookDir); P.lookDir.y = 0; P.lookDir.normalize();
    A.setListener(camera.position, P.lookDir);
    zombies.update(dt, ctxZ()); surv.update(dt); updateApparitions(dt); updateHud();
    $('prompt').innerHTML = ''; return;
  }
  // look
  const sens = 0.0022 * settings.sens * (1 - weapons.S.aim * (1 - (weapons.S.cur ? GUNS[weapons.S.cur].fov : 1)) * 0.8);
  P.yaw -= input.dx * sens; P.pitch -= input.dy * sens * (settings.invert ? -1 : 1);
  P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
  // move
  let mx = 0, mz = 0;
  if (input.down('KeyW', 'ArrowUp')) mz += 1; if (input.down('KeyS', 'ArrowDown')) mz -= 1;
  if (input.down('KeyA', 'ArrowLeft')) mx -= 1; if (input.down('KeyD', 'ArrowRight')) mx += 1;
  if (pad) { mx += pad.mx; mz += pad.mz; }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const wantRun = (input.down('ShiftLeft', 'ShiftRight') || pad?.run) && mz > 0.3 && P.stam > 0.05 && weapons.S.aim < 0.3 && !P.downed;
  P.sprinting = wantRun && ml > 0.2;
  const G = weapons.S.cur ? GUNS[weapons.S.cur] : null;
  const speed = P.downed ? 0.7 : (P.sprinting ? 6.8 : 4.1) * (G?.moveMul || 1) * (1 - weapons.S.aim * 0.4) * (weapons.S.cur === 'minigun' && weapons.S.spin > 0.5 ? 0.8 : 1);
  P.stam = Math.max(0, Math.min(1, P.stam + (P.sprinting ? -dt / 6 : dt / 4)));
  const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
  const vx = (-s * mz + c * mx) * speed, vz = (-c * mz - s * mx) * speed;
  P.x += vx * dt; P.z += vz * dt;
  collide(P, 0.35);
  P.moving = Math.min(1, ml) * (P.sprinting ? 1.5 : 1);
  // jump
  const gy = groundY(P.x, P.z);
  if ((input.hit('Space') || (pad?.jump && !focus)) && !P.airborne && !P.downed) { P.vy = 4.3; P.airborne = true; }
  if (P.airborne) { P.vy -= 13 * dt; P.y += P.vy * dt; if (P.y <= gy) { P.y = gy; P.airborne = false; P.vy = 0; A.step(P, 'concrete', 0.3); } }
  else P.y += (gy - P.y) * Math.min(1, dt * 15);
  // steps (and the dead hear them)
  if (ml > 0.2 && !P.airborne) {
    P.stepT -= dt * speed / 1.9;
    if (P.stepT <= 0) { P.stepT = 1; A.step(P, P.indoors ? 'tile' : 'concrete', P.sprinting ? 0.32 : 0.16); if (P.sprinting) weaponsNoise(P.x, P.z, 11); }
  }
  P.indoors = !!indoorAt(P.x, P.z);
  // camera
  P.eye += ((P.downed ? 0.45 : 1.62) - P.eye) * Math.min(1, dt * 5);
  P.bob += dt * (ml > 0.2 ? (P.sprinting ? 13 : 9) : 0);
  const bob = ml > 0.2 && !P.airborne ? Math.sin(P.bob) * (P.sprinting ? 0.05 : 0.025) : 0;
  let shx = 0, shy = 0; if (shakeT > 0) { shakeT -= dt; shx = (Math.random() - 0.5) * shakeK * 0.08; shy = (Math.random() - 0.5) * shakeK * 0.08; }
  camera.position.set(P.x, P.y + P.eye + bob, P.z);
  camera.rotation.set(P.pitch + weapons.S.kickPitch + shy, P.yaw + shx, Math.sin(P.bob * 0.5) * (P.sprinting ? 0.012 : 0) + (P.downed ? 0.25 : 0));
  camera.getWorldDirection(P.lookDir); P.lookDir.y = 0; P.lookDir.normalize();
  fovPunch *= Math.max(0, 1 - dt * 5);
  const aimF = weapons.S.cur ? 1 - weapons.S.aim * (1 - GUNS[weapons.S.cur].fov) : 1;
  camera.fov = settings.fov * aimF + fovPunch + (P.sprinting ? 4 : 0); camera.updateProjectionMatrix();
  A.setListener(camera.position, P.lookDir);
  // flashlight
  if (input.hit('KeyF') || pad?.light) { flashlight = !flashlight; A.click(0.3); }
  flash.intensity = flashlight ? 60 : 0; P.lit = flashlight;
  // weapons
  const I = {
    fire: input.lmb || !!pad?.fire, fireHit: input.lmbHit || !!pad?.fireHit, aim: input.rmb || !!pad?.aim,
    reloadHit: input.hit('KeyR') || !!pad?.reload, knifeHit: input.hit('KeyV') || input.mmbHit || !!pad?.knife,
    swap: (pad?.swap || pad?.next ? 1 : 0) - (pad?.prev ? 1 : 0) + (input.hit('KeyQ') ? 1 : 0) + wheel,
    slot: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].findIndex((k) => input.hit(k)) + 1,
  };
  wheel = 0;
  if (!input.locked && !input.touchMode && !input.padMode && !TEST) { I.fire = false; I.fireHit = false; I.aim = false; }
  // thumbs and sticks: a little help aiming, and (on touch) the gun fires itself when one is in the sights
  if ((input.touchMode || input.padMode) && settings.assist && weapons.S.cur) assist(dt, I);
  if (P.downed) { I.fire = I.fireHit = I.aim = I.reloadHit = I.knifeHit = false; I.swap = 0; I.slot = 0; }
  const rec = weapons.update(dt, I, P);
  P.pitch += rec.pitch; P.yaw += rec.yaw;
  if (weapons.S.firedThisFrame) { fear = Math.max(0, fear - 0.01); input.rumble(weapons.S.cur === 'sniper' ? 0.8 : 0.25, 0.3, 60); }
  // healing
  if ((input.hit('KeyH') || pad?.heal) && P.medkits > 0 && P.hp < 100 && P.healT <= 0 && !P.downed) { P.medkits--; P.healT = 1.2; A.heal(); ui.toast('MEDKIT'); }
  if (P.healT > 0) { P.healT -= dt; P.hp = Math.min(100, P.hp + 45 / 1.2 * dt); }
  P.lastHit += dt; if (P.lastHit > 6 && P.hp < 30 && !P.downed) P.hp = Math.min(30, P.hp + dt * 2); // you get back to your feet, a bit
  // the map
  if (input.hit('KeyM') || pad?.map) openMap(!mapOpen);
  if (mapOpen && Math.random() < 0.1) openMap(true);
  // what's in front of you (some things you hold the button for: picking a friend up)
  focusCheck();
  if (focus) {
    const lbl = typeof focus.label === 'function' ? focus.label() : focus.label;
    if (focus.hold) {
      const held = input.down('KeyE') || !!pad?.useHeld || (input.touch.held.use);
      if (holdId !== focus.id) { holdId = focus.id; holdT = 0; }
      holdT = held ? holdT + dt : 0;
      $('prompt').innerHTML = `<b>${keyName('use')}</b>${lbl}<i style="--p:${Math.min(1, holdT / focus.hold).toFixed(2)}"></i>`;
      if (holdT >= focus.hold) { const f = focus; holdT = 0; f.use(); }
    } else {
      $('prompt').innerHTML = `<b>${keyName('use')}</b>${lbl}`;
      if (input.hit('KeyE') || input.lmbHit && !weapons.S.cur || pad?.use || promptTap) { const f = focus; focus = null; f.use(); }
    }
    $('xhair').classList.add('on');
  } else { $('prompt').innerHTML = ''; $('xhair').classList.remove('on'); holdT = 0; }
  promptTap = false;
  document.querySelector('[data-t="use"]')?.classList.toggle('ready', !!focus);
  if (talkQ && (input.hit('Enter') || pad?.b)) skipLine();
  // supplies under your feet
  for (const p of pickups) {
    if (p.taken) continue; p.t += dt; p.m.rotation.y += dt * 1.2; p.m.position.y = groundY(p.x, p.z) + 0.32 + Math.sin(p.t * 2) * 0.05;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 1.3 && !P.downed) take(p);
  }
  // the world
  if (!surv_) { story.update(dt); kaurIdle(); }
  else surv.update(dt);
  zombies.update(dt, ctxZ());
  if (boss) boss.update(dt);
  updateApparitions(dt);
  nightEvents(dt);
  // fear: from what's close
  let near = 0; for (const z of zombies.list) if (z.state === 'chase' || z.state === 'attack') { const d = Math.hypot(z.x - P.x, z.z - P.z); if (d < 14) near += (14 - d) / 14; }
  fear = Math.min(1, Math.max(fear, near * 0.35, P.downed ? 0.8 : 0));
  A.ambience(dt, { night: nightK, fear: U.fear.value, indoors: P.indoors ? 1 : 0, nearFire: W.fires.reduce((m, f) => Math.max(m, 1 - Math.hypot(f.x - P.x, f.z - P.z) / 14), 0), listener: P });
  A.heartbeat(dt, 60 + U.fear.value * 70 + (P.hp < 40 ? 40 : 0), (P.hp < 40 ? 0.5 : 0) + U.fear.value * 0.3);
  updateHud();
}
const weaponsNoise = (x, z, r) => { if (surv.active() && !surv.isHost()) surv.sendNoise(x, z, r); else zombies.noise(x, z, r); };
let promptTap = false;
$('prompt').addEventListener('click', () => { promptTap = true; });
$('prompt').addEventListener('touchstart', (e) => { e.preventDefault(); promptTap = true; }, { passive: false });
// aim assist: the nearest head close to your sights pulls them a little towards it. Auto-fire (touch): when the
// sights are on one and nothing is in the way, the trigger is pulled for you.
const _ao = new THREE.Vector3(), _ad = new THREE.Vector3(), _ah = new THREE.Vector3();
let autoT = 0;
function assist(dt, I) {
  camera.getWorldPosition(_ao); camera.getWorldDirection(_ad);
  let best = null, bestA = (weapons.S.aim > 0.5 ? 9 : 6) * Math.PI / 180;
  for (const zb of zombies.list) {
    if (zb.state === 'dead' || zb.kind === 'child') continue;
    const d = Math.hypot(zb.x - P.x, zb.z - P.z); if (d > 45 || d < 0.5) continue;
    _ah.set(zb.x, zb.y + (zb.crawl ? 0.35 : 1.62) * zb.scale, zb.z).sub(_ao);
    const ang = _ah.angleTo(_ad); if (ang < bestA) { bestA = ang; best = { yaw: Math.atan2(-_ah.x, -_ah.z), pitch: Math.atan2(_ah.y, Math.hypot(_ah.x, _ah.z)), d, zb }; }
  }
  if (!best) return;
  const k = Math.min(1, dt * (weapons.S.aim > 0.5 ? 6 : 3.5));
  let dy = best.yaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  P.yaw += dy * k; P.pitch += (best.pitch - P.pitch) * k;
  if (input.touchMode && settings.autofire && bestA < 2.5 * Math.PI / 180 && clearLine(_ao.x, _ao.y, _ao.z, best.zb.x, best.zb.y + 1.2, best.zb.z)) {
    const auto = GUNS[weapons.S.cur].auto;
    I.fire = true; if (!auto && (autoT -= dt) <= 0) { I.fireHit = true; autoT = 0.28; }
  }
}
let wheel = 0;
addEventListener('wheel', (e) => { if (mode === 'play') wheel += e.deltaY > 0 ? 1 : -1; }, { passive: true });
function focusCheck() {
  focus = null; let best = 2.4;
  if (P.downed || P.dead) return;
  for (const it of (gameMode === 'survival' ? surv.interactables() : story.I)) {
    if (!it.when()) continue; const a = it.at(); if (!a) continue;
    const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz); if (d > 2.4) continue;
    const look = (dx * P.lookDir.x + dz * P.lookDir.z) / (d || 1);
    if (d > 1.1 && look < 0.55) continue;
    const sc = d - look; if (sc < best) { best = sc; focus = it; }
  }
}
function pause(on) {
  if (on) { mode = 'paused'; only('pause'); $('pauseCoop').hidden = !surv.online(); $('btnNotes').hidden = gameMode === 'survival'; $('pauseSave').hidden = gameMode === 'survival'; input.unlock(); voice.pause(); setHud(false); A.spin(0); }
  else { mode = 'play'; only(null); input.lock(); voice.resume(); setHud(true); }
}
function toTitle() { if (surv.active() || surv.net) surv.leave(false); gameMode = 'story'; zombies.S.puppet = false; P.downed = P.dead = false; resetWorld(); mode = 'title'; only('title'); refreshTitle(); setHud(false); input.unlock(); A.spin(0); }

// ---------- menus ----------
canvas.addEventListener('click', () => { if (mode === 'play') input.lock(); });
document.addEventListener('pointerlockchange', () => { if (!input.locked && mode === 'play' && !TEST && !input.touchMode) pause(true); });
$('warnOk').onclick = () => { store('remission.warned', 1); A.initAudio(); mode = 'title'; only('title'); refreshTitle(); };
$('btnNew').onclick = () => { if (save && save.step > 0 && !confirmNew()) return; newGame(); };
const confirmNew = () => { const b = $('btnNew'); if (b.dataset.sure) { delete b.dataset.sure; return true; } b.dataset.sure = 1; b.textContent = 'Start over? (press again)'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'New game'; }, 3000); return false; };
$('btnContinue').onclick = () => startFrom(save);
$('btnHow').onclick = () => only('how');
$('btnSettings').onclick = () => { settingsFrom = 'title'; only('settings'); };
$('btnResume').onclick = () => pause(false);
$('btnNotes').onclick = () => { notesList(); only('notes'); };
$('btnPauseSettings').onclick = () => { settingsFrom = 'pause'; only('settings'); };
$('btnQuit').onclick = () => toTitle();
$('btnRetry').onclick = () => { if (mode === 'dead') startFrom(save); };
$('btnDeadTitle').onclick = () => toTitle();
$('btnEndTitle').onclick = () => toTitle();
$('noteClose').onclick = () => closeNote();
$('card').onclick = () => { if (mode === 'intro') introT = 99; };
$('mapClose').onclick = () => openMap(false);
$('btnGive').onclick = () => ending('remission');
$('btnTake').onclick = () => ending('relapse');
let settingsFrom = 'title';
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => {
  const scr = b.closest('.screen').id;
  if (scr === 'notes' || (scr === 'settings' && settingsFrom === 'pause')) { only('pause'); return; }
  only('title'); refreshTitle();
}));
function notesList() {
  const box = $('notesList'); box.innerHTML = '';
  const ids = Object.keys(story.S.notes);
  box.innerHTML = ids.length ? ids.map((k) => `<p><button class="link" data-note="${k}">${NOTES[k].title}</button></p>`).join('') : '<p class="small">Nothing yet.</p>';
  box.querySelectorAll('[data-note]').forEach((b) => (b.onclick = () => { readFrom = 'paused'; mode = 'read'; $('noteTitle').textContent = NOTES[b.dataset.note].title; $('noteBody').innerHTML = NOTES[b.dataset.note].html; only('note'); }));
  $('notesCount').textContent = `Found ${ids.length} of ${Object.keys(NOTES).length} · ever: ${Object.keys(progress.notes).length}`;
}
function refreshTitle() {
  $('survBest').textContent = progress.survBest ? `Survival best: ${progress.survBest} night${progress.survBest === 1 ? '' : 's'}` : '';
  $('btnContinue').hidden = !(save && save.step >= 0 && save.pos);
  $('btnNew').textContent = 'New game';
  const e = Object.keys(progress.endings).map((k) => ENDINGS[k].title);
  $('titleProg').textContent = e.length ? `Endings: ${e.join(' · ')} · put down: ${progress.kills}` : progress.kills ? `Zombies put down: ${progress.kills}` : '';
}
function bindSetting(id, keyN, fmt, apply) {
  for (const el of document.querySelectorAll(`[data-set="${keyN}"], #${id}`)) {
    const out = el.parentElement.querySelector('output');
    if (el.type === 'checkbox') el.checked = !!settings[keyN]; else el.value = settings[keyN];
    const upd = () => {
      settings[keyN] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
      for (const o of document.querySelectorAll(`[data-set="${keyN}"], #${id}`)) { if (o !== el) { if (o.type === 'checkbox') o.checked = el.checked; else o.value = el.value; } const ou = o.parentElement.querySelector('output'); if (ou) ou.textContent = fmt ? fmt(settings[keyN]) : settings[keyN]; }
      apply?.(settings[keyN]); store(SKEY, settings);
    };
    el.addEventListener('input', upd); el.addEventListener('change', upd); if (out) out.textContent = fmt ? fmt(settings[keyN]) : settings[keyN];
  }
}
bindSetting('sGore', 'gore', (v) => `${v}% · ${goreName(v)}`, () => { applyGore(); $('goreDesc').textContent = goreDesc(); $('goreDesc2').textContent = goreDesc(); });
const goreDesc = () => { const v = settings.gore; return v <= 0 ? 'No blood. The dead just fall down.' : v <= 30 ? 'Some blood when they are hit. Bodies stay whole.' : v <= 60 ? 'Blood sprays and pools. Limbs come off at the joints. Heads come off.' : v <= 85 ? 'All of that, and heads burst, pieces fly, blood on your screen.' : 'Everything, as much as it can. Bodies stay in the street a long time.'; };
$('goreDesc').textContent = goreDesc(); $('goreDesc2').textContent = goreDesc();
bindSetting('sVol', 'vol', (v) => Math.round(v * 100) + '%', (v) => A.setVolume(v));
bindSetting('sSens', 'sens', (v) => v.toFixed(2), (v) => { input.padSens = v; input.touchSens = v; });
bindSetting('sBright', 'bright', (v) => Math.round(v * 100) + '%');
bindSetting('sFov', 'fov', (v) => v + '°');
bindSetting('sQuality', 'quality', null, () => { gov.reset(); applyQuality(); });
bindSetting('sVoices', 'voices', null, (v) => { voice.on = v; });
bindSetting('sSubs', 'subs');
bindSetting('sHit', 'hitmarks');
bindSetting('sInvert', 'invert');
bindSetting('sPads', 'pads', null, (v) => { input.pads = v; });
bindSetting('sRumble', 'rumble', null, (v) => { input.rumbleOn = v; });
bindSetting('sAssist', 'assist');
bindSetting('sAuto', 'autofire');
$('btnSurvival').onclick = () => { A.initAudio(); surv.openLobby(); };
$('btnOverAgain').onclick = () => { if (!surv.net || surv.isHost()) surv.startGame(); };
$('btnOverTitle').onclick = () => toTitle();
$('btnPauseMute').onclick = () => { const m = !surv.mic.muted; surv.setMute(m); $('btnPauseMute').textContent = m ? 'Microphone: muted' : 'Microphone: on'; };
input.onKind = (m) => { document.body.dataset.input = m; $('touch').classList.toggle('on', m === 'touch' && mode === 'play'); };
if (COARSE) input.setMode('touch');
input.bindTouch($('touch'));
document.body.dataset.input = input.padMode ? 'pad' : input.touchMode ? 'touch' : 'keys';

// ---------- survival (and co-op) ----------
const surv = createSurvival({
  scene, camera, P, zombies, weapons, ui, input, progress, persist: () => { store(PKEY, progress); syncSave(); },
  getHour: () => hour, setHour: (h) => { hour = h; }, pickups,
  addPickup: (kind, x, z, y, temp, id) => addPickup(kind, x, z, y, temp, id), removePickup, applyPickup,
  hurt: (d, k, from) => hurt(d, k, from), only, keyName,
  toTitle: () => toTitle(),
  resume: () => { mode = 'play'; setHud(true); input.lock(); },
  begin: (m) => beginSurvival(m),
  respawn: (x, z) => { P.dead = false; P.downed = false; P.alive = true; P.hp = 100; P.bleed = 0; P.x = x; P.z = z; P.y = groundY(x, z); collide(P, 0.35); if (!weapons.S.owned.pistol) weapons.give('pistol'); weapons.addAmmo('pistol', 24); },
  end: (st) => showOver(st),
});
function beginSurvival(m) {
  gameMode = 'survival';
  resetWorld();
  story.S.step = 0; story.S.flags = {}; story.S.notes = {}; story.S.talked = {};
  save = null;
  setDoor('armory', true);
  weapons.restore({ owned: { pistol: false, smg: false, rifle: false, sniper: false, minigun: false }, mag: {}, reserve: {}, cur: null });
  for (const k of ORDER) { weapons.S.mag[k] = 0; weapons.S.reserve[k] = 0; }
  weapons.give('pistol'); weapons.addAmmo('pistol', 36);
  P.medkits = 1; P.hp = 100; P.alive = true; P.downed = false; P.dead = false; P.bleed = 0; P.vy = 0; P.stam = 1; P.shotN = 0;
  P.x = m.x; P.z = m.z; P.y = groundY(m.x, m.z); P.yaw = 0; P.pitch = 0; collide(P, 0.35);
  hour = m.hour; kills = 0;
  for (const p of [...pickups]) scene.remove(p.m); pickups.length = 0;
  for (const [id, kind, x, z] of m.loot) addPickup(kind, x, z, null, false, id);
  zombies.S.quiet = false;
  mode = 'play'; only(null); setHud(true); input.lock(); A.initAudio();
  U.black.value = 1; fear = 0; U.red.value = 0;
  ui.objective(true);
}
function showOver(st) {
  mode = 'over'; setHud(false); input.unlock(); A.spin(0);
  const ids = Object.keys(st.names || {});
  $('overNights').textContent = `${st.nights} night${st.nights === 1 ? '' : 's'}`;
  $('overRows').innerHTML = ids.map((id) => `<p><b>${String(st.names[id]).replace(/[<>&]/g, '')}</b> · ${st.kills?.[id] || 0} put down</p>`).join('');
  $('overBest').textContent = progress.survBest ? `Your best: ${progress.survBest} night${progress.survBest === 1 ? '' : 's'}` : '';
  $('btnOverAgain').hidden = !!surv.net && !surv.isHost();
  $('overWait').hidden = !(surv.net && !surv.isHost());
  only('over');
}

// ---------- sync + achievements ----------
function syncSave() { try { window.GameSync?.syncNow?.(); } catch { /* fine */ } }
if (window.GameSync) {
  const pr = (gg) => gg(PKEY) || {};
  const en = (gg, k) => !!(pr(gg).endings || {})[k];
  GameSync.init({ game: 'remission', idle: () => mode === 'title' || mode === 'warn', keys: [{ match: PKEY, mode: 'max' }], ach: [
    { id: 'first', name: 'Day 49', desc: 'Die for the first time', test: (gg) => (pr(gg).total || 0) > 0 },
    { id: 'k100', name: 'Triage', desc: 'Put down 100 of them', test: (gg) => (pr(gg).kills || 0) >= 100 },
    { id: 'k1000', name: 'Mass casualty', desc: 'Put down 1,000 of them', test: (gg) => (pr(gg).kills || 0) >= 1000 },
    { id: 'arsenal', name: 'Full arsenal', desc: 'Find all five guns', test: (gg) => Object.keys(pr(gg).guns || {}).length >= 5 },
    { id: 'night', name: 'After dark', desc: 'Live through to nightfall', test: (gg) => (pr(gg).nights || 0) > 0 },
    { id: 'reader', name: 'Case notes', desc: 'Find every note and tape', test: (gg) => Object.keys(pr(gg).notes || {}).length >= Object.keys(NOTES).length },
    { id: 'mass', name: 'Excision', desc: 'Destroy the Mass', test: (gg) => !!pr(gg).boss },
    { id: 'remission', name: 'Remission', desc: 'Give the cure away', test: (gg) => en(gg, 'remission') },
    { id: 'relapse', name: 'Relapse', desc: 'Keep the cure', test: (gg) => en(gg, 'relapse') },
    { id: 'night1', name: 'First light', desc: 'Survival: live through a night', test: (gg) => (pr(gg).survBest || 0) >= 1 },
    { id: 'night5', name: 'Five nights', desc: 'Survival: live through five nights', test: (gg) => (pr(gg).survBest || 0) >= 5 },
    { id: 'coop', name: 'Not alone', desc: 'Play survival with a friend', test: (gg) => !!pr(gg).coop },
  ] });
  $('syncBtn').onclick = () => GameSync.open();
} else $('syncBtn').hidden = true;

// ---------- boot ----------
document.body.dataset.ready = '1';
if (load('remission.warned')) { mode = 'title'; only('title'); refreshTitle(); } else { mode = 'warn'; only('warn'); }
setHud(false); U.black.value = 1;
camera.position.set(0, 30, 160); camera.lookAt(0, 10, 0);
try { renderer.compile(scene, camera); } catch { /* compiles on first use */ }
document.addEventListener('pointerdown', () => A.initAudio(), { once: true });
requestAnimationFrame(frame);
// the title: drift over the city
setInterval(() => { if (mode === 'title' || mode === 'warn' || mode === 'card') { const t = performance.now() / 1000 * 0.03; camera.position.set(Math.sin(t) * 60, 34, 140 + Math.cos(t) * 20); camera.lookAt(0, 8, 20); U.black.value = Math.max(0.25, U.black.value - 0.02); } }, 33);

if (TEST) window.__s = {
  P, W, story, camera, U, renderer, scene, progress, settings, zombies, weapons, gore, g, surv, get gameMode() { return gameMode; },
  suse(id) { const it = surv.interactables().find((i) => i.id.startsWith(id)); if (it) { it.use(); return true; } return false; },
  get save() { return save; }, get mode() { return mode; }, set mode(v) { mode = v; }, get boss() { return boss; }, get hour() { return hour; }, set hour(v) { hour = v; },
  get focus() { return focus ? (typeof focus.label === 'function' ? focus.label() : focus.label) : null; }, get talking() { return !!talkQ; }, skipTalk() { while (talkQ) { talkQ.t = 0; nextLine(); } },
  newGame, startFrom, endIntro, ending, setQuality(q) { settings.quality = q; applyQuality(); }, setGore(v) { settings.gore = v; applyGore(); },
  tp(x, z, yaw = P.yaw, pitch = 0) { P.x = x; P.z = z; P.y = groundY(x, z); P.yaw = yaw; P.pitch = pitch; P.vy = 0; },
  use(id) { const it = story.I.find((i) => i.id === id); if (it && it.when()) { it.use(); return true; } return false; },
  key(code, down = true) { if (down) { input.keys.add(code); input.pressed.add(code); } else input.keys.delete(code); },
  mouse(btn, down) { if (btn === 0) { input.lmb = down; if (down) input.lmbHit = true; } else { input.rmb = down; if (down) input.rmbHit = true; } },
  flash(on) { flashlight = on; }, openMap, pickups,
  prof() { const r = { upd: +(prof.upd / prof.n).toFixed(2), ren: +(prof.ren / prof.n).toFixed(2), n: prof.n, calls: Math.round(prof.calls / prof.n) }; prof.upd = prof.ren = prof.n = prof.calls = 0; return r; },
  stats() { return { programs: renderer.info.programs.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, merge: W.stats, zombies: zombies.list.length }; },
};
