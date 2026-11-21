// REMISSION sound, all made live with Web Audio: guns, the dead, the city, the radio, the things at night. No sound files.

let ctx = null, master, sfx, amb, verb, verbIn, noiseBuf, listenerReady = false;
export const audio = { vol: 0.8, get ctx() { return ctx; } };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = audio.vol;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  amb = ctx.createGain(); amb.gain.value = 0.9; amb.connect(master);
  // a small dark room reverb
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb); const vo = ctx.createGain(); vo.gain.value = 0.5; verb.connect(vo).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  startAmbience();
}
export function setVolume(v) { audio.vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }

const now = () => ctx.currentTime;
function noise(loop = false) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; if (!loop) s.loopStart = 0; return s; }
function env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }

// ---------- 3D: sounds placed in the house ----------
export function setListener(pos, fwd) {
  if (!ctx) return; const L = ctx.listener;
  if (L.positionX) { L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z; L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
  else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  listenerReady = true;
}
// muffled = behind walls / on another floor (0 clear .. 1 very muffled)
function out(pos, muffled = 0, wet = 0.4) {
  const g = ctx.createGain();
  let node = g;
  if (muffled > 0) { const lp = filt('lowpass', 5000 * Math.pow(0.12, muffled)); g.connect(lp); node = lp; }
  if (pos && listenerReady) {
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1.3; p.maxDistance = 40;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    node.connect(p); p.connect(sfx); const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(verbIn);
  } else { node.connect(sfx); const w = ctx.createGain(); w.gain.value = wet; node.connect(w).connect(verbIn); }
  return g;
}
export const occl = { fn: () => 0 }; // set by the game: how muffled a position is from where you are

// ---------- one-shots ----------
export function step(pos, surface = 'wood', vol = 0.3, muffled = 0) {
  if (!ctx) return; const t = now();
  const s = noise(), g = out(pos, muffled, 0.25);
  const f = { wood: [500, 1.2], carpet: [260, 0.8], tile: [1600, 2], concrete: [900, 1.5], dirt: [300, 0.7] }[surface] || [500, 1];
  const bp = filt('bandpass', f[0] * (0.85 + Math.random() * 0.3), f[1]);
  s.connect(bp).connect(g); env(g, t, 0.005, vol, 0.09); s.start(t, Math.random()); s.stop(t + 0.15);
  if (surface === 'wood' && Math.random() < 0.18) creak(pos, vol * 0.5, muffled, 0.25);
}
export function creak(pos, vol = 0.25, muffled = 0, len = 0.5) {
  if (!ctx) return; const t = now();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const base = 90 + Math.random() * 120; o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.8), t + len);
  const am = ctx.createOscillator(); am.frequency.value = 18 + Math.random() * 30; const amg = ctx.createGain(); amg.gain.value = 0.5; am.connect(amg);
  const g = out(pos, muffled, 0.6), bp = filt('bandpass', 900 + Math.random() * 900, 6), vg = ctx.createGain(); vg.gain.value = 0.5; amg.connect(vg.gain);
  o.connect(bp).connect(vg).connect(g); env(g, t, 0.05, vol, len); o.start(t); am.start(t); o.stop(t + len + 0.1); am.stop(t + len + 0.1);
}
export function doorSound(pos, open = true, slam = false, muffled = 0) {
  if (!ctx) return;
  if (slam) { thud(pos, 0.9, muffled, 70); creak(pos, 0.3, muffled, 0.2); return; }
  creak(pos, 0.22, muffled, open ? 0.7 + Math.random() * 0.5 : 0.35);
  if (!open) setTimeout(() => thud(pos, 0.35, muffled, 110), 330);
}
export function thud(pos, vol = 0.5, muffled = 0, freq = 90) {
  if (!ctx) return; const t = now();
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.2);
  const g = out(pos, muffled, 0.6); o.connect(g); env(g, t, 0.004, vol, 0.3); o.start(t); o.stop(t + 0.4);
  const n = noise(), ng = out(pos, muffled, 0.5), lp = filt('lowpass', 900); n.connect(lp).connect(ng); env(ng, t, 0.002, vol * 0.5, 0.12); n.start(t); n.stop(t + 0.2);
}
export function knock(pos, n = 3, muffled = 0.2, vol = 0.6) { for (let i = 0; i < n; i++) setTimeout(() => thud(pos, vol, muffled, 140 + Math.random() * 20), i * (260 + Math.random() * 80)); }
export function click(vol = 0.25) {
  if (!ctx) return; const t = now(); const n = noise(), g = out(null, 0, 0.05), hp = filt('highpass', 2500);
  n.connect(hp).connect(g); env(g, t, 0.001, vol, 0.03); n.start(t, Math.random()); n.stop(t + 0.05);
}
export function pickup() {
  if (!ctx) return; const t = now();
  const n = noise(), g = out(null, 0, 0.1), bp = filt('bandpass', 3000, 2); n.connect(bp).connect(g); env(g, t, 0.01, 0.15, 0.15); n.start(t, Math.random()); n.stop(t + 0.2);
}
export function paper() {
  if (!ctx) return; const t = now();
  for (let i = 0; i < 4; i++) { const n = noise(), g = out(null, 0, 0.1), bp = filt('bandpass', 2500 + Math.random() * 2000, 1); n.connect(bp).connect(g); env(g, t + i * 0.05, 0.01, 0.12, 0.06); n.start(t + i * 0.05, Math.random()); n.stop(t + i * 0.05 + 0.1); }
}
// a sharp stinger for scares: a stab of dissonant strings and a hit
export function sting(vol = 0.5) {
  if (!ctx) return; const t = now();
  for (const fq of [233, 247, 349, 370, 494]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fq, t); o.frequency.linearRampToValueAtTime(fq * 0.97, t + 1.4);
    const g = out(null, 0, 0.6), lp = filt('lowpass', 2800); o.connect(lp).connect(g); env(g, t, 0.01, vol * 0.13, 1.6); o.start(t); o.stop(t + 1.8);
  }
  thud(null, vol, 0, 55);
}
export function thunder(dist = 0.5) {
  if (!ctx) return; const t = now() + dist * 1.2;
  const n = noise(), g = out(null, 0, 0.8), lp = filt('lowpass', 260);
  n.connect(lp).connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 - dist * 0.25, t + 0.08); g.gain.exponentialRampToValueAtTime(0.25, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
  n.start(t); n.stop(t + 4.2);
}
// ---------- loops you can start and stop ----------
// static from the baby monitor / the TV / the phone line
export function staticLoop(pos, vol = 0.12) {
  if (!ctx) return { stop() {}, set() {} };
  const n = noise(true), bp = filt('bandpass', 2200, 0.7), g = out(pos, 0, 0.3); g.gain.value = 0;
  const crackle = ctx.createGain(); crackle.gain.value = 1;
  n.connect(bp).connect(crackle).connect(g); n.start();
  g.gain.setTargetAtTime(vol, now(), 0.05);
  let alive = true; const tick = () => { if (!alive) return; crackle.gain.setValueAtTime(0.4 + Math.random() * 0.8, now()); setTimeout(tick, 30 + Math.random() * 90); }; tick();
  return { stop() { alive = false; g.gain.setTargetAtTime(0.0001, now(), 0.05); setTimeout(() => n.stop(), 400); }, set(v) { g.gain.setTargetAtTime(v, now(), 0.1); } };
}
// your own breathing: faster when you run, ragged when you're scared, gone when you hold it
let breathG = null, breathF = null, breathT = 0;
export function breath(dt, rate, vol) {
  if (!ctx) return;
  if (!breathG) { const n = noise(true); breathF = filt('bandpass', 700, 1.2); breathG = ctx.createGain(); breathG.gain.value = 0; n.connect(breathF).connect(breathG).connect(sfx); n.start(); }
  breathT += dt * rate;
  const ph = (breathT % 1), inhale = ph < 0.45, k = inhale ? Math.sin((ph / 0.45) * Math.PI) : Math.sin(((ph - 0.45) / 0.55) * Math.PI) * 0.7;
  breathG.gain.setTargetAtTime(Math.max(0, k) * vol, now(), 0.03);
  breathF.frequency.setTargetAtTime(inhale ? 900 : 600, now(), 0.05);
}

export function scream(pos, vol = 1, len = 1.6) {
  if (!ctx) return; const t = now();
  const g = out(pos, 0, 0.7);
  for (const [fq, ty] of [[620, 'sawtooth'], [655, 'square'], [930, 'sawtooth'], [310, 'sawtooth']]) {
    const o = ctx.createOscillator(); o.type = ty; o.frequency.setValueAtTime(fq * 0.7, t); o.frequency.exponentialRampToValueAtTime(fq * 1.3, t + 0.12); o.frequency.exponentialRampToValueAtTime(fq * 0.5, t + len);
    const vib = ctx.createOscillator(); vib.frequency.value = 9 + Math.random() * 6; const vg = ctx.createGain(); vg.gain.value = fq * 0.05; vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + len);
    const og = ctx.createGain(); og.gain.value = 0.07; o.connect(og).connect(g); o.start(t); o.stop(t + len);
  }
  const n = noise(), bp = filt('bandpass', 1500, 0.8), ng = ctx.createGain(); ng.gain.value = 0.6; n.connect(bp).connect(ng).connect(g); n.start(t); n.stop(t + len);
  env(g, t, 0.02, vol, len);
}
// whispering: shaped noise through moving formants
export function whisper(pos, muffled = 0, len = 1.6, vol = 0.18) {
  if (!ctx) return; const t = now();
  const n = noise(), g = out(pos, muffled, 0.6), hp = filt('highpass', 900);
  const f1 = filt('bandpass', 1200, 6), f2 = filt('bandpass', 2600, 8), mix = ctx.createGain();
  n.connect(hp); hp.connect(f1).connect(mix); hp.connect(f2).connect(mix); mix.connect(g);
  const syll = Math.floor(len * 5);
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < syll; i++) { const tt = t + i * (len / syll); g.gain.linearRampToValueAtTime(vol * (0.4 + Math.random() * 0.6), tt + 0.04); g.gain.linearRampToValueAtTime(vol * 0.05, tt + len / syll * 0.9); f1.frequency.setValueAtTime(800 + Math.random() * 900, tt); f2.frequency.setValueAtTime(2000 + Math.random() * 1500, tt); }
  g.gain.linearRampToValueAtTime(0.0001, t + len + 0.1);
  n.start(t, Math.random()); n.stop(t + len + 0.2);
}
// ---------- dread ----------
// the house goes quiet: the rain and the wind drop away for a few seconds (before something happens)
let hushUntil = 0;
export function hush(sec = 3) {
  if (!ctx) return; const t = now(); hushUntil = t + sec;
  amb.gain.cancelScheduledValues(t); amb.gain.setTargetAtTime(0.12, t, 0.35); amb.gain.setTargetAtTime(0.9, t + sec, 1.2);
}
export const hushed = () => !!ctx && now() < hushUntil;
// its neck: a wet crack, then the small clicks of it turning
export function crack(pos, muffled = 0) {
  if (!ctx) return; const t = now();
  for (let i = 0; i < 7; i++) {
    const n = noise(), g = out(pos, muffled, 0.3), b = filt('bandpass', 1400 + Math.random() * 3000, 6);
    const tt = t + (i === 0 ? 0 : 0.12 + i * 0.05 + Math.random() * 0.03);
    n.connect(b).connect(g); env(g, tt, 0.001, i === 0 ? 0.7 : 0.25, i === 0 ? 0.05 : 0.02); n.start(tt, Math.random()); n.stop(tt + 0.12);
  }
}

// ---------- bodies ----------
export function glass(pos, vol = 0.5) {
  if (!ctx) return; const t = now();
  for (let i = 0; i < 14; i++) { const m = noise(), mg = out(pos, 0, 0.3), b = filt('bandpass', 3500 + Math.random() * 5000, 9); m.connect(b).connect(mg); const tt = t + Math.random() * 0.5; env(mg, tt, 0.001, vol * 0.25, 0.06 + Math.random() * 0.1); m.start(tt, Math.random()); m.stop(tt + 0.25); }
}
export function splat(pos, vol = 0.8) {
  if (!ctx) return; const t = now();
  const n = noise(), lp = filt('lowpass', 700), g = out(pos, 0, 0.4); n.connect(lp).connect(g); env(g, t, 0.003, vol, 0.25); n.start(t, Math.random()); n.stop(t + 0.35);
  thud(pos, vol * 0.8, 0, 55);
  for (let i = 0; i < 4; i++) { const m = noise(), mg = out(pos, 0, 0.2), b = filt('bandpass', 400 + Math.random() * 500, 3); m.connect(b).connect(mg); const tt = t + 0.05 + Math.random() * 0.3; env(mg, tt, 0.01, vol * 0.3, 0.12); m.start(tt, Math.random()); m.stop(tt + 0.2); }
}
export function crunch(pos, vol = 0.8) {
  if (!ctx) return; crack(pos, 0); splat(pos, vol);
  const t = now(); for (let i = 0; i < 10; i++) { const n = noise(), g = out(pos, 0, 0.2), b = filt('bandpass', 900 + Math.random() * 2400, 5); const tt = t + Math.random() * 0.2; n.connect(b).connect(g); env(g, tt, 0.001, vol * 0.4, 0.03); n.start(tt, Math.random()); n.stop(tt + 0.08); }
}
// a knife going in: a wet scrape and a pop, again and again (carving)
export function roar(pos, vol = 1) {
  if (!ctx) return; const t = now(), len = 1.8, g = out(pos, 0, 0.8);
  for (const [fq, ty] of [[110, 'sawtooth'], [116, 'sawtooth'], [233, 'square'], [55, 'sawtooth']]) {
    const o = ctx.createOscillator(); o.type = ty; o.frequency.setValueAtTime(fq * 1.3, t); o.frequency.exponentialRampToValueAtTime(fq * 0.7, t + len);
    const og = ctx.createGain(); og.gain.value = 0.12; const lp = filt('lowpass', 1600); o.connect(lp).connect(og).connect(g); o.start(t); o.stop(t + len);
  }
  const n = noise(), bp = filt('bandpass', 700, 0.6), ng = ctx.createGain(); ng.gain.value = 0.8; n.connect(bp).connect(ng).connect(g); n.start(t); n.stop(t + len);
  env(g, t, 0.05, vol, len);
}

export function squelch() {
  if (!ctx) return; const t = now(); const n = noise(), hp = filt('bandpass', 2600, 1), g = out(null, 0, 0.05); n.connect(hp).connect(g); env(g, t, 0.005, 0.2, 0.18); n.start(t, Math.random()); n.stop(t + 0.25);
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1400; const og = out(null, 0, 0); o.connect(og); env(og, t + 0.18, 0.002, 0.04, 0.05); o.start(t + 0.18); o.stop(t + 0.26);
}
export function musicBox(pos) {
  if (!ctx) return { stop() {} };
  const notes = [76, 79, 84, 83, 79, 76, 74, 76, 79, 77, 74, 71, 72];
  let alive = true, i = 0;
  const tick = () => {
    if (!alive) return;
    const n = notes[i++ % notes.length], t = now();
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 440 * Math.pow(2, (n - 69) / 12) * (1 + (Math.random() - 0.5) * 0.012);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = o.frequency.value * 3.01;
    const g = out(pos, 0, 0.6), g2 = ctx.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2).connect(g); env(g, t, 0.003, 0.08, 1.2); o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
    setTimeout(tick, (i % notes.length === 0 ? 1800 : 420) * (1 + i * 0.002));
  };
  tick();
  return { stop() { alive = false; } };
}
// the guillotine: the chain rattling it up, and the drop
export function heartbeat(dt, bpm, vol) {
  if (!ctx || vol < 0.01) return;
  heartT -= dt; if (heartT > 0) return; heartT = 60 / bpm;
  const t = now();
  for (const [o, v] of [[0, 1], [0.16, 0.7]]) { const s = ctx.createOscillator(); s.frequency.setValueAtTime(70, t + o); s.frequency.exponentialRampToValueAtTime(38, t + o + 0.12); const g = out(null, 0, 0); s.connect(g); env(g, t + o, 0.008, vol * v, 0.16); s.start(t + o); s.stop(t + o + 0.25); }
}
export function presence(vol = 0.3, len = 3) {
  if (!ctx) return; const t = now();
  for (const fq of [55, 58.3, 110.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; const lp = filt('lowpass', 300); const g = out(null, 0, 0.8); o.connect(lp).connect(g); env(g, t, 0.6, vol * 0.2, len); o.start(t); o.stop(t + len + 0.7); }
}
export function gasp() {
  if (!ctx) return; const t = now(); const n = noise(), bp = filt('bandpass', 900, 1.5), g = out(null, 0, 0.1); n.connect(bp).connect(g);
  bp.frequency.setValueAtTime(600, t); bp.frequency.linearRampToValueAtTime(1400, t + 0.35); env(g, t, 0.05, 0.35, 0.4); n.start(t, Math.random()); n.stop(t + 0.5);
}

// ---------- guns ----------
// each gun: a crack (bright noise), a body (low thump), a tail (the city echoing it back)
const GUN = {
  pistol: { crack: 2600, body: 120, vol: 0.55, tail: 0.5, len: 0.12 },
  smg: { crack: 3200, body: 150, vol: 0.42, tail: 0.35, len: 0.08 },
  rifle: { crack: 2200, body: 95, vol: 0.6, tail: 0.6, len: 0.12 },
  sniper: { crack: 1500, body: 60, vol: 0.95, tail: 1.2, len: 0.25 },
  minigun: { crack: 2800, body: 110, vol: 0.32, tail: 0.3, len: 0.06 },
};
export function gunshot(kind, indoors = 0) {
  if (!ctx) return; const t = now(), G = GUN[kind] || GUN.pistol;
  const n = noise(), hp = filt('bandpass', G.crack * (0.9 + Math.random() * 0.2), 0.7), g = out(null, 0, 0.15 + indoors * 0.5);
  n.connect(hp).connect(g); env(g, t, 0.001, G.vol, G.len); n.start(t, Math.random()); n.stop(t + G.len + 0.05);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(G.body * 2, t); o.frequency.exponentialRampToValueAtTime(G.body * 0.5, t + 0.12);
  const og = out(null, 0, 0.2); o.connect(og); env(og, t, 0.001, G.vol * 0.9, 0.14); o.start(t); o.stop(t + 0.2);
  // the echo off the buildings
  const e = noise(), lp = filt('lowpass', 900), eg = out(null, 0, 0.1); e.connect(lp).connect(eg);
  const d = 0.08 + Math.random() * 0.06; eg.gain.setValueAtTime(0.0001, t); eg.gain.exponentialRampToValueAtTime(G.vol * 0.25 * G.tail, t + d); eg.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3 + G.tail);
  e.start(t, Math.random()); e.stop(t + d + G.tail + 0.4);
}
export function dryFire() { click(0.35); }
export function mech(kind = 'in') { // reload parts: mag out / mag in / bolt / belt / slide
  if (!ctx) return; const t = now();
  const f = { out: [1800, 0.15], in: [1200, 0.3], bolt: [2200, 0.35], belt: [900, 0.2], slide: [2600, 0.3] }[kind] || [1500, 0.2];
  const n = noise(), bp = filt('bandpass', f[0], 4), g = out(null, 0, 0.05); n.connect(bp).connect(g); env(g, t, 0.001, f[1], 0.05); n.start(t, Math.random()); n.stop(t + 0.08);
  const n2 = noise(), bp2 = filt('bandpass', f[0] * 0.6, 3), g2 = out(null, 0, 0.05); n2.connect(bp2).connect(g2); env(g2, t + 0.06, 0.001, f[1] * 0.7, 0.04); n2.start(t + 0.06, Math.random()); n2.stop(t + 0.12);
}
// the minigun's barrels spinning; set every frame (0..1)
let spinO = null, spinG = null;
export function spin(level) {
  if (!ctx) return;
  if (!spinO) { spinO = ctx.createOscillator(); spinO.type = 'sawtooth'; spinG = ctx.createGain(); spinG.gain.value = 0; const lp = filt('lowpass', 1200); spinO.connect(lp).connect(spinG).connect(sfx); spinO.start(); }
  spinO.frequency.setTargetAtTime(40 + level * 220, now(), 0.05); spinG.gain.setTargetAtTime(level > 0.01 ? 0.03 + level * 0.05 : 0, now(), 0.08);
}
export function impact(pos, what = 'stone') {
  if (!ctx) return; const t = now();
  if (what === 'flesh') { const n = noise(), lp = filt('lowpass', 900), g = out(pos, 0, 0.2); n.connect(lp).connect(g); env(g, t, 0.002, 0.45, 0.09); n.start(t, Math.random()); n.stop(t + 0.14); return; }
  const n = noise(), bp = filt('bandpass', what === 'metal' ? 4200 : 2000, what === 'metal' ? 8 : 2), g = out(pos, 0, 0.3); n.connect(bp).connect(g); env(g, t, 0.001, 0.22, what === 'metal' ? 0.2 : 0.06); n.start(t, Math.random()); n.stop(t + 0.25);
}
export function shell() { // a casing hitting the street
  if (!ctx) return; const t = now() + 0.25 + Math.random() * 0.15;
  for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(); o.frequency.value = 5200 + Math.random() * 1800; const g = out(null, 0, 0.1); o.connect(g); env(g, t + i * 0.07, 0.001, 0.02, 0.06); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.08); }
}
export function swing() { // the knife
  if (!ctx) return; const t = now(); const n = noise(), bp = filt('bandpass', 1200, 1.5), g = out(null, 0, 0.1); n.connect(bp).connect(g);
  bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.15); env(g, t, 0.02, 0.25, 0.15); n.start(t, Math.random()); n.stop(t + 0.2);
}
export function boom(pos, vol = 1) {
  if (!ctx) return; const t = now();
  const n = noise(), lp = filt('lowpass', 400), g = out(pos, 0, 0.9); n.connect(lp).connect(g); env(g, t, 0.005, vol, 2.2); lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.5); n.start(t); n.stop(t + 2.4);
  thud(pos, vol, 0, 40);
}
export function heal() {
  if (!ctx) return; const t = now(); const n = noise(), bp = filt('bandpass', 5000, 3), g = out(null, 0, 0.05); n.connect(bp).connect(g); env(g, t, 0.05, 0.12, 0.4); n.start(t, Math.random()); n.stop(t + 0.5);
}

// ---------- the dead ----------
// a groan: a sawtooth through a moving vowel; vary = this zombie's own voice
export function groan(pos, vary = 0.5, vol = 0.35, muffled = 0, len = 1.2) {
  if (!ctx) return; const t = now();
  const o = ctx.createOscillator(); o.type = 'sawtooth'; const f0 = 70 + vary * 70;
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.8 + Math.random() * 0.5), t + len * 0.6); o.frequency.linearRampToValueAtTime(f0 * 0.7, t + len);
  const jit = ctx.createOscillator(); jit.frequency.value = 18 + Math.random() * 14; const jg = ctx.createGain(); jg.gain.value = f0 * 0.12; jit.connect(jg).connect(o.frequency);
  const f1 = filt('bandpass', 500 + vary * 300, 4), f2 = filt('bandpass', 1100 + vary * 500, 6), mix = ctx.createGain(), g = out(pos, muffled, 0.35);
  o.connect(f1).connect(mix); o.connect(f2).connect(mix); mix.connect(g);
  f1.frequency.setValueAtTime(400 + vary * 200, t); f1.frequency.linearRampToValueAtTime(700 + Math.random() * 300, t + len);
  const n = noise(), nb = filt('bandpass', 900, 1), ng = ctx.createGain(); ng.gain.value = 0.35; n.connect(nb).connect(ng).connect(g);
  env(g, t, 0.15, vol, len); o.start(t); jit.start(t); n.start(t, Math.random()); o.stop(t + len + 0.2); jit.stop(t + len + 0.2); n.stop(t + len + 0.2);
}
export function snarl(pos, vary = 0.5, vol = 0.6) { groan(pos, Math.min(1, vary + 0.4), vol, 0, 0.45); if (!ctx) return; const t = now(); const n = noise(), bp = filt('bandpass', 2200, 1), g = out(pos, 0, 0.3); n.connect(bp).connect(g); env(g, t, 0.01, vol * 0.4, 0.35); n.start(t, Math.random()); n.stop(t + 0.4); }
export function bite(pos) { crunch(pos, 0.6); snarl(pos, 0.7, 0.5); }
export function bodyfall(pos) { thud(pos, 0.5, 0, 70); }
// a runner's shriek when it sees you, at night
export function shriek(pos) {
  if (!ctx) return; const t = now(), len = 1.3, g = out(pos, 0, 0.8);
  for (const fq of [760, 812, 1140]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fq * 0.7, t); o.frequency.linearRampToValueAtTime(fq, t + 0.15); o.frequency.exponentialRampToValueAtTime(fq * 0.6, t + len);
    const vib = ctx.createOscillator(); vib.frequency.value = 11; const vg = ctx.createGain(); vg.gain.value = fq * 0.05; vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + len);
    const og = ctx.createGain(); og.gain.value = 0.06; const bp = filt('bandpass', 1500, 1.2); o.connect(bp).connect(og).connect(g); o.start(t); o.stop(t + len);
  }
  env(g, t, 0.04, 0.9, len);
}
export function giggle(pos, vol = 0.12, muffled = 0.3) {
  if (!ctx) return; const t = now(), n = 4 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const tt = t + i * (0.11 + Math.random() * 0.04);
    const o = ctx.createOscillator(); o.type = 'triangle'; const f = 520 + Math.random() * 180; o.frequency.setValueAtTime(f * 1.15, tt); o.frequency.exponentialRampToValueAtTime(f * 0.9, tt + 0.09);
    const bp = filt('bandpass', 1600, 2), g = out(pos, muffled, 0.6); o.connect(bp).connect(g); env(g, tt, 0.01, vol * (1 - i / n * 0.5), 0.08); o.start(tt); o.stop(tt + 0.12);
  }
}

// ---------- the radio and the street ----------
let radioG = null;
export function radioHiss(level) {
  if (!ctx) return;
  if (!radioG) { const n = noise(true), bf = filt('bandpass', 2400, 0.8); radioG = ctx.createGain(); radioG.gain.value = 0; const cr = ctx.createGain(); n.connect(bf).connect(cr).connect(radioG).connect(sfx); n.start(); const tick = () => { cr.gain.setValueAtTime(0.3 + Math.random() * 0.9, now()); setTimeout(tick, 25 + Math.random() * 80); }; tick(); }
  radioG.gain.setTargetAtTime(level * 0.06, now(), 0.08);
}
export function siren(pos, len = 6) {
  if (!ctx) return; const t = now();
  const o = ctx.createOscillator(); o.type = 'triangle'; const g = out(pos, 0.5, 0.9); const lp = filt('lowpass', 1800); o.connect(lp).connect(g);
  for (let i = 0; i < len; i++) { o.frequency.setValueAtTime(600, t + i); o.frequency.linearRampToValueAtTime(950, t + i + 0.5); o.frequency.linearRampToValueAtTime(600, t + i + 1); }
  env(g, t, 1.5, 0.12, len); o.start(t); o.stop(t + len + 1.6);
}
export function carAlarm(pos, len = 5) {
  if (!ctx) return; const t = now(); const o = ctx.createOscillator(); o.type = 'square'; const g = out(pos, 0, 0.5); const bp = filt('bandpass', 1400, 2); o.connect(bp).connect(g);
  for (let i = 0; i < len * 4; i++) o.frequency.setValueAtTime(i % 2 ? 900 : 1300, t + i * 0.25);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.setValueAtTime(0.18, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1); o.start(t); o.stop(t + len + 0.2);
}
export function crow(pos) {
  if (!ctx) return; const t = now();
  for (let i = 0; i < 2 + ((Math.random() * 2) | 0); i++) { const tt = t + i * 0.4, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(700, tt); o.frequency.exponentialRampToValueAtTime(420, tt + 0.22); const bp = filt('bandpass', 1300, 2), g = out(pos, 0.2, 0.6); o.connect(bp).connect(g); env(g, tt, 0.01, 0.08, 0.22); o.start(tt); o.stop(tt + 0.26); }
}
export function flicker(pos) { // a fluorescent tube buzzing out
  if (!ctx) return; const t = now(); const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 120; const g = out(pos, 0, 0.2), bp = filt('bandpass', 2400, 3); o.connect(bp).connect(g);
  g.gain.setValueAtTime(0.0001, t); for (let i = 0; i < 6; i++) { g.gain.setValueAtTime(Math.random() < 0.5 ? 0.05 : 0.0001, t + i * 0.07); } g.gain.setValueAtTime(0.0001, t + 0.5); o.start(t); o.stop(t + 0.55);
}

// ---------- the city: wind between towers; by day crows and far sirens; by night a drone, screams, and things too close ----------
let windG, windF, droneG, droneF, fireG, heartT = 0, eventT = 5;
function startAmbience() {
  const w = noise(true); windF = filt('bandpass', 420, 0.5); windG = ctx.createGain(); windG.gain.value = 0.05;
  w.connect(windF).connect(windG).connect(amb); w.start();
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lg = ctx.createGain(); lg.gain.value = 240; lfo.connect(lg).connect(windF.frequency); lfo.start();
  droneG = ctx.createGain(); droneG.gain.value = 0; droneF = filt('lowpass', 200);
  for (const fq of [36.7, 37.2, 55, 73.6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.connect(droneF); o.start(); }
  droneF.connect(droneG).connect(amb);
  const f = noise(true), ff = filt('lowpass', 600); fireG = ctx.createGain(); fireG.gain.value = 0; f.connect(ff).connect(fireG).connect(amb); f.start();
}
// night 0..1, fear 0..1, indoors 0..1, nearFire 0..1, listener {x,z}; onCreep(kind, pos) lets the game show what you heard
export function ambience(dt, { night = 0, fear = 0, indoors = 0, nearFire = 0, listener = null, onCreep = null }) {
  if (!ctx) return;
  const t = now();
  windG.gain.setTargetAtTime((0.03 + night * 0.04) * (1 - indoors * 0.7), t, 0.5);
  droneG.gain.setTargetAtTime(Math.min(0.2, fear * 0.14 + night * 0.05), t, 0.8);
  droneF.frequency.setTargetAtTime(120 + fear * 500, t, 0.6);
  fireG.gain.setTargetAtTime(nearFire * 0.12, t, 0.3);
  if ((eventT -= dt) <= 0) {
    eventT = (night > 0.5 ? 6 : 10) + Math.random() * 12;
    if (!listener) return;
    const a = Math.random() * 6.3, d = 30 + Math.random() * 40, pos = { x: listener.x + Math.cos(a) * d, y: 2, z: listener.z + Math.sin(a) * d };
    const r = Math.random();
    if (night < 0.5) { if (r < 0.35) crow(pos); else if (r < 0.55) siren(pos, 5); else if (r < 0.75) groan(pos, Math.random(), 0.25, 0.5, 1.8); else if (r < 0.85) carAlarm(pos, 3); else dog(pos, 0.6); }
    else {
      if (r < 0.25) scream(pos, 0.35, 2.2); else if (r < 0.45) groan(pos, Math.random(), 0.3, 0.3, 2); else if (r < 0.6) shriek(pos);
      else if (r < 0.75) { const near = { x: listener.x + Math.cos(a) * 3, y: 1.6, z: listener.z + Math.sin(a) * 3 }; whisper(near, 0, 1.4, 0.12); onCreep?.('whisper', near); }
      else if (r < 0.85) { giggle(pos, 0.08, 0.4); onCreep?.('giggle', pos); } else dog(pos, 0.5);
    }
  }
}
export function dog(pos, muffled = 0.4) {
  if (!ctx) return; const t = now();
  for (let i = 0; i < 2 + ((Math.random() * 2) | 0); i++) {
    const tt = t + i * 0.32, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(420, tt); o.frequency.exponentialRampToValueAtTime(240, tt + 0.12);
    const bp = filt('bandpass', 900, 1.5), g = out(pos, muffled, 0.7); o.connect(bp).connect(g); env(g, tt, 0.005, 0.12, 0.13); o.start(tt); o.stop(tt + 0.16);
  }
}
