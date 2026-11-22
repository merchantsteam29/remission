// SURVIVAL: the city with no story, up to four of you, as many nights as you can last.
// Days are for scavenging: guns in the precinct armory, the checkpoint tent, Gus's safe and the helicopter, and
// supplies everywhere. At 8 PM the waves start, and every night they're bigger, faster and worse.
// When one of you goes down, the others have 30 seconds to pick you up. Bleed out and you watch until dawn.
// When all of you are down, it's over.
//
// Co-op is peer to peer (net.js): the host's browser runs the dead, the clock and the supplies, and sends them
// out ten times a second. Everyone else sends where they are and what they shot. Voice is proximity chat (vc.js):
// a friend is loud next to you and gone across the city. And the dead can hear you talking too.
import * as THREE from 'three';
import { Net, newCode, cleanCode, cleanName, MAX_PLAYERS } from './net.js';
import { VoiceChat, Mic } from './vc.js';
import { W, groundY, solid, indoorAt } from './city.js';
import { GUNS } from './weapons.js';
import * as A from './audio.js';

const $ = (id) => document.getElementById(id);
const NAME_KEY = 'remission.name', VMODE_KEY = 'remission.vmode', MIC_KEY = 'remission.mic';
const START = { x: 0, z: 9 };
const COLORS = [0x3a5a8a, 0x8a3a2a, 0x3a6a3a, 0x8a7a2a];
export const CACHES = [
  { gun: 'smg', where: 'the 9th Precinct armory', at: () => W.marks.armory },
  { gun: 'rifle', where: 'the checkpoint tent on Bell Street', at: () => W.marks.tent },
  { gun: 'sniper', where: 'Gus\'s gun safe, Harrow Court', at: () => W.marks.gusSafe },
  { gun: 'minigun', where: 'the helicopter in the park', at: () => W.marks.heli },
];

// ---------- the others: a survivor in a jacket, a gun up ----------
function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
  g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(text, 128, 24); g.fillStyle = '#e8f0d8'; g.fillText(text, 128, 24);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(1.4, 0.26, 1); s.renderOrder = 5; return s;
}
function makeSurvivor(color, name) {
  const coat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), skin = new THREE.MeshStandardMaterial({ color: 0xb08a70, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.8 });
  const root = new THREE.Group();
  const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso); box(0.44, 0.62, 0.26, coat, 0, 0.32, 0, torso);
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); hd.scale.set(0.9, 1.1, 1); hd.position.y = 0.1; head.add(hd);
  box(0.25, 0.08, 0.27, dark, 0, 0.21, 0, head);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.11, 0, 0); hips.add(leg); box(0.15, 0.88, 0.16, dark, 0, -0.44, 0, leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * 0.27, 0.58, 0); torso.add(arm); box(0.12, 0.6, 0.13, coat, 0, -0.29, 0, arm); arms.push(arm);
  }
  const gun = new THREE.Group(); gun.position.set(0, -0.55, 0.1); arms[1].add(gun); box(0.06, 0.08, 0.5, dark, 0, 0, 0.18, gun);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flash.position.set(0, 0, 0.5); flash.scale.setScalar(0.3); flash.visible = false; gun.add(flash);
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); lamp.position.set(0.05, 0.05, 0.42); lamp.scale.setScalar(0.18); gun.add(lamp);
  const tag = nameTag(name); tag.position.y = 2.15; root.add(tag);
  return { root, hips, torso, head, legs, arms, gun, flash, lamp, tag, phase: 0 };
}

// c = { scene, camera, P, zombies, weapons, ui, input, getHour, setHour, nightK, addPickup, removePickup, pickups, applyPickup, hurt, begin, end, only, setHud, keyName, progress, persist }
export function createSurvival(c) {
  const { P, zombies, weapons, ui } = c;
  let net = null, vc = null, solo = false, on = false;
  const mic = new Mic();
  const remote = new Map(); // id -> { st, m (model), x, z, y, yaw, shown sh, ... }
  const R = { night: 0, wave: 0, waveT: 0, isNight: false, kills: {}, started: false, sendT: 0, snapT: 0, talkT: 0, pid: 1, cacheDay: {}, over: false, msgT: 0 };
  const isHost = () => !net || net.isHost;
  const myId = () => net?.id || 'h';
  const nameOf = (id) => (net ? net.nameOf(id) : 'You');
  const online = () => !!net && on;

  // ---------- sending ----------
  const toAll = (m) => { if (!net) { handle(m, 'h'); return; } if (net.isHost) net.broadcast(m); else net.send(m); };
  const toHost = (m) => { if (!net || net.isHost) handle(m, myId()); else net.send(m); };
  const toOne = (id, m) => { if (!net || id === myId()) handle(m, 'h'); else if (net.isHost) net.sendTo(id, m); };

  // ---------- the lobby ----------
  const status = (t) => { $('mpStatus').textContent = t || ''; };
  function openLobby() {
    $('mpName').value = localStorage.getItem(NAME_KEY) || '';
    $('mpVoiceMode').value = localStorage.getItem(VMODE_KEY) || 'clear';
    $('mpMic').checked = localStorage.getItem(MIC_KEY) !== '0';
    const q = /[?&]room=([A-Za-z0-9]{4})/.exec(location.search); if (q && !net) $('mpCode').value = q[1].toUpperCase();
    refreshLobby(); c.only('mp');
  }
  function refreshLobby() {
    const inRoom = !!net;
    $('mpOut').hidden = inRoom; $('mpIn').hidden = !inRoom;
    if (!inRoom) return;
    $('mpCodeShow').textContent = net.code;
    $('mpRoster').innerHTML = net.roster.map((r, i) => `<li class="${vc?.talking(r.id) || (r.id === myId() && mic.talking) ? 'talk' : ''}"><b style="color:#${COLORS[i % 4].toString(16).padStart(6, '0')}">■</b> ${esc(r.name)}<span>${r.id === 'h' ? 'host' : ''}${r.id === myId() ? ' (you)' : ''}</span></li>`).join('');
    $('mpStart').hidden = !net.isHost; $('mpWait').hidden = net.isHost;
    $('mpStart').textContent = R.started ? 'Back to the city' : `Start (${net.roster.length}/${MAX_PLAYERS})`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const myName = () => { const n = cleanName($('mpName').value); localStorage.setItem(NAME_KEY, n); return n; };
  async function hostRoom() {
    status('Opening a room...');
    for (let tries = 0; tries < 4; tries++) {
      const n = new Net();
      try { await n.host(newCode(), myName()); net = n; break; } catch (e) { status(e.message); }
    }
    if (!net) { status('Couldn\'t open a room. Check your connection and try again.'); return; }
    wire(); status(''); refreshLobby(); startVoice();
  }
  async function joinRoom() {
    const code = cleanCode($('mpCode').value); if (code.length !== 4) { status('Type the 4-letter room code.'); return; }
    status('Joining ' + code + '...');
    const n = new Net();
    try { await n.join(code, myName()); } catch (e) { status(e.message); return; }
    net = n; wire(); status(''); refreshLobby(); startVoice();
  }
  async function startVoice() {
    if (!net) return;
    A.initAudio();
    const want = $('mpMic').checked;
    let stream = null;
    if (want && await mic.start()) stream = mic.stream; else if (want) status(mic.error);
    vc = new VoiceChat(net, stream); vc.mode = $('mpVoiceMode').value;
    vc.sync(net.roster);
  }
  function wire() {
    net.onMessage = (m, from) => handle(m, from);
    net.onRoster = (roster) => {
      vc?.sync(roster); refreshLobby();
      // someone new while we're playing: send them the city as it is
      if (net.isHost && R.started) for (const r of roster) if (r.id !== 'h' && !remote.has(r.id)) { addRemote(r.id); net.sendTo(r.id, startMsg()); }
    };
    net.onClose = (why) => { status(why); const was = on; leave(false); if (was) { c.ui.toast('DISCONNECTED'); c.toTitle(); } openLobby(); status(why); };
    net.onRejoin = (id) => { if (R.started) net.sendTo(id, startMsg()); };
  }
  function leave(toLobby = true) {
    try { vc?.dispose(); } catch { /* fine */ } vc = null;
    mic.stop();
    try { net?.destroy(); } catch { /* fine */ } net = null;
    for (const r of remote.values()) c.scene.remove(r.m.root); remote.clear();
    on = false; solo = false; R.started = false; zombies.S.puppet = false;
    if (toLobby) refreshLobby();
  }

  // ---------- starting ----------
  function startMsg() {
    const loot = c.pickups.filter((p) => !p.taken).map((p) => [p.id, p.kind, +p.x.toFixed(2), +p.z.toFixed(2)]);
    return { t: 'start', hour: c.getHour(), night: R.night, loot, fresh: !R.started };
  }
  function startGame() {
    if (net && !net.isHost) return;
    R.started = true; R.night = 0; R.kills = {}; R.isNight = false; R.wave = 0; R.over = false; R.pid = 1;
    if (net) net.locked = false;
    for (const r of (net ? net.roster : [])) if (r.id !== myId()) addRemote(r.id);
    // the city's supplies, the same for everyone
    const loot = [];
    W.loot.forEach((l) => { const r = Math.random(); if (r < 0.15) return; loot.push([R.pid++, r < 0.45 ? 'med' : 'ammo', l.x, l.z]); });
    toAll({ t: 'start', hour: 16, night: 0, loot, fresh: true });
  }
  function playSolo() { solo = true; net = null; startGame(); }
  function addRemote(id) {
    if (remote.has(id) || id === myId()) return;
    const i = net ? Math.max(0, net.roster.findIndex((r) => r.id === id)) : 1;
    const m = makeSurvivor(COLORS[i % 4], nameOf(id)); c.scene.add(m.root);
    remote.set(id, { id, m, x: START.x, z: START.z, y: 0.15, yaw: 0, pitch: 0, tx: START.x, tz: START.z, ty: 0.15, tyaw: 0, sh: 0, gun: 'pistol', lit: false, hp: 100, dn: false, dead: false, alive: true, lookDir: new THREE.Vector3(0, 0, -1), mv: 0, k: 0 });
  }

  // ---------- messages ----------
  function handle(m, from) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'start': {
        on = true; R.started = true; R.night = m.night || 0; R.over = false;
        zombies.S.puppet = !isHost();
        if (net) for (const r of net.roster) if (r.id !== myId()) addRemote(r.id);
        const idx = net ? Math.max(0, net.roster.findIndex((r) => r.id === myId())) : 0;
        c.begin({ hour: m.hour, loot: m.loot, x: START.x + (idx % 2 ? 2 : -2) * (1 + (idx >> 1)), z: START.z + idx, fresh: m.fresh });
        ui.toast(R.night ? `NIGHT ${R.night}` : 'SURVIVAL'); ui.hint(R.night ? 'You joined during the night. Find the others.' : 'Scavenge while it\'s light. The first night comes at 8 PM.');
        progress('coop', net && net.roster.length > 1);
        break;
      }
      case 'st': { // a player's state, to the host
        if (!isHost()) break;
        const r = remote.get(from) || (addRemote(from), remote.get(from)); if (!r) break;
        setRemote(r, m);
        break;
      }
      case 'snap': {
        if (isHost()) break;
        zombies.applySnapshot(m.z);
        c.setHour(m.h); R.night = m.n; R.isNight = !!m.nt; R.wave = m.w;
        for (const s of m.ps) {
          if (s.id === myId()) { R.kills[s.id] = s.k; continue; }
          const r = remote.get(s.id) || (addRemote(s.id), remote.get(s.id)); if (r) setRemote(r, s);
          R.kills[s.id] = s.k;
        }
        for (const id of [...remote.keys()]) if (!m.ps.some((s) => s.id === id)) dropRemote(id);
        break;
      }
      case 'hit': { // a client shot something
        if (!isHost()) break;
        const zb = zombies.getByNid(m.i); if (!zb || zb.state === 'dead') break;
        const r = remote.get(from);
        zombies.damage(zb, m.p, m.d, new THREE.Vector3(m.dx, m.dy, m.dz), new THREE.Vector3(m.px, m.py, m.pz), { head: m.h, cut: m.c, shooter: from, from: r ? { x: r.x, z: r.z } : null });
        break;
      }
      case 'noise': if (isHost()) zombies.noise(m.x, m.z, Math.min(120, m.r)); break;
      case 'take': {
        if (!isHost()) break;
        const p = c.pickups.find((q) => q.id === m.id && !q.taken);
        if (!p) break;
        c.removePickup(p.id); toAll({ t: 'gone', id: p.id }); toOne(from, { t: 'got', kind: p.kind });
        break;
      }
      case 'gone': c.removePickup(m.id); break;
      case 'got': c.applyPickup(m.kind); break;
      case 'drop': if (!c.pickups.some((p) => p.id === m.id)) c.addPickup(m.kind, m.x, m.z, null, true, m.id); break;
      case 'hurt': c.hurt(m.d, m.k, { x: m.x, z: m.z }); break;
      case 'down': {
        if (isHost()) { const r = remote.get(from); if (r) r.dn = true; toAll({ t: 'msg', text: `${nameOf(from)} IS DOWN`, who: from }); checkOver(); }
        break;
      }
      case 'bled': if (isHost()) { const r = remote.get(from); if (r) { r.dn = false; r.dead = true; } toAll({ t: 'msg', text: `${nameOf(from)} BLED OUT` }); checkOver(); } break;
      case 'revive': if (isHost()) toAll({ t: 'revived', who: m.who, by: from }); break;
      case 'revived': {
        if (m.who === myId() && P.downed) { P.downed = false; P.hp = 35; P.bleed = 0; ui.toast('BACK ON YOUR FEET'); A.heal(); }
        else { const r = remote.get(m.who); if (r) r.dn = false; if (m.by === myId()) ui.toast(`YOU PICKED UP ${nameOf(m.who).toUpperCase()}`); }
        break;
      }
      case 'respawn': if (m.who === myId() && (P.dead || P.downed)) { c.respawn(m.x, m.z); ui.toast('DAWN · YOU\'RE BACK'); } break;
      case 'msg': if (m.who !== myId()) { ui.toast(m.text); A.squelch(); } break;
      case 'night': R.night = m.n; R.isNight = true; ui.toast(`NIGHT ${m.n}`); ui.hint(m.n === 1 ? 'Here they come. Stay together. Revive each other.' : `Night ${m.n}. More of them, and faster.`); A.siren(P, 5); A.presence(0.4, 4); break;
      case 'dawn': R.isNight = false; ui.toast(`NIGHT ${m.n} SURVIVED`); ui.hint('Dawn. The city restocks. Get what you can before dark.'); c.progress.survBest = Math.max(c.progress.survBest || 0, m.n); c.persist(); break;
      case 'over': if (!R.over) { R.over = true; c.progress.survBest = Math.max(c.progress.survBest || 0, m.nights); c.persist(); c.end({ nights: m.nights, kills: m.kills, names: m.names }); } break;
      case 'quit': dropRemote(m.id); if (on) ui.toast(`${nameOf(m.id)} LEFT`.toUpperCase()); break;
    }
  }
  function setRemote(r, s) {
    r.tx = s.x; r.tz = s.z; r.ty = s.y; r.tyaw = s.yaw; r.pitch = s.p; r.gun = s.g; r.lit = !!s.l; r.hp = s.hp; r.dn = !!s.dn; r.dead = !!s.dd; r.alive = !s.dd; r.mv = s.mv || 0;
    if (s.sh !== r.sh) { if (s.sh > r.sh && s.g) { const pos = { x: s.x, y: (s.y || 0) + 1.4, z: s.z }; A.gunshot(GUNS[s.g]?.snd || 'pistol', 0, pos); r.flashT = 0.06; } r.sh = s.sh; }
    r.lookDir.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
  }
  function dropRemote(id) { const r = remote.get(id); if (!r) return; c.scene.remove(r.m.root); remote.delete(id); }
  function progress(k, v) { if (v) { c.progress[k] = 1; c.persist(); } }

  // ---------- each frame ----------
  function myState() {
    return { id: myId(), x: +P.x.toFixed(2), z: +P.z.toFixed(2), y: +P.y.toFixed(2), yaw: +P.yaw.toFixed(3), p: +P.pitch.toFixed(3), g: weapons.S.cur, l: P.lit ? 1 : 0, hp: Math.round(P.hp), dn: P.downed ? 1 : 0, dd: P.dead ? 1 : 0, sh: P.shotN || 0, mv: +P.moving.toFixed(2), k: R.kills[myId()] || 0 };
  }
  function update(dt) {
    if (!on) return;
    const host = isHost();
    // the clock, the waves
    if (host) hostTick(dt);
    // send
    if (net) {
      if (host) { if ((R.snapT -= dt) <= 0) { R.snapT = 0.1; sendSnap(); } }
      else if ((R.sendT -= dt) <= 0) { R.sendT = 1 / 12; net.send({ t: 'st', ...myState() }); }
    }
    // down: bleeding
    if (P.downed) {
      P.bleed -= dt;
      if (P.bleed <= 0) { P.downed = false; P.dead = true; P.alive = false; toHost({ t: 'bled' }); ui.toast('YOU BLED OUT'); ui.hint('You\'ll be back at dawn, if the others make it.'); }
    }
    // the others
    for (const r of remote.values()) {
      const k = Math.min(1, dt * 12);
      r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k; r.y += (r.ty - r.y) * k;
      if (Math.hypot(r.tx - r.x, r.tz - r.z) > 8) { r.x = r.tx; r.z = r.tz; }
      let dh = r.tyaw - r.yaw; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.yaw += dh * k;
      const m = r.m; m.root.visible = !r.dead; m.root.position.set(r.x, r.y, r.z); m.root.rotation.y = r.yaw + Math.PI;
      m.phase += dt * r.mv * 7; const sw = Math.sin(m.phase) * Math.min(1, r.mv) * 0.6;
      m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
      if (r.dn) { m.hips.position.y = 0.25; m.hips.rotation.x = -1.3; m.arms[1].rotation.x = -0.5; m.arms[0].rotation.x = -2.6 + Math.sin(performance.now() / 300) * 0.3; }
      else { m.hips.position.y = 0.92; m.hips.rotation.x = 0; m.arms[1].rotation.x = -1.5 - r.pitch; m.arms[0].rotation.x = -1.3 - r.pitch * 0.8; m.arms[0].rotation.z = -0.4; }
      m.head.rotation.x = -r.pitch * 0.6;
      m.lamp.visible = r.lit && !r.dn;
      r.flashT = (r.flashT || 0) - dt; m.flash.visible = r.flashT > 0;
      // their voice, by distance
      if (vc) { const d = Math.hypot(r.x - P.x, r.z - P.z); vc.route(r.id, { on: true, pos: { x: r.x, y: r.y + 1.6, z: r.z }, volume: Math.max(0, Math.min(1, 1 - (d - 6) / 34)), occluded: !!indoorAt(r.x, r.z) !== !!indoorAt(P.x, P.z) }); }
    }
    // talking is noise
    if (mic.talking && !mic.muted && (R.talkT -= dt) <= 0) { R.talkT = 0.6; toHost({ t: 'noise', x: P.x, z: P.z, r: 9 }); }
    if (!$('mp').hidden) refreshLobby();
    hud();
  }
  function sendSnap() {
    const ps = [myState(), ...[...remote.values()].map((r) => ({ id: r.id, x: +r.tx.toFixed(2), z: +r.tz.toFixed(2), y: +r.ty.toFixed(2), yaw: +r.tyaw.toFixed(3), p: r.pitch, g: r.gun, l: r.lit ? 1 : 0, hp: r.hp, dn: r.dn ? 1 : 0, dd: r.dead ? 1 : 0, sh: r.sh, mv: r.mv, k: R.kills[r.id] || 0 }))];
    const pl = [P, ...remote.values()];
    const zs = zombies.snapshot((zb) => pl.some((p) => Math.hypot(p.x - zb.x, p.z - zb.z) < 95));
    net.broadcast({ t: 'snap', z: zs, h: +c.getHour().toFixed(3), n: R.night, nt: R.isNight ? 1 : 0, w: R.wave, ps }, { self: false });
  }
  function hostTick(dt) {
    const h = c.getHour(), nightNow = h >= 20 || h < 5.5;
    if (nightNow && !R.isNight) { R.isNight = true; R.night++; R.wave = 0; R.waveT = 6; toAll({ t: 'night', n: R.night }); }
    if (!nightNow && R.isNight) {
      R.isNight = false; toAll({ t: 'dawn', n: R.night });
      restock();
      // the ones who bled out come back, next to someone still standing
      const standing = [P, ...remote.values()].filter((p) => !p.dead && !(p === P ? P.downed : p.dn));
      const anchor = standing[0] || { x: START.x, z: START.z };
      if (P.dead) toAll({ t: 'respawn', who: myId(), x: anchor.x + 1, z: anchor.z + 1 });
      for (const r of remote.values()) if (r.dead) toAll({ t: 'respawn', who: r.id, x: anchor.x + 1.5, z: anchor.z - 1 });
    }
    if (R.isNight && (R.waveT -= dt) <= 0) { R.waveT = Math.max(24, 40 - R.night * 2); wave(); }
  }
  function wave() {
    R.wave++;
    const N = R.night, targets = [P, ...remote.values()].filter((p) => !p.dead && !(p === P ? P.downed : p.dn));
    for (const p of targets) {
      const n = Math.min(16, 3 + N * 2 + R.wave), rf = Math.min(0.7, 0.15 + N * 0.08);
      let made = 0;
      for (let tries = 0; tries < n * 8 && made < n; tries++) {
        const a = Math.random() * 6.283, d = 22 + Math.random() * 18, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (solid(x, z) || indoorAt(x, z) || Math.abs(x) > 200 || Math.abs(z) > 200) continue;
        const brute = N >= 3 && made === 0 && R.wave % 2 === 0;
        zombies.spawn(brute ? 'brute' : Math.random() < rf ? 'runner' : 'walker', x, z, { state: 'chase', scripted: false, speedMul: 1 + Math.min(0.4, N * 0.05) }); made++;
      }
    }
    toAll({ t: 'msg', text: `WAVE ${R.wave}` });
  }
  function restock() {
    const have = new Set(c.pickups.filter((p) => !p.taken).map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`));
    for (const l of W.loot) {
      if (have.has(`${l.x.toFixed(1)},${l.z.toFixed(1)}`) || Math.random() < 0.4) continue;
      drop(Math.random() < 0.4 ? 'med' : 'ammo', l.x, l.z);
    }
  }
  function drop(kind, x, z) { if (!isHost()) return; const id = R.pid++; toAll({ t: 'drop', id, kind, x: +x.toFixed(2), z: +z.toFixed(2) }); }
  function checkOver() {
    if (!isHost() || R.over) return;
    const all = [{ dn: P.downed, dead: P.dead }, ...remote.values()];
    if (all.every((p) => p.dn || p.dead)) {
      const names = {}; if (net) for (const r of net.roster) names[r.id] = r.name; else names.h = 'You';
      setTimeout(() => toAll({ t: 'over', nights: Math.max(0, R.night - (R.isNight ? 1 : 0)), kills: { ...R.kills }, names }), 1500);
    }
  }

  // ---------- you ----------
  // you hit 0: down (if anyone can still pick you up), or it's over
  function downLocal() {
    const others = [...remote.values()].filter((r) => !r.dead && !r.dn);
    if (!net || !others.length) {
      P.downed = true; P.bleed = 999; toHost({ t: 'down' });
      if (!net) { R.over = true; c.progress.survBest = Math.max(c.progress.survBest || 0, Math.max(0, R.night - (R.isNight ? 1 : 0))); c.persist(); setTimeout(() => c.end({ nights: Math.max(0, R.night - (R.isNight ? 1 : 0)), kills: { h: R.kills.h || 0 }, names: { h: 'You' } }), 1800); }
      else checkOver();
      return;
    }
    P.downed = true; P.bleed = 30; P.hp = 0;
    toHost({ t: 'down' }); ui.toast('YOU\'RE DOWN'); A.gasp();
  }
  function onKill(zb, w = {}) {
    if (!isHost()) return;
    const who = w.shooter || myId(); R.kills[who] = (R.kills[who] || 0) + 1;
    const r = Math.random(); if (r < 0.1) drop('ammo', zb.x, zb.z); else if (r < 0.14) drop('med', zb.x, zb.z);
  }
  function hurtRemote(id, dmg, kind, zb) { toOne(id, { t: 'hurt', d: dmg, k: kind, x: zb.x, z: zb.z }); }
  function sendHit(nid, part, dmg, dir, point, w) { if (net) net.send({ t: 'hit', i: nid, p: part, d: dmg, dx: +dir.x.toFixed(3), dy: +dir.y.toFixed(3), dz: +dir.z.toFixed(3), px: +point.x.toFixed(2), py: +point.y.toFixed(2), pz: +point.z.toFixed(2), h: w.head || 3, c: w.cut || 1 }); }
  function sendNoise(x, z, r) { toHost({ t: 'noise', x, z, r }); }
  // a supply under your feet: the host says who got it
  function take(p) {
    if (!net || net.isHost) { toAll({ t: 'gone', id: p.id }); return true; }
    if (p.pending) return false; p.pending = true; setTimeout(() => { p.pending = false; }, 1500);
    net.send({ t: 'take', id: p.id }); return false;
  }
  function players() {
    P.id = myId();
    return [P, ...[...remote.values()].map((r) => { r.downed = r.dn; return r; })];
  }
  // what you can use: revive a friend; the gun caches
  function interactables() {
    const out = [];
    for (const r of remote.values()) if (r.dn && !P.downed && !P.dead) out.push({ id: 'revive-' + r.id, at: () => ({ x: r.x, z: r.z }), hold: 2.4, label: `Hold to pick up ${nameOf(r.id)}`, when: () => r.dn, use: () => toHost({ t: 'revive', who: r.id }) });
    for (const k of CACHES) {
      const a = k.at(); if (!a) continue;
      if (!weapons.S.owned[k.gun]) out.push({ id: 'cache-' + k.gun, at: k.at, label: `Take the ${GUNS[k.gun].name} (${GUNS[k.gun].type})`, when: () => !weapons.S.owned[k.gun], use: () => { weapons.give(k.gun); weapons.addAmmo(k.gun, GUNS[k.gun].mag * 2); c.progress.guns[k.gun] = 1; ui.toast(`${GUNS[k.gun].name.toUpperCase()}  -  ${GUNS[k.gun].type.toUpperCase()}`); A.pickup(); } });
      else if (R.cacheDay[k.gun] !== R.night) out.push({ id: 'ammo-' + k.gun, at: k.at, label: `Take ${GUNS[k.gun].name} ammo`, when: () => R.cacheDay[k.gun] !== R.night, use: () => { R.cacheDay[k.gun] = R.night; weapons.addAmmo(k.gun, k.gun === 'minigun' ? 200 : GUNS[k.gun].mag * 3); ui.toast(`+ ${GUNS[k.gun].name.toUpperCase()} AMMO`); A.pickup(); } });
    }
    return out;
  }
  function objective() {
    const down = [...remote.values()].find((r) => r.dn);
    if (P.dead) return { main: 'Bled out', sub: ['Watching until dawn'], at: null };
    if (P.downed) return { main: 'Down', sub: [net && [...remote.values()].some((r) => !r.dn && !r.dead) ? `Hold on: ${Math.max(0, Math.ceil(P.bleed))} s` : 'Nobody is coming'], at: null };
    if (down) return { main: `Pick up ${nameOf(down.id)}`, sub: ['They\'re bleeding out'], at: { x: down.x, z: down.z } };
    const h = c.getHour();
    if (R.isNight) { const left = (h >= 20 ? 24 - h + 5.5 : 5.5 - h); return { main: `Night ${R.night}`, sub: [`Wave ${R.wave}`, `Dawn in ${fmtH(left)}`], at: null }; }
    const need = CACHES.filter((k) => !weapons.S.owned[k.gun]);
    const toDark = h < 20 ? 20 - h : 0;
    if (need.length) { need.sort((a, b) => dist(a.at()) - dist(b.at())); const k = need[0]; return { main: R.night ? `Day ${R.night + 1}` : 'Scavenge', sub: [`${GUNS[k.gun].type}: ${k.where}`, `Dark in ${fmtH(toDark)}`], at: k.at() }; }
    return { main: `Day ${R.night + 1}`, sub: ['Ammo restocks at the gun caches each day', `Dark in ${fmtH(toDark)}`], at: null };
  }
  const dist = (a) => (a ? Math.hypot(a.x - P.x, a.z - P.z) : 1e9);
  const fmtH = (gh) => { const s = Math.max(0, Math.round(gh * 50)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // spectating while you're out: through a friend's eyes
  function spectate() {
    const r = [...remote.values()].find((q) => !q.dead) || null; if (!r) return null;
    return { x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch };
  }
  function hud() {
    const box = $('team');
    if (!on) { box.hidden = true; return; }
    box.hidden = false;
    const rows = [{ id: myId(), name: net ? nameOf(myId()) : 'You', hp: P.hp, dn: P.downed, dead: P.dead }, ...[...remote.values()].map((r) => ({ id: r.id, name: nameOf(r.id), hp: r.hp, dn: r.dn, dead: r.dead }))];
    box.innerHTML = `<div class="tn">${R.isNight ? `NIGHT ${R.night} · WAVE ${R.wave}` : `DAY ${R.night + 1}`}</div>` + (rows.length > 1 || net ? rows.map((r) => `<div class="tm ${r.dn ? 'dn' : ''} ${r.dead ? 'dead' : ''}"><span>${esc(r.name)}${vc?.talking(r.id) || (r.id === myId() && mic.talking && !mic.muted) ? ' ◖' : ''}</span><i><b style="width:${Math.max(0, r.hp)}%"></b></i><em>${r.dead ? 'out' : r.dn ? 'DOWN' : R.kills[r.id] || 0}</em></div>`).join('') : `<div class="tm"><span>Kills</span><em>${R.kills.h || 0}</em></div>`);
  }
  function setMute(m) { mic.muted = m; localStorage.setItem(MIC_KEY, m ? '0' : '1'); }

  // ---------- the lobby buttons ----------
  $('mpHost').onclick = () => hostRoom();
  $('mpJoin').onclick = () => joinRoom();
  $('mpSolo').onclick = () => { myName(); playSolo(); };
  $('mpStart').onclick = () => { if (R.started && on) { c.only(null); c.resume(); } else startGame(); };
  $('mpLeave').onclick = () => { leave(); refreshLobby(); };
  $('mpBack').onclick = () => { if (!net) c.toTitle(); else { leave(); c.toTitle(); } };
  $('mpCopy').onclick = () => { const url = location.origin + location.pathname + '?room=' + net.code; navigator.clipboard?.writeText(url).then(() => status('Invite link copied.'), () => status(url)); };
  $('mpVoiceMode').onchange = () => { localStorage.setItem(VMODE_KEY, $('mpVoiceMode').value); if (vc) vc.mode = $('mpVoiceMode').value; };
  $('mpMic').onchange = () => { setMute(!$('mpMic').checked); if ($('mpMic').checked && net && !mic.stream) { mic.start().then((ok) => { if (ok && vc) { vc.dispose(); vc = new VoiceChat(net, mic.stream); vc.mode = $('mpVoiceMode').value; vc.sync(net.roster); } else status(mic.error); }); } };
  $('mpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });

  return {
    active: () => on, online, isHost, myId, openLobby, leave, update, players, downLocal, onKill, hurtRemote, sendHit, sendNoise, take, interactables, objective, spectate,
    get mic() { return mic; }, get net() { return net; }, R, startGame, setMute, remote, playSolo, refreshLobby, handle,
  };
}
