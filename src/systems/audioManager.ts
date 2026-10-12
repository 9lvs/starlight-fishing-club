// Web Audio playback with no Phaser dependency. Nothing makes a sound until the
// first user gesture (browsers block autoplay, and surprise audio is not calm).
// Real files are loaded when present; otherwise a placeholder plays. Two volume
// buses: effects (sounds, water, rain) and music.
import { AUDIO, MUSIC_FILES, SOUNDS, type NoiseSpec, type SoundDef, type ToneSpec } from '../config/audio';
import { MusicPlayer } from './musicPlayer';

export class AudioManager {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer | null>();
  private ambientNode: AudioNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;
  private musicFile: AudioBufferSourceNode | null = null;
  private lastPlayed = new Map<string, number>();
  private muted = false;
  private volume: number = AUDIO.masterDefault;
  private musicVolume: number = AUDIO.musicDefault;
  private mood = 'day';
  private rain = 0;
  private wantAmbient = true;

  constructor(private readonly baseUrl = './') {}

  /** Call from a user gesture. Safe to call many times. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ac) {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.connect(this.ac.destination);
      this.sfx = this.ac.createGain();
      this.sfx.connect(this.master);
      this.musicBus = this.ac.createGain();
      this.musicBus.connect(this.master);
      this.applyGain();
      for (const key of Object.keys(SOUNDS)) void this.load(key);
      void this.loadMusicFile();
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
    if (this.wantAmbient && !this.ambientNode) this.startAmbient();
    this.updateMusic();
  }

  get unlocked(): boolean {
    return this.ac !== null;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
    this.updateMusic();
  }

  /** Effects volume: sounds, water, and rain. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    this.applyGain();
    this.updateMusic();
  }

  /** Time of day changes the music's mood from the next bar. */
  setMood(phase: string): void {
    this.mood = phase;
    this.music?.setMood(phase);
  }

  /** 0..1 rain on the water. */
  setRain(level: number): void {
    this.rain = Math.max(0, Math.min(1, level));
    if (this.rainGain && this.ac) this.rainGain.gain.setTargetAtTime(this.rain * AUDIO.rain.gain, this.ac.currentTime, 1.5);
  }

  /** Pause everything while the tab is hidden. */
  suspend(hidden: boolean): void {
    if (!this.ac) return;
    if (hidden) void this.ac.suspend();
    else void this.ac.resume();
  }

  private applyGain(): void {
    if (!this.master || !this.ac || !this.sfx || !this.musicBus) return;
    const t = this.ac.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : AUDIO.masterCeiling, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * AUDIO.musicLevel, t, 0.1);
  }

  /** Music runs only while it can be heard, so a muted game costs nothing. */
  private updateMusic(): void {
    if (!this.ac || !this.musicBus) return;
    const want = !this.muted && this.musicVolume > 0;
    if (MUSIC_FILES.length > 0) {
      if (want && !this.musicFile && this.buffers.get('__music')) this.startMusicFile();
      if (!want && this.musicFile) this.stopMusicFile();
      return;
    }
    if (!this.music) {
      this.music = new MusicPlayer(this.ac, this.musicBus);
      this.music.setMood(this.mood);
    }
    if (want && !this.music.playing) this.music.start();
    if (!want && this.music.playing) this.music.stop();
  }

  private async fetchBuffer(files: readonly string[]): Promise<AudioBuffer | null> {
    for (const file of files) {
      try {
        const res = await fetch(this.baseUrl + file);
        if (!res.ok) continue;
        return await this.ac!.decodeAudioData(await res.arrayBuffer());
      } catch {
        // Try the next format, then fall back to the placeholder.
      }
    }
    return null;
  }

  private async load(key: string): Promise<void> {
    const def = SOUNDS[key];
    if (!def?.files?.length || !this.ac) {
      this.buffers.set(key, null);
      return;
    }
    this.buffers.set(key, await this.fetchBuffer(def.files));
    if (key === 'ambient' && this.ambientNode && this.buffers.get(key)) this.restartAmbient();
  }

  private async loadMusicFile(): Promise<void> {
    if (MUSIC_FILES.length === 0 || !this.ac) return;
    this.buffers.set('__music', await this.fetchBuffer(MUSIC_FILES));
    this.updateMusic();
  }

  private startMusicFile(): void {
    const buf = this.buffers.get('__music');
    if (!buf || !this.ac || !this.musicBus) return;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.musicBus);
    src.start();
    this.musicFile = src;
  }

  private stopMusicFile(): void {
    try {
      this.musicFile?.stop();
    } catch {
      // already stopped
    }
    this.musicFile = null;
  }

  play(key: string, volumeScale = 1): void {
    const def = SOUNDS[key];
    if (!def || !this.ac || !this.sfx || this.muted) return;
    // The same sound many times at once (a whole creel sold) plays once.
    const now = this.ac.currentTime * 1000;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < AUDIO.repeatGuardMs) return;
    this.lastPlayed.set(key, now);
    const buffer = this.buffers.get(key);
    const gain = this.ac.createGain();
    gain.gain.value = def.volume * volumeScale;
    gain.connect(this.sfx);
    if (buffer) {
      const src = this.ac.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.start();
      return;
    }
    if (AUDIO.placeholder !== 'synth') return;
    if (def.noise) this.playNoise(def.noise, gain);
    if (def.tone) this.playTone(def.tone, gain, (def.toneDelayMs ?? 0) / 1000);
  }

  private playTone(t: ToneSpec, out: GainNode, delay: number): void {
    const ac = this.ac!;
    let at = ac.currentTime + 0.01 + delay;
    for (const f of t.notes) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(f, at);
      const dur = t.noteMs / 1000;
      if (t.slide) osc.frequency.exponentialRampToValueAtTime(f * t.slide, at + dur);
      const end = at + dur * (t.release ?? 3);
      // Soft attack and long release so nothing clicks or snaps.
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(t.gain, at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env).connect(out);
      osc.start(at);
      osc.stop(end + 0.05);
      at += dur + t.gapMs / 1000;
    }
  }

  private playNoise(n: NoiseSpec, out: GainNode): void {
    const ac = this.ac!;
    const at = ac.currentTime + 0.01 + (n.delayMs ?? 0) / 1000;
    const dur = n.ms / 1000;
    const src = ac.createBufferSource();
    src.buffer = this.whiteNoise();
    const filter = ac.createBiquadFilter();
    filter.type = n.filter;
    filter.Q.value = n.q ?? 0.7;
    filter.frequency.setValueAtTime(n.hz, at);
    if (n.toHz) filter.frequency.exponentialRampToValueAtTime(n.toHz, at + dur);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(n.gain, at + Math.min(0.03, dur / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(env).connect(out);
    src.start(at, Math.random());
    src.stop(at + dur + 0.05);
  }

  private whiteNoise(): AudioBuffer {
    if (this.noise) return this.noise;
    const ac = this.ac!;
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }

  private startAmbient(): void {
    const ac = this.ac;
    const def: SoundDef | undefined = SOUNDS.ambient;
    if (!ac || !this.sfx || !def) return;
    const gain = ac.createGain();
    gain.gain.value = def.volume;
    gain.connect(this.sfx);
    this.startRain(gain);
    const buffer = this.buffers.get('ambient');
    if (buffer) {
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start();
      this.ambientNode = src;
      return;
    }
    if (AUDIO.placeholder !== 'synth' || !def.ambient) return;
    // Gentle water: brown noise through a low-pass filter with a slow swell.
    const len = ac.sampleRate * 4;
    const noise = ac.createBuffer(1, len, ac.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = def.ambient.filterHz;
    const swell = ac.createGain();
    swell.gain.value = def.ambient.gain;
    const lfo = ac.createOscillator();
    lfo.frequency.value = def.ambient.swellHz;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = def.ambient.gain * 0.5;
    lfo.connect(lfoDepth).connect(swell.gain);
    src.connect(filter).connect(swell).connect(gain);
    src.start();
    lfo.start();
    this.ambientNode = src;
  }

  /** Soft hiss of rain on the water, faded in and out by weather. */
  private startRain(out: GainNode): void {
    if (this.rainGain || !this.ac || AUDIO.placeholder !== 'synth') return;
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.whiteNoise();
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = AUDIO.rain.filterHz;
    this.rainGain = ac.createGain();
    this.rainGain.gain.value = this.rain * AUDIO.rain.gain;
    src.connect(filter).connect(this.rainGain).connect(out);
    src.start();
  }

  private restartAmbient(): void {
    try {
      (this.ambientNode as AudioBufferSourceNode | null)?.stop();
    } catch {
      // already stopped
    }
    this.ambientNode = null;
    this.startAmbient();
  }
}
