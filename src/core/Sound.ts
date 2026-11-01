import { THEMES, barChords, parseBar, type Drums, type Lead, type Theme, type ThemeId } from '../content/music';

/**
 * Every sound in the game is synthesised with Web Audio, so there are no
 * audio files to download. Short effects mark moments (a coin, a chest, a
 * door, a finished mission) and the original tunes in `content/music.ts`
 * play underneath, a different one per area, at night and indoors.
 *
 * Browsers only allow audio after the player touches or presses something,
 * so the context starts on the first gesture. The mute choice is kept in
 * localStorage (and the game still works when storage is blocked).
 */

export type Sfx = 'coin' | 'chest' | 'jump' | 'door' | 'portal' | 'success' | 'levelUp' | 'step' | 'click';

const KEY = 'investor-city.muted';

interface Track {
  theme: Theme;
  bus: GainNode;
  /** When the next bar starts (audio clock). */
  next: number;
  bar: number;
  cycle: number;
}
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private musicTimer = 0;
  private themeId: ThemeId = 'town';
  private track: Track | null = null;
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
    this.wire(new AC());
    this.startTheme();
    this.scheduleMusic();
  }

  private wire(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);
    this.reverb = this.makeReverb();
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.reverb.connect(wet).connect(this.music);
  }

  /** Renders a theme offline (for listening to it outside the game). */
  static async preview(id: ThemeId, seconds: number): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
    const s = new Sound();
    s.muted = false;
    s.wire(ctx);
    s.themeId = id;
    s.startTheme();
    s.fill(seconds);
    return ctx.startRendering();
  }

  /** Pauses everything while the tab is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    const ctx = this.ctx as AudioContext;
    if (typeof ctx.suspend === 'function') void (hidden ? ctx.suspend() : ctx.resume());
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

  /** Plays the theme for this place and time; switching crossfades at once. */
  setTheme(id: ThemeId): void {
    if (this.themeId === id) return;
    this.themeId = id;
    if (this.ctx) this.startTheme();
  }

  private startTheme(): void {
    const ctx = this.ctx!;
    const old = this.track;
    if (old) {
      old.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      window.setTimeout(() => old.bus.disconnect(), 2500);
    }
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.setTargetAtTime(1, ctx.currentTime + 0.3, 0.5);
    bus.connect(this.music!);
    this.track = { theme: THEMES[this.themeId], bus, next: ctx.currentTime + 0.35, bar: 0, cycle: 0 };
  }

  /** Bars in one cycle: A A B A when there is a B part, else A A. */
  private static plan(t: Theme): { chords: string; tune: string }[] {
    const part = (p: { chords: string[]; tune: string[] }) => p.chords.map((c, i) => ({ chords: c, tune: p.tune[i] }));
    return t.b ? [...part(t.a), ...part(t.a), ...part(t.b), ...part(t.a)] : [...part(t.a), ...part(t.a)];
  }

  /** Schedules bars a little ahead of time (called every 200 ms). */
  private scheduleMusic(): void {
    const tick = () => {
      const ctx = this.ctx;
      if (ctx && ctx.state === 'running') this.fill(ctx.currentTime + 1.2);
    };
    this.musicTimer = window.setInterval(tick, 200);
  }

  /** Schedules whole bars until `until` on the audio clock. */
  private fill(until: number): void {
    const tr = this.track;
    if (!tr) return;
    {
      while (tr.next < until) {
        const plan = Sound.plan(tr.theme);
        const beat = 60 / tr.theme.bpm;
        this.playBar(tr, plan[tr.bar], tr.next, beat, tr.bar, plan.length);
        tr.next += beat * 4;
        tr.bar++;
        if (tr.bar >= plan.length) {
          tr.bar = 0;
          tr.cycle++;
        }
      }
    }
  }

  /**
   * One bar. The arrangement changes every cycle so the music keeps
   * evolving: 0 = light (no drums at first), 1 = full band, 2 = full band a
   * whole tone higher with a second voice, 3 = break (rhythm only for the
   * first half, then the tune returns).
   */
  private playBar(tr: Track, bar: { chords: string; tune: string }, start: number, beat: number, index: number, length: number): void {
    const t = tr.theme;
    const arrangement = tr.cycle % 4;
    const lift = arrangement === 2 ? 2 : 0;
    const time = (at: number) => {
      // swing pushes the off-beat eighths later
      const frac = at - Math.floor(at);
      return start + (at + (Math.abs(frac - 0.5) < 0.01 ? (t.swing - 0.5) : 0)) * beat;
    };
    const tuneOn = !(arrangement === 3 && index < length / 2);
    if (tuneOn) {
      for (const e of parseBar(bar.tune)) {
        if (e.note === null) continue;
        const n = e.note + lift;
        this.lead(t.lead, midi(n), time(e.at), e.beats * beat * 0.92, tr.bus, 1);
        if (arrangement === 2) this.lead('flute', midi(n - 12), time(e.at), e.beats * beat * 0.9, tr.bus, 0.45);
      }
    }
    for (const { chord, at, beats } of barChords(bar.chords)) {
      const root = chord.root + lift;
      // bass on the beat (and a pickup in bouncy tunes)
      const hits = t.drums === 'bounce' || t.drums === 'electro' ? [0, 1, 1.5] : [0, 1];
      for (const h of hits) if (h < beats) this.voice('triangle', midi(36 + root + (h === 1.5 ? 7 : 0)), time(at + h), beat * 0.45, 0.16, tr.bus);
      if (t.pad || arrangement === 0) for (const tone of chord.tones) this.pad(midi(60 + root + tone), time(at), beats * beat, tr.bus);
      if (t.arp && arrangement !== 0) {
        const notes = [...chord.tones, ...chord.tones.map((x) => x + 12)];
        for (let k = 0; k < beats * 2; k++) this.voice('triangle', midi(60 + root + notes[k % notes.length]), time(at + k / 2), beat * 0.35, 0.05, tr.bus);
      }
    }
    const drumsOn = t.drums !== 'none' && !(arrangement === 0 && tr.cycle === 0);
    if (drumsOn) this.drumBar(t.drums, time, beat, tr.bus, arrangement === 0 ? 0.5 : 1);
  }

  private drumBar(style: Drums, time: (at: number) => number, beat: number, out: AudioNode, level: number): void {
    const kick = (at: number) => this.kick(time(at), 0.5 * level, out);
    const snare = (at: number, g = 0.12) => this.hit(time(at), 0.12, 'bandpass', 1800, g * level, out);
    const hat = (at: number, g = 0.04) => this.hit(time(at), 0.03, 'highpass', 7000, g * level, out);
    switch (style) {
      case 'bounce':
        [0, 2, 2.5].forEach(kick);
        [1, 3].forEach((a) => snare(a));
        for (let k = 0; k < 8; k++) hat(k / 2);
        break;
      case 'swing':
        [0, 2].forEach(kick);
        [1, 3].forEach((a) => snare(a, 0.07));
        for (let k = 0; k < 8; k++) hat(k / 2, k % 2 ? 0.03 : 0.045);
        break;
      case 'electro':
        [0, 1, 2, 3].forEach(kick);
        [1, 3].forEach((a) => snare(a, 0.1));
        for (let k = 0; k < 4; k++) hat(k + 0.5, 0.05);
        break;
      case 'soft':
        kick(0);
        for (let k = 0; k < 8; k++) hat(k / 2, 0.02);
        break;
      case 'none':
        break;
    }
    void beat;
  }

  /** The tune's instrument. */
  private lead(kind: Lead, freq: number, start: number, length: number, out: AudioNode, level: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const attack = kind === 'flute' ? 0.05 : 0.01;
    const peak = { square: 0.07, bell: 0.16, flute: 0.12, accordion: 0.06, synth: 0.06 }[kind] * level;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    if (kind === 'bell') g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(length, 0.9));
    else {
      g.gain.setValueAtTime(peak * 0.8, start + Math.max(attack, length * 0.7));
      g.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.08);
    }
    const end = start + Math.max(length, 0.9) + 0.1;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'accordion' ? 1700 : kind === 'synth' ? 2600 : 4200;
    filter.connect(g).connect(out);
    g.connect(this.reverb!);
    const osc = (type: OscillatorType, f: number, detune = 0, gain = 1) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(filter);
      o.start(start);
      o.stop(end);
      return o;
    };
    switch (kind) {
      case 'square':
        osc('square', freq);
        break;
      case 'bell':
        osc('sine', freq);
        osc('sine', freq * 4, 0, 0.18);
        break;
      case 'flute': {
        const o = osc('sine', freq);
        osc('triangle', freq, 0, 0.3);
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5;
        depth.gain.value = freq * 0.006;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(start + 0.15);
        lfo.stop(end);
        break;
      }
      case 'accordion':
        osc('sawtooth', freq, -7);
        osc('sawtooth', freq, 7);
        break;
      case 'synth':
        osc('sawtooth', freq);
        osc('square', freq / 2, 0, 0.5);
        break;
    }
  }

  private voice(type: OscillatorType, freq: number, start: number, length: number, peak: number, out: AudioNode): void {
    this.tone(freq, start, length, type, peak, out);
  }

  private pad(freq: number, start: number, length: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.025, start + Math.min(0.4, length / 3));
    g.gain.linearRampToValueAtTime(0.0001, start + length + 0.2);
    o.connect(g).connect(out);
    g.connect(this.reverb!);
    o.start(start);
    o.stop(start + length + 0.3);
  }

  private kick(start: number, peak: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, start);
    o.frequency.exponentialRampToValueAtTime(45, start + 0.12);
    const g = this.envelopeOn(start, 0.18, peak);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + 0.25);
  }

  private hit(start: number, length: number, type: BiquadFilterType, freq: number, peak: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.envelopeOn(start, length, peak)).connect(out);
    src.start(start);
    src.stop(start + length + 0.05);
  }

  private envelopeOn(start: number, length: number, peak: number): GainNode {
    return this.envelope(start, length, peak);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noiseBuffer(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this.noiseBuf = buf);
  }

  /** A short synthetic room, so the music does not sound dry. */
  private makeReverb(): ConvolverNode {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  dispose(): void {
    window.clearInterval(this.musicTimer);
    if (this.ctx instanceof AudioContext) void this.ctx.close();
  }
}
