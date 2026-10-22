/**
 * Celebration feedback when a task is checked off: a synthesized drum fill
 * (Web Audio, no audio files) plus a confetti burst from the checkbox.
 *
 * The sound is a big 80s acoustic kit (concert toms, gated reverb), in the
 * spirit of Phil Collins but with an original pattern.
 * - "small": one-beat sextuplet cascade down the toms into kick + crash.
 * - "big":   two-beat fill with flams and a double crash, for clearing Today's Focus.
 *
 * When the user has loaded their own fills (see fillLibrary.ts), a random one
 * of those plays instead of the synthesized fill.
 *
 * Sound can be muted; the setting lives in localStorage. Confetti is skipped
 * when the user prefers reduced motion.
 */

import { getFillNames, playRandomFill, prepareNextFill } from './fillLibrary';

export type CelebrationSize = 'small' | 'big';

const SOUND_KEY = 'focusflow:celebrationSound';

// ==================== SOUND SETTING ====================

export function isCelebrationSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setCelebrationSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: setting just won't persist
  }
}

// ==================== POINTER TRACKING ====================
// The toggle handler doesn't receive the click event, so remember where the
// last pointer went down and burst the confetti from there.

let lastPointer: { x: number; y: number } | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
      // Unlock audio inside a real user gesture (needed on iOS Safari).
      if (isCelebrationSoundOn()) {
        const ac = getAudio();
        if (ac && getFillNames().length > 0) prepareNextFill(ac);
      }
    },
    { capture: true, passive: true },
  );
}

// ==================== DRUM SYNTH ====================
// A big 80s acoustic kit: six concert toms, fat snare, kick, crashes.
// Toms and snare go through a gated reverb (the "non-linear" room sound),
// the whole kit through gentle saturation and bus compression, and the
// cymbals through a natural room.

let ctx: AudioContext | null = null;
let drumBus: GainNode | null = null;
let gatedSend: GainNode | null = null;
let roomSend: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let sampleOut: GainNode | null = null;

function makeImpulse(
  ac: BaseAudioContext,
  seconds: number,
  shape: (t: number) => number,
): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * shape(i / ac.sampleRate);
  }
  return buf;
}

function getAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    ctx = new Ctor();
    const ac = ctx;

    // Master: bus compressor -> output level
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 6;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    const master = ac.createGain();
    master.gain.value = 0.75;
    comp.connect(master).connect(ac.destination);

    // User-loaded fills play straight out, untouched
    sampleOut = ac.createGain();
    sampleOut.gain.value = 0.9;
    sampleOut.connect(ac.destination);

    // Drum bus with soft saturation for weight
    drumBus = ac.createGain();
    drumBus.gain.value = 0.8;
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(2048);
    const k = 1.8;
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    drumBus.connect(shaper).connect(comp);

    // Gated reverb: dense, almost flat tail that stops dead after ~350 ms
    const gateLen = 0.36;
    const gated = ac.createConvolver();
    gated.normalize = true;
    gated.buffer = makeImpulse(ac, gateLen, (t) => {
      const attack = Math.min(1, t / 0.008);
      const body = 1 - 0.3 * (t / gateLen);
      const release = t > gateLen - 0.02 ? (gateLen - t) / 0.02 : 1;
      return attack * body * release;
    });
    gatedSend = ac.createGain();
    const gatedReturn = ac.createGain();
    gatedReturn.gain.value = 0.9;
    gatedSend.connect(gated).connect(gatedReturn).connect(drumBus);

    // Natural room for the cymbals
    const room = ac.createConvolver();
    room.normalize = true;
    room.buffer = makeImpulse(ac, 2.2, (t) => Math.exp(-t * 3));
    roomSend = ac.createGain();
    const roomReturn = ac.createGain();
    roomReturn.gain.value = 0.35;
    roomSend.connect(room).connect(roomReturn).connect(comp);

    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noise(ac: BaseAudioContext): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function envGain(ac: BaseAudioContext, t: number, peak: number, decay: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

/** Route a voice: pan it, send it to the dry bus and the reverbs. */
function route(ac: BaseAudioContext, node: AudioNode, pan: number, gatedAmt: number, roomAmt: number) {
  const p = ac.createStereoPanner();
  p.pan.value = pan;
  node.connect(p);
  p.connect(drumBus!);
  if (gatedAmt > 0) {
    const s = ac.createGain();
    s.gain.value = gatedAmt;
    p.connect(s).connect(gatedSend!);
  }
  if (roomAmt > 0) {
    const s = ac.createGain();
    s.gain.value = roomAmt;
    p.connect(s).connect(roomSend!);
  }
}

// Circular-membrane mode ratios with relative level and decay
const MEMBRANE_MODES: Array<[ratio: number, amp: number, decay: number]> = [
  [1, 1, 0.85],
  [1.594, 0.42, 0.4],
  [2.136, 0.2, 0.25],
  [2.296, 0.14, 0.2],
  [2.653, 0.08, 0.14],
];

function tom(ac: BaseAudioContext, t: number, f: number, pan: number, vel = 1) {
  const out = ac.createGain();
  out.gain.value = vel;
  const lenScale = Math.sqrt(200 / f); // lower drums ring longer
  for (const [ratio, amp, decay] of MEMBRANE_MODES) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * ratio * 1.22, t);
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.09);
    const d = decay * lenScale;
    const g = envGain(ac, t, amp * 0.55, d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  // Stick on head
  const n = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f * 5;
  bp.Q.value = 0.8;
  n.connect(bp).connect(envGain(ac, t, 0.3, 0.035)).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.06);
  // Shell thump
  const n2 = noise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = f * 2;
  n2.connect(lp).connect(envGain(ac, t, 0.35, 0.09)).connect(out);
  n2.start(t, Math.random());
  n2.stop(t + 0.12);

  route(ac, out, pan, 0.8, 0.08);
}

function snare(ac: BaseAudioContext, t: number, vel = 1, pan = 0.05) {
  const out = ac.createGain();
  out.gain.value = vel;
  // Drum body
  for (const [f, amp, d] of [[190, 0.5, 0.16], [335, 0.28, 0.1], [480, 0.12, 0.07]]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.15, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    o.connect(envGain(ac, t, amp, d)).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  // Snare wires
  const n = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 0.5;
  n.connect(bp).connect(envGain(ac, t, 0.75, 0.26)).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.3);
  // Crack
  const n2 = noise(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  n2.connect(hp).connect(envGain(ac, t, 0.35, 0.06)).connect(out);
  n2.start(t, Math.random());
  n2.stop(t + 0.08);

  route(ac, out, pan, 1, 0.12);
}

function kick(ac: BaseAudioContext, t: number, vel = 1) {
  const out = ac.createGain();
  out.gain.value = vel;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(115, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
  o.connect(envGain(ac, t, 1, 0.55)).connect(out);
  o.start(t);
  o.stop(t + 0.6);
  // Beater
  const n = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2500;
  n.connect(bp).connect(envGain(ac, t, 0.3, 0.018)).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.03);

  route(ac, out, 0, 0.2, 0);
}

function crash(ac: BaseAudioContext, t: number, pan: number, vel = 1, length = 2.6) {
  const out = ac.createGain();
  out.gain.value = vel;

  // Dense cloud of inharmonic partials, each fading at its own rate -> shimmer, not a chord
  const metal = ac.createGain();
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  metal.connect(hp).connect(out);
  const count = 48;
  for (let i = 0; i < count; i++) {
    const f = 400 * Math.pow(12000 / 400, Math.random());
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.004, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.3);
    const d = length * (0.25 + Math.random() * 0.75) * (f > 4000 ? 1 : 0.7);
    o.connect(envGain(ac, t, (0.35 / Math.sqrt(count)) * (0.4 + Math.random() * 0.6), d)).connect(metal);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  // Initial splash
  const n = noise(ac);
  const hp2 = ac.createBiquadFilter();
  hp2.type = 'highpass';
  hp2.frequency.value = 2800;
  n.connect(hp2).connect(envGain(ac, t, 0.55, 0.18)).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.2);
  // Long wash
  const n3 = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 6500;
  bp.Q.value = 0.4;
  n3.connect(bp).connect(envGain(ac, t, 0.42, length)).connect(out);
  n3.start(t, Math.random());
  n3.stop(t + length + 0.05);

  route(ac, out, pan, 0.05, 0.6);
}

// Six concert toms, high to low, spread across the stereo field
const TOMS: Array<{ f: number; pan: number }> = [
  { f: 245, pan: -0.6 },
  { f: 205, pan: -0.38 },
  { f: 170, pan: -0.15 },
  { f: 140, pan: 0.1 },
  { f: 112, pan: 0.35 },
  { f: 88, pan: 0.6 },
];

function flamTom(ac: BaseAudioContext, t: number, i: number, vel = 1) {
  tom(ac, t - 0.018, TOMS[i].f, TOMS[i].pan, vel * 0.45);
  tom(ac, t, TOMS[i].f, TOMS[i].pan, vel);
}

function playDrumFill(size: CelebrationSize) {
  const ac = getAudio();
  if (!ac || !drumBus) return;

  const bpm = 100;
  const beat = 60 / bpm;
  const x = beat / 6; // sextuplet
  const t0 = ac.currentTime + 0.05;

  if (size === 'small') {
    // One beat: snare, then a sextuplet cascade down the toms, landing on kick + crash + floor tom.
    snare(ac, t0 - 0.02, 0.4);
    snare(ac, t0, 1);
    for (let i = 0; i < 5; i++) tom(ac, t0 + (i + 1) * x, TOMS[i].f, TOMS[i].pan, 0.8 + i * 0.05);
    const one = t0 + beat;
    kick(ac, one);
    tom(ac, one, TOMS[5].f, TOMS[5].pan, 1);
    crash(ac, one, -0.35, 0.9, 2.2);
    return;
  }

  // Two beats. Beat 1: snare/tom alternation, building. Beat 2: flammed cascade round the kit.
  snare(ac, t0 - 0.02, 0.45);
  snare(ac, t0, 1);
  tom(ac, t0 + x, TOMS[0].f, TOMS[0].pan, 0.75);
  snare(ac, t0 + 2 * x, 0.7);
  tom(ac, t0 + 3 * x, TOMS[1].f, TOMS[1].pan, 0.8);
  snare(ac, t0 + 4 * x, 0.8);
  tom(ac, t0 + 5 * x, TOMS[2].f, TOMS[2].pan, 0.85);

  const b2 = t0 + beat;
  flamTom(ac, b2, 0, 1);
  tom(ac, b2 + x, TOMS[1].f, TOMS[1].pan, 0.8);
  flamTom(ac, b2 + 2 * x, 2, 0.95);
  tom(ac, b2 + 3 * x, TOMS[3].f, TOMS[3].pan, 0.85);
  flamTom(ac, b2 + 4 * x, 4, 1);
  tom(ac, b2 + 5 * x, TOMS[5].f, TOMS[5].pan, 0.9);
  kick(ac, b2 + 5 * x, 0.6);

  const one = t0 + 2 * beat;
  kick(ac, one);
  snare(ac, one, 0.9);
  tom(ac, one, TOMS[5].f, TOMS[5].pan, 1);
  crash(ac, one, -0.45, 1, 3);
  crash(ac, one + 0.012, 0.45, 0.85, 2.6);
}

// ==================== CONFETTI ====================

const COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function burstConfetti(size: CelebrationSize) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) {
    canvas.remove();
    return;
  }
  g.scale(dpr, dpr);

  const particles: Particle[] = [];
  const spawn = (ox: number, oy: number, count: number, power: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const speed = power * (0.5 + Math.random() * 0.7);
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        w: 5 + Math.random() * 5,
        h: 3 + Math.random() * 4,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
      });
    }
  };

  const origin = lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  if (size === 'small') {
    spawn(origin.x, origin.y, 70, 11, Math.PI * 0.9);
  } else {
    spawn(origin.x, origin.y, 60, 11, Math.PI);
    // Side cannons for the full-list finish
    spawn(0, window.innerHeight * 0.8, 70, 16, Math.PI * 0.35);
    spawn(window.innerWidth, window.innerHeight * 0.8, 70, 16, Math.PI * 0.35);
    for (const p of particles.slice(-140)) {
      // aim the side cannons inward
      p.vx = p.x === 0 ? Math.abs(p.vx) + 4 : -Math.abs(p.vx) - 4;
    }
  }

  const start = performance.now();
  const duration = size === 'small' ? 1600 : 3000;

  const frame = (now: number) => {
    const elapsed = now - start;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of particles) {
      p.vy += 0.32; // gravity
      p.vx *= 0.985; // drag
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life = Math.max(0, 1 - elapsed / duration);
      g.save();
      g.globalAlpha = p.life;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
      g.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
}

// ==================== PUBLIC API ====================

/**
 * Confetti plus a drum fill. Returns the file name of the fill that played
 * when it came from the user's own library, otherwise null.
 */
export function celebrate(size: CelebrationSize = 'small'): string | null {
  try {
    burstConfetti(size);
  } catch (err) {
    console.warn('Confetti failed:', err);
  }
  if (!isCelebrationSoundOn()) return null;
  try {
    const ac = getAudio();
    if (ac && sampleOut && getFillNames().length > 0) {
      const name = playRandomFill(ac, sampleOut);
      if (name) return name;
    }
    playDrumFill(size);
  } catch (err) {
    console.warn('Drum fill failed:', err);
  }
  return null;
}
