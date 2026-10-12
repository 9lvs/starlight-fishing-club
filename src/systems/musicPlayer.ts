// Plays the composed music through Web Audio: schedules a bar a little ahead of
// time, with a soft reverb so everything blurs gently. No Phaser here.
import { MUSIC, type MusicMood } from '../config/audio';
import { composeBar, midiToHz, type MusicNote } from './musicComposer';

const LOOKAHEAD_S = 1.5;
const TICK_MS = 250;

export class MusicPlayer {
  private out: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bar = 0;
  private nextBarAt = 0;
  private mood: MusicMood = MUSIC.moods.day!;

  constructor(
    private readonly ac: AudioContext,
    destination: AudioNode,
    private readonly rng: () => number = Math.random,
  ) {
    this.out = ac.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    this.dry = ac.createGain();
    this.dry.gain.value = 1 - MUSIC.reverbWet;
    this.dry.connect(this.out);
    const reverb = ac.createConvolver();
    reverb.buffer = this.impulse(MUSIC.reverbSeconds);
    this.wet = ac.createGain();
    this.wet.gain.value = MUSIC.reverbWet;
    reverb.connect(this.wet).connect(this.out);
    this.dry.connect(reverb);
  }

  setMood(phase: string): void {
    this.mood = MUSIC.moods[phase] ?? this.mood;
  }

  start(): void {
    if (this.timer) return;
    const t = this.ac.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(1, t + MUSIC.fadeInSeconds);
    this.nextBarAt = t + 0.2;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ac.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + 1.5);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  private get beatS(): number {
    return 60 / MUSIC.bpm;
  }

  private schedule(): void {
    // After a long pause (tab hidden), skip ahead instead of playing a pile of notes.
    if (this.nextBarAt < this.ac.currentTime - 0.1) this.nextBarAt = this.ac.currentTime + 0.1;
    while (this.nextBarAt < this.ac.currentTime + LOOKAHEAD_S) {
      for (const n of composeBar(this.bar, this.mood, this.rng, MUSIC)) this.playNote(n, this.nextBarAt);
      this.bar += 1;
      this.nextBarAt += MUSIC.beatsPerBar * this.beatS;
    }
  }

  private playNote(n: MusicNote, barAt: number): void {
    const ac = this.ac;
    const at = barAt + n.at * this.beatS;
    const len = n.beats * this.beatS;
    const f = midiToHz(n.midi);
    const env = ac.createGain();
    env.gain.value = 0;
    const peak = MUSIC.gain[n.voice] * n.velocity;
    let tail = 1;
    if (n.voice === 'pad') {
      // Slow swell in and out, through a soft filter.
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = this.mood.brightness;
      env.connect(filter).connect(this.dry);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + Math.min(2, len / 3));
      env.gain.setValueAtTime(peak, at + len - 1.5);
      env.gain.linearRampToValueAtTime(0, at + len + 1);
      for (const detune of [-6, 6]) this.osc('triangle', f, detune, env, at, at + len + 1.1);
      return;
    }
    env.connect(this.dry);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + (n.voice === 'bass' ? 0.08 : 0.01));
    if (n.voice === 'bell') tail = 2.5;
    else if (n.voice === 'bass') tail = len;
    else tail = 1.2;
    env.gain.exponentialRampToValueAtTime(0.0001, at + tail);
    this.osc(n.voice === 'pluck' ? 'triangle' : 'sine', f, 0, env, at, at + tail + 0.05);
    // A quiet octave on the bell makes it shimmer like a music box.
    if (n.voice === 'bell') {
      const shimmer = ac.createGain();
      shimmer.gain.value = 0.25;
      shimmer.connect(env);
      this.osc('sine', f * 2, 0, shimmer, at, at + tail + 0.05);
    }
  }

  private osc(type: OscillatorType, f: number, detune: number, out: AudioNode, start: number, stop: number): void {
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(out);
    o.start(start);
    o.stop(stop);
  }

  /** A soft, decaying noise burst used as a reverb impulse (no audio file needed). */
  private impulse(seconds: number): AudioBuffer {
    const len = Math.floor(this.ac.sampleRate * seconds);
    const buf = this.ac.createBuffer(2, len, this.ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (this.rng() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
}
