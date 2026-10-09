// Web Audio playback with no Phaser dependency. Nothing makes a sound until the
// first user gesture (browsers block autoplay, and surprise audio is not calm).
// Real files are loaded when present; otherwise a placeholder plays.
import { AUDIO, SOUNDS, type SoundDef, type ToneSpec } from '../config/audio';

export class AudioManager {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer | null>();
  private ambientNode: AudioNode | null = null;
  private muted = false;
  private volume: number = AUDIO.masterDefault;
  private wantAmbient = true;

  constructor(private readonly baseUrl = './') {}

  /** Call from a user gesture. Safe to call many times. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ac) {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.connect(this.ac.destination);
      this.applyGain();
      for (const key of Object.keys(SOUNDS)) void this.load(key);
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
    if (this.wantAmbient && !this.ambientNode) this.startAmbient();
  }

  get unlocked(): boolean {
    return this.ac !== null;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  /** Pause everything while the tab is hidden. */
  suspend(hidden: boolean): void {
    if (!this.ac) return;
    if (hidden) void this.ac.suspend();
    else void this.ac.resume();
  }

  private applyGain(): void {
    if (!this.master || !this.ac) return;
    const target = this.muted ? 0 : this.volume * AUDIO.masterCeiling;
    this.master.gain.setTargetAtTime(target, this.ac.currentTime, 0.05);
  }

  private async load(key: string): Promise<void> {
    const def = SOUNDS[key];
    if (!def?.files?.length || !this.ac) {
      this.buffers.set(key, null);
      return;
    }
    for (const file of def.files) {
      try {
        const res = await fetch(this.baseUrl + file);
        if (!res.ok) continue;
        this.buffers.set(key, await this.ac.decodeAudioData(await res.arrayBuffer()));
        if (key === 'ambient' && this.ambientNode) this.restartAmbient();
        return;
      } catch {
        // Try the next format, then fall back to the placeholder.
      }
    }
    this.buffers.set(key, null);
  }

  play(key: string, volumeScale = 1): void {
    const def = SOUNDS[key];
    if (!def || !this.ac || !this.master || this.muted) return;
    const buffer = this.buffers.get(key);
    const gain = this.ac.createGain();
    gain.gain.value = def.volume * volumeScale;
    gain.connect(this.master);
    if (buffer) {
      const src = this.ac.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.start();
      return;
    }
    if (AUDIO.placeholder === 'synth' && def.tone) this.playTone(def.tone, gain);
  }

  private playTone(t: ToneSpec, out: GainNode): void {
    const ac = this.ac!;
    let at = ac.currentTime + 0.01;
    for (const f of t.notes) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = t.wave;
      osc.frequency.value = f;
      const dur = t.noteMs / 1000;
      // Soft attack and long release so nothing clicks or snaps.
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(t.gain, at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, at + dur * 3);
      osc.connect(env).connect(out);
      osc.start(at);
      osc.stop(at + dur * 3 + 0.05);
      at += dur + t.gapMs / 1000;
    }
  }

  private startAmbient(): void {
    const ac = this.ac;
    const def: SoundDef | undefined = SOUNDS.ambient;
    if (!ac || !this.master || !def) return;
    const gain = ac.createGain();
    gain.gain.value = def.volume;
    gain.connect(this.master);
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
