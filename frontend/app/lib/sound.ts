let ctx: AudioContext | null = null;
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

function beep(freq: number, duration: number, gain = 0.06, delay = 0) {
  if (muted) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const startAt = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(startAt);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.stop(startAt + duration);
}

export function playHit() {
  beep(220, 0.12);
}

export function playCrit() {
  beep(440, 0.08, 0.08);
  beep(660, 0.14, 0.08, 0.08);
}

export function playClick() {
  beep(880, 0.05, 0.04);
}

export function playDefeat() {
  [523, 659, 784, 1046].forEach((freq, i) => beep(freq, 0.18, 0.07, i * 0.12));
}
