// All sounds are synthesized with Web Audio, so there are no audio files to load.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28]; // major pentatonic, in semitones
const note = (base, step) => base * 2 ** (SCALE[Math.min(step, SCALE.length - 1)] / 12);

export class Sfx {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  // iOS only allows audio to start inside a touch handler.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  tone({ freq, to = freq, type = 'sine', dur = 0.15, vol = 0.25, delay = 0, attack = 0.005 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.06, vol = 0.15, freq = 1800, delay = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  pick() {
    this.tone({ freq: 520, to: 700, type: 'triangle', dur: 0.07, vol: 0.12 });
  }

  place() {
    this.tone({ freq: 210, to: 120, type: 'sine', dur: 0.12, vol: 0.35 });
    this.noise({ dur: 0.05, vol: 0.12, freq: 2400 });
  }

  invalid() {
    this.tone({ freq: 260, to: 180, type: 'triangle', dur: 0.12, vol: 0.12 });
  }

  clear(lines, combo) {
    const base = 523.25; // C5
    const start = Math.min(Math.max(combo - 1, 0), 6);
    const count = 2 + Math.min(lines, 4);
    for (let i = 0; i < count; i++) {
      const delay = i * 0.055;
      this.tone({ freq: note(base, start + i), type: 'triangle', dur: 0.22, vol: 0.2, delay });
      this.tone({ freq: note(base * 2, start + i), type: 'sine', dur: 0.18, vol: 0.06, delay });
    }
    this.noise({ dur: 0.25, vol: 0.06, freq: 6000 });
  }

  praise() {
    for (let i = 0; i < 6; i++)
      this.tone({ freq: note(1046.5, i * 2), type: 'sine', dur: 0.12, vol: 0.08, delay: 0.25 + i * 0.04 });
  }

  gem() {
    this.tone({ freq: 1568, to: 2093, type: 'sine', dur: 0.14, vol: 0.14 });
    this.tone({ freq: 2637, type: 'triangle', dur: 0.1, vol: 0.05, delay: 0.04 });
  }

  refill() {
    for (let i = 0; i < 3; i++)
      this.tone({ freq: 660 + i * 110, type: 'triangle', dur: 0.06, vol: 0.06, delay: i * 0.07 });
  }

  gameOver() {
    [392, 330, 262, 196].forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.35, vol: 0.2, delay: i * 0.18 }),
    );
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.18, delay: i * 0.1 }),
    );
  }

  record() {
    this.win();
    this.praise();
  }

  button() {
    this.tone({ freq: 880, to: 990, type: 'triangle', dur: 0.06, vol: 0.1 });
  }
}
