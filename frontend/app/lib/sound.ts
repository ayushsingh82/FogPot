let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;

export function setSoundMuted(value: boolean) {
  muted = value;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function getNoiseBuffer(audioCtx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(audioCtx.sampleRate * 0.3);
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function beep(
  freq: number,
  duration: number,
  gain = 0.06,
  delay = 0,
  type: OscillatorType = "square"
) {
  if (muted) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const startAt = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(startAt);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.stop(startAt + duration);
}

/** A pitch sweep — the "swing" of an attack, not a flat tone. */
function swoosh(startFreq: number, endFreq: number, duration: number, gain = 0.05, delay = 0) {
  if (muted) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const startAt = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(startFreq, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), startAt + duration);
  g.gain.setValueAtTime(0.0001, startAt);
  g.gain.linearRampToValueAtTime(gain, startAt + duration * 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

/** Filtered noise burst — the "thwack" on landing a hit. */
function impact(duration: number, gain = 0.15, delay = 0, filterFreq = 900) {
  if (muted) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const startAt = audioCtx.currentTime + delay;
  const src = audioCtx.createBufferSource();
  src.buffer = getNoiseBuffer(audioCtx);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain, startAt);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(audioCtx.destination);
  src.start(startAt);
  src.stop(startAt + duration);
}

export function playHit() {
  swoosh(900, 140, 0.16, 0.05);
  impact(0.12, 0.18, 0.12, 800);
}

export function playCrit() {
  swoosh(1500, 110, 0.22, 0.07);
  impact(0.18, 0.28, 0.16, 1600);
  beep(660, 0.12, 0.06, 0.26, "square");
  beep(880, 0.16, 0.06, 0.32, "square");
}

export function playClick() {
  beep(880, 0.05, 0.04);
}

export function playDefeat() {
  impact(0.35, 0.22, 0, 260);
  [392, 523, 659, 784].forEach((freq, i) =>
    beep(freq, 0.22, 0.07, 0.15 + i * 0.14, "square")
  );
}
