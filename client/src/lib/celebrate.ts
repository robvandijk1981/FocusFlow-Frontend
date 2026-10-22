/**
 * Celebration feedback when a task is checked off: a synthesized drum fill
 * (Web Audio, no audio files) plus a confetti burst from the checkbox.
 *
 * - "small": one-beat fill (snare, toms, kick + crash) for a single task.
 * - "big":   two-beat fill with a fatter crash, for clearing Today's Focus.
 *
 * Sound can be muted; the setting lives in localStorage. Confetti is skipped
 * when the user prefers reduced motion.
 */

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
      if (isCelebrationSoundOn()) getAudio();
    },
    { capture: true, passive: true },
  );
}

// ==================== DRUM SYNTH ====================

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(comp).connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noise(ac: AudioContext): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function envGain(ac: AudioContext, t: number, peak: number, decay: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

function kick(ac: AudioContext, t: number, vel = 1) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = envGain(ac, t, 1.0 * vel, 0.4);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + 0.45);
}

function snare(ac: AudioContext, t: number, vel = 1) {
  // Wires
  const n = noise(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const ng = envGain(ac, t, 0.7 * vel, 0.18);
  n.connect(hp).connect(ng).connect(master!);
  n.start(t);
  n.stop(t + 0.2);

  // Shell
  const body = ac.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(230, t);
  body.frequency.exponentialRampToValueAtTime(180, t + 0.05);
  const bg = envGain(ac, t, 0.5 * vel, 0.1);
  body.connect(bg).connect(master!);
  body.start(t);
  body.stop(t + 0.12);
}

function tom(ac: AudioContext, t: number, freq: number, vel = 1) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  const g = envGain(ac, t, 0.9 * vel, 0.45);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + 0.5);

  // Stick attack
  const n = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 6;
  const ng = envGain(ac, t, 0.25 * vel, 0.03);
  n.connect(bp).connect(ng).connect(master!);
  n.start(t);
  n.stop(t + 0.05);
}

function crash(ac: AudioContext, t: number, vel = 1, length = 1.6) {
  // Metallic partials (808-style cymbal) ...
  const metal = ac.createGain();
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 9000;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const mg = envGain(ac, t, 0.18 * vel, length);
  metal.connect(bp).connect(hp).connect(mg).connect(master!);
  for (const ratio of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = 40 * ratio * 1.7;
    o.connect(metal);
    o.start(t);
    o.stop(t + length + 0.05);
  }
  // ... plus a wash of noise
  const n = noise(ac);
  const nhp = ac.createBiquadFilter();
  nhp.type = 'highpass';
  nhp.frequency.value = 4500;
  const ng = envGain(ac, t, 0.45 * vel, length);
  n.connect(nhp).connect(ng).connect(master!);
  n.start(t);
  n.stop(t + length + 0.05);
}

const HI = 260;
const MID = 190;
const FLOOR = 120;

function playDrumFill(size: CelebrationSize) {
  const ac = getAudio();
  if (!ac || !master) return;

  const bpm = 132;
  const s = 60 / bpm / 4; // one 16th note
  const t0 = ac.currentTime + 0.02;

  if (size === 'small') {
    // One beat of 16ths down the kit, then kick + crash on the one.
    snare(ac, t0, 0.8);
    snare(ac, t0 + s, 0.6);
    tom(ac, t0 + 2 * s, HI, 0.9);
    tom(ac, t0 + 3 * s, FLOOR, 1);
    kick(ac, t0 + 4 * s);
    crash(ac, t0 + 4 * s, 0.9, 1.4);
    return;
  }

  // Two beats: flammed snare build, toms round the kit, double kick into a big crash.
  snare(ac, t0 - 0.015, 0.4); // flam grace note
  snare(ac, t0, 1);
  snare(ac, t0 + s, 0.55);
  snare(ac, t0 + 2 * s, 0.75);
  snare(ac, t0 + 3 * s, 0.9);
  tom(ac, t0 + 4 * s, HI, 1);
  tom(ac, t0 + 5 * s, HI, 0.7);
  tom(ac, t0 + 6 * s, MID, 0.9);
  tom(ac, t0 + 7 * s, FLOOR, 1);
  kick(ac, t0 + 7 * s, 0.7);
  kick(ac, t0 + 8 * s);
  crash(ac, t0 + 8 * s, 1, 2.4);
  snare(ac, t0 + 8 * s, 0.8);
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

export function celebrate(size: CelebrationSize = 'small'): void {
  try {
    burstConfetti(size);
  } catch (err) {
    console.warn('Confetti failed:', err);
  }
  if (!isCelebrationSoundOn()) return;
  try {
    playDrumFill(size);
  } catch (err) {
    console.warn('Drum fill failed:', err);
  }
}
