/**
 * Every sound in the game is synthesised with Web Audio, so there are no
 * audio files to download. Short effects mark moments (a coin, a chest, a
 * door, a finished mission) and a quiet music loop plays underneath.
 *
 * Browsers only allow audio after the player touches or presses something,
 * so the context starts on the first gesture. The mute choice is kept in
 * localStorage (and the game still works when storage is blocked).
 */

export type Sfx = 'coin' | 'chest' | 'jump' | 'door' | 'portal' | 'success' | 'levelUp' | 'step' | 'click';

const KEY = 'investor-city.muted';

/** C major pentatonic, so any two notes sound fine together. */
const SCALE = [0, 2, 4, 7, 9];
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private musicTimer = 0;
  private bar = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(KEY) === '1';
    } catch {
      // storage blocked: start with sound on
    }
    const start = () => {
      this.unlock();
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(KEY, muted ? '1' : '0');
    } catch {
      // not remembered, still applied
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Called on the first gesture. */
  private unlock(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.12;
    this.music.connect(this.master);
    this.scheduleMusic();
  }

  /** Pauses everything while the tab is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'coin':
        this.tone(midi(88), t, 0.08, 'square', 0.12);
        this.tone(midi(93), t + 0.07, 0.22, 'square', 0.12);
        break;
      case 'chest':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(midi(n), t + i * 0.07, 0.3, 'triangle', 0.2));
        break;
      case 'jump':
        this.sweep(220, 520, t, 0.16, 'sine', 0.18);
        break;
      case 'door':
        this.noise(t, 0.35, 900, 0.14);
        this.tone(midi(60), t, 0.25, 'sine', 0.08);
        break;
      case 'portal':
        this.sweep(200, 1400, t, 0.9, 'sine', 0.14);
        this.sweep(300, 2100, t + 0.05, 0.9, 'triangle', 0.08);
        break;
      case 'success':
        [67, 72, 76].forEach((n, i) => this.tone(midi(n), t + i * 0.1, 0.35, 'triangle', 0.2));
        this.tone(midi(79), t + 0.3, 0.6, 'triangle', 0.2);
        break;
      case 'levelUp':
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), t + i * 0.08, 0.4, 'square', 0.08));
        this.tone(midi(84), t + 0.6, 0.9, 'triangle', 0.22);
        break;
      case 'step':
        this.noise(t, 0.05, 1800, 0.03);
        break;
      case 'click':
        this.tone(midi(84), t, 0.04, 'sine', 0.08);
        break;
    }
  }

  private envelope(start: number, length: number, peak: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    return g;
  }

  private tone(freq: number, start: number, length: number, type: OscillatorType, peak: number, out: AudioNode = this.master!): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.envelope(start, length, peak);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + length + 0.05);
  }

  private sweep(from: number, to: number, start: number, length: number, type: OscillatorType, peak: number): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, start);
    o.frequency.exponentialRampToValueAtTime(to, start + length);
    const g = this.envelope(start, length, peak);
    o.connect(g).connect(this.master!);
    o.start(start);
    o.stop(start + length + 0.05);
  }

  private noise(start: number, length: number, cutoff: number, peak: number): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    src.connect(f).connect(this.envelope(start, length, peak)).connect(this.master!);
    src.start(start);
  }

  /**
   * A calm loop: soft chords that change every bar and a few plucked notes
   * from the pentatonic scale on top. Scheduled one bar ahead.
   */
  private scheduleMusic(): void {
    const ctx = this.ctx!;
    const barLen = 2.4;
    const chords = [
      [48, 55, 64],
      [45, 52, 60],
      [41, 48, 57],
      [43, 50, 59],
    ];
    let next = ctx.currentTime + 0.3;
    const tick = () => {
      while (next < ctx.currentTime + barLen * 1.5) {
        const chord = chords[this.bar % chords.length];
        for (const n of chord) this.tone(midi(n), next, barLen * 1.05, 'sine', 0.25, this.music!);
        for (let k = 0; k < 4; k++) {
          if (Math.random() < 0.55) {
            const n = 72 + SCALE[Math.floor(Math.random() * SCALE.length)] + (Math.random() < 0.3 ? 12 : 0);
            this.tone(midi(n), next + k * (barLen / 4), 0.5, 'triangle', 0.18, this.music!);
          }
        }
        next += barLen;
        this.bar++;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 800);
  }

  dispose(): void {
    window.clearInterval(this.musicTimer);
    void this.ctx?.close();
  }
}
