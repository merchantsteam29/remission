// Voice chat for playing together (ported from Mimic, where the first version was too quiet and went robotic).
// A WebRTC call between every pair of players (at most 4, so at most 3 calls each), on the room's PeerJS peer.
// It's proximity chat: a friend's voice fades with distance, through walls, between floors.
//   clear (default) - the browser plays the call itself, like a video call: the best quality, echo cancelling works.
//   3d              - through Web Audio, placed in the house (left / right, muffled through the walls).
// Your microphone also does two other things, and both are the point:
//   - it is loud. The thing in the house can hear you talking.
//   - it is listening. It keeps short pieces of what you say, and uses them later, from somewhere in the dark.
import { audio, voiceBus } from './audio.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// better Opus: a higher bitrate and forward error correction, so lost packets don't turn robotic
function betterAudio(sdp) {
  const pt = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp)?.[1];
  if (!pt) return sdp;
  const line = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`);
  const extra = 'maxaveragebitrate=64000;useinbandfec=1;usedtx=0;stereo=0';
  return line.test(sdp) ? sdp.replace(line, (m, p) => `a=fmtp:${pt} ${p.split(';').filter((k) => !/^(maxaveragebitrate|useinbandfec|usedtx|stereo)=/.test(k)).concat(extra).join(';')}`)
    : sdp.replace(new RegExp(`(a=rtpmap:${pt} opus/48000[^\\r\\n]*)`), `$1\r\na=fmtp:${pt} ${extra}`);
}

// ---------- your microphone ----------
export const CLIP_RATE = 16000;
export class Mic {
  constructor() { this.stream = null; this.error = ''; this.level = 0; this.talking = false; this.onClip = null; this.muted = false; this._hold = 0; }
  async start() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) { this.error = 'This browser can\'t use a microphone here (it needs https).'; return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      this.error = e.name === 'NotAllowedError' ? 'Microphone blocked. You can still listen.' : 'No microphone found. You can still listen.';
      return false;
    }
    this.listen();
    return true;
  }
  // level + the clip recorder: a running buffer at 16 kHz; a stretch of talking 0.6-2.6 s long becomes a clip
  listen() {
    const ctx = audio.ctx; if (!ctx || !this.stream) return;
    const src = ctx.createMediaStreamSource(this.stream);
    const sp = ctx.createScriptProcessor(2048, 1, 1), mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(sp); sp.connect(mute).connect(ctx.destination);
    const step = ctx.sampleRate / CLIP_RATE, max = CLIP_RATE * 2.6;
    let rec = [], quiet = 0, pos = 0;
    sp.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const rms = Math.sqrt(s / d.length), dur = d.length / ctx.sampleRate;
      this.level = this.muted ? 0 : rms;
      const loud = rms > 0.025 && !this.muted;
      this._hold = loud ? 0.35 : Math.max(0, this._hold - dur);
      this.talking = loud || this._hold > 0;
      if (this.talking) {
        for (; pos < d.length; pos += step) rec.push(d[Math.floor(pos)]);
        pos -= d.length; quiet = 0;
        if (rec.length >= max) { this.finish(rec); rec = []; }
      } else if (rec.length) {
        if ((quiet += dur) > 0.25) { if (rec.length > CLIP_RATE * 0.6) this.finish(rec); rec = []; }
      }
    };
    this.node = sp; this.src = src;
  }
  finish(rec) {
    let peak = 0; for (const v of rec) peak = Math.max(peak, Math.abs(v));
    if (peak < 0.05) return;
    const g = 0.8 / peak, out = new Uint8Array(rec.length);
    for (let i = 0; i < rec.length; i++) out[i] = muEnc(rec[i] * g);
    this.onClip?.(out);
  }
  stop() { try { this.node?.disconnect(); this.src?.disconnect(); } catch { /* fine */ } this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; }
}
// mu-law: 8 bits a sample, good enough for a voice coming out of the dark
function muEnc(x) { x = clamp(x, -1, 1); const s = x < 0 ? 0x80 : 0, m = Math.log1p(255 * Math.abs(x)) / Math.log1p(255); return s | Math.round(m * 127); }
export function muDec(bytes) {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) { const b = bytes[i], m = (b & 0x7f) / 127, v = (Math.pow(256, m) - 1) / 255; out[i] = b & 0x80 ? -v : v; }
  return out;
}

// ---------- the calls ----------
export class VoiceChat {
  constructor(net, micStream) {
    this.net = net; this.mode = 'clear'; this.volume = 1;
    const ctx = audio.ctx;
    // players without a mic still join calls, with a silent stream
    this.stream = micStream || ctx.createMediaStreamDestination().stream;
    this.calls = new Map(); // peer id -> entry
    this.closed = false;
    net.peer.on('call', (call) => this.answer(call));
    // phones won't start a voice playing without a tap: retry on the next one
    this.unlock = () => { for (const e of this.calls.values()) e.audio?.play().catch(() => {}); };
    addEventListener('pointerdown', this.unlock); addEventListener('keydown', this.unlock);
  }
  // call everyone in the roster we aren't connected to; only one side of each pair calls
  sync(roster) {
    if (this.closed) return;
    const mine = this.net.peer.id, peers = new Set(roster.map((r) => r.peer));
    for (const [peerId, e] of this.calls) if (!peers.has(peerId)) { this.drop(e); this.calls.delete(peerId); }
    for (const r of roster) {
      if (r.peer === mine || this.calls.has(r.peer) || !(mine < r.peer)) continue;
      const call = this.net.peer.call(r.peer, this.stream, { sdpTransform: betterAudio });
      if (call) this.setup(call);
    }
  }
  answer(call) {
    if (this.closed || !this.net.roster.some((r) => r.peer === call.peer)) { call.close(); return; }
    const old = this.calls.get(call.peer); if (old) this.drop(old);
    call.answer(this.stream, { sdpTransform: betterAudio });
    this.setup(call);
  }
  setup(call) {
    const ctx = audio.ctx, e = { call, peer: call.peer, level: () => 0 };
    e.gain = ctx.createGain(); e.gain.gain.value = 0;
    e.muffle = ctx.createBiquadFilter(); e.muffle.type = 'lowpass'; e.muffle.frequency.value = 16000;
    e.pan = new PannerNode(ctx, { panningModel: 'equalpower', distanceModel: 'linear', refDistance: 1, maxDistance: 10000, rolloffFactor: 0 });
    e.gain.connect(e.muffle).connect(e.pan).connect(voiceBus());
    e.nodes = [e.gain, e.muffle, e.pan];
    this.calls.set(call.peer, e);
    call.on('stream', (remote) => {
      if (e.src) return;
      // the <audio> element plays it in clear mode; Chrome also needs it to feed the stream into Web Audio at all
      e.audio = new Audio(); e.audio.srcObject = remote; e.audio.volume = 0; e.audio.play().catch(() => {});
      e.src = ctx.createMediaStreamSource(remote); e.src.connect(e.gain);
      const an = ctx.createAnalyser(); an.fftSize = 512; e.src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      e.level = () => { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / buf.length); };
    });
    const gone = () => {
      if (this.calls.get(call.peer) !== e) return;
      this.drop(e); this.calls.delete(call.peer);
      setTimeout(() => this.sync(this.net.roster), 2500); // a blip: call again if they're still here
    };
    call.on('close', gone); call.on('error', gone);
  }
  drop(e) {
    try { e.call.close(); } catch { /* already closed */ }
    try { e.src?.disconnect(); for (const n of e.nodes) n.disconnect(); } catch { /* fine */ }
    if (e.audio) { e.audio.pause(); e.audio.srcObject = null; }
  }
  entryFor(playerId) { const peer = this.net.roster.find((r) => r.id === playerId)?.peer; return peer ? this.calls.get(peer) : null; }
  // how a player's voice reaches me: { on, pos (3d), volume 0..1, occluded }
  route(playerId, { on, pos = null, volume = 1, occluded = false }) {
    const e = this.entryFor(playerId); if (!e) return;
    const now = audio.ctx.currentTime, v = on ? clamp(volume, 0, 1) * this.volume : 0, web = this.mode === '3d' && on;
    if (e.audio) { e.audio.muted = web || !on; if (!web) e.audio.volume = clamp(v * (occluded ? 0.7 : 1), 0, 1); }
    if (!web) { e.gain.gain.cancelScheduledValues(now); e.gain.gain.setValueAtTime(0, now); return; }
    e.gain.gain.setTargetAtTime(v * 1.6, now, 0.05);
    e.muffle.frequency.setTargetAtTime(occluded ? 1800 : 16000, now, 0.08);
    if (pos) { e.pan.positionX.value = pos.x; e.pan.positionY.value = pos.y; e.pan.positionZ.value = pos.z; }
  }
  talking(playerId) { return (this.entryFor(playerId)?.level() || 0) > 0.03; }
  dispose() {
    this.closed = true;
    removeEventListener('pointerdown', this.unlock); removeEventListener('keydown', this.unlock);
    for (const e of this.calls.values()) this.drop(e);
    this.calls.clear();
  }
}
