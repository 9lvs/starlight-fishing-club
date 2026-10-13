// The sound of a place: a few soft layers under the water and music. Steady
// layers (a stream, surf, a cave hum, a high breeze) are filtered noise that
// fades in and out; occasional layers (birds, frogs, crickets, an owl, gulls, a
// bell buoy, drips, chimes) are tiny synthesized calls at random intervals.
// Which ones play comes from the water's `sound.bed` list and the time of day.
// No Phaser here.
import { BED, type BedLayerDef } from '../config/audio';

interface Loop {
  gain: GainNode;
  nodes: AudioScheduledSourceNode[];
}

const TICK_MS = 250;

export class SoundBed {
  private loops = new Map<string, Loop>();
  private layers: readonly string[] = [];
  private phase = 'day';
  private next = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ac: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Change the place's layers; steady ones cross-fade over a couple of seconds. */
  set(layers: readonly string[], phase: string): void {
    this.layers = layers;
    this.phase = phase;
    this.sync();
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  setPhase(phase: string): void {
    this.phase = phase;
    this.sync();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const id of [...this.loops.keys()]) this.fadeOut(id);
  }

  private active(id: string): BedLayerDef | null {
    const def = BED[id];
    if (!def || !this.layers.includes(id)) return null;
    if (def.phases && !def.phases.includes(this.phase)) return null;
    return def;
  }

  private sync(): void {
    const t = this.ac.currentTime;
    for (const id of Object.keys(BED)) {
      const def = BED[id]!;
      if (def.kind !== 'loop') continue;
      const want = this.active(id) !== null;
      if (want && !this.loops.has(id)) this.loops.set(id, this.startLoop(def));
      if (!want && this.loops.has(id)) this.fadeOut(id);
      const loop = this.loops.get(id);
      if (want && loop) loop.gain.gain.setTargetAtTime(def.gain, t, 1.2);
    }
    // Calls that just came into season start after a short, random pause.
    for (const id of this.layers) if (BED[id]?.kind === 'call' && !this.next.has(id)) this.schedule(id, true);
  }

  private fadeOut(id: string): void {
    const loop = this.loops.get(id);
    if (!loop) return;
    this.loops.delete(id);
    const t = this.ac.currentTime;
    loop.gain.gain.setTargetAtTime(0, t, 0.8);
    for (const n of loop.nodes) n.stop(t + 4);
  }

  private schedule(id: string, first = false): void {
    const def = BED[id]!;
    const [lo, hi] = def.everyS ?? [8, 16];
    const wait = lo + this.rng() * (hi - lo);
    this.next.set(id, this.ac.currentTime + (first ? wait * this.rng() : wait));
  }

  private tick(): void {
    const now = this.ac.currentTime;
    for (const id of this.layers) {
      const def = BED[id];
      if (!def || def.kind !== 'call') continue;
      const at = this.next.get(id);
      if (at === undefined || now < at) continue;
      // Out of season (no birds at night): skip this one and check again later.
      if (this.active(id)) this.call(def, now + 0.05);
      this.schedule(id);
    }
  }

  private startLoop(def: BedLayerDef): Loop {
    const ac = this.ac;
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(this.out);
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = def.filter ?? 'lowpass';
    filter.frequency.value = def.hz ?? 600;
    filter.Q.value = def.q ?? 0.7;
    const swell = ac.createGain();
    swell.gain.value = 1;
    src.connect(filter).connect(swell).connect(gain);
    const nodes: AudioScheduledSourceNode[] = [src];
    if (def.swellHz) {
      // A slow swell (waves, gusts) or a fast flutter (a babbling stream).
      const lfo = ac.createOscillator();
      lfo.frequency.value = def.swellHz;
      const depth = ac.createGain();
      depth.gain.value = def.swellDepth ?? 0.5;
      lfo.connect(depth).connect(swell.gain);
      lfo.start();
      nodes.push(lfo);
    }
    if (def.drone) {
      const o = ac.createOscillator();
      o.frequency.value = def.drone;
      const g = ac.createGain();
      g.gain.value = 0.35;
      o.connect(g).connect(gain);
      o.start();
      nodes.push(o);
    }
    src.start(0, this.rng() * 1.5);
    return { gain, nodes };
  }

  /** A single call. Each kind is a few notes with soft edges, never sharp. */
  private call(def: BedLayerDef, at: number): void {
    const r = this.rng;
    const g = def.gain;
    switch (def.voice) {
      case 'birds': {
        const n = 2 + Math.floor(r() * 3);
        const base = 2600 + r() * 1400;
        for (let i = 0; i < n; i++) this.note('sine', base * (1 + r() * 0.15), base * (1.2 + r() * 0.3), at + i * (0.11 + r() * 0.06), 0.08, g);
        return;
      }
      case 'frogs': {
        const f = 130 + r() * 60;
        for (let i = 0; i < 3 + Math.floor(r() * 3); i++) this.note('triangle', f, f * 0.92, at + i * 0.09, 0.06, g, 500);
        return;
      }
      case 'crickets': {
        for (let b = 0; b < 3; b++) for (let i = 0; i < 6; i++) this.note('sine', 4600, 4600, at + b * 0.35 + i * 0.028, 0.015, g);
        return;
      }
      case 'owl': {
        this.note('sine', 390, 370, at, 0.32, g);
        this.note('sine', 360, 330, at + 0.55, 0.45, g);
        return;
      }
      case 'gulls': {
        const n = 2 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) this.note('triangle', 1250 + r() * 200, 750, at + i * 0.38, 0.28, g, 2200);
        return;
      }
      case 'bell': {
        // An inharmonic partial makes it read as a real bell.
        this.note('sine', 440, 440, at, 3, g);
        this.note('sine', 440 * 2.76, 440 * 2.76, at, 1.6, g * 0.25);
        return;
      }
      case 'drip': {
        const f = 900 + r() * 700;
        this.note('sine', f, f * 2, at, 0.18, g);
        this.note('sine', f, f * 2, at + 0.22, 0.16, g * 0.3);
        return;
      }
      case 'chimes': {
        const pent = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
        for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
          const f = pent[Math.floor(r() * pent.length)]!;
          this.note('triangle', f, f, at + i * (0.25 + r() * 0.2), 2.2, g);
        }
        return;
      }
    }
  }

  private note(type: OscillatorType, f0: number, f1: number, at: number, dur: number, gain: number, lowpass?: number): void {
    const ac = this.ac;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + Math.min(0.02, dur / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node: AudioNode = o;
    if (lowpass) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = o.connect(f);
    }
    node.connect(env).connect(this.out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}
