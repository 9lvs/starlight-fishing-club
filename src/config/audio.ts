// Every sound the game plays, by key. To add real audio, drop files into
// public/audio/ and list them in `files` (first playable format wins; ship .ogg
// and .mp3 for Safari). Until a file exists, `placeholder` decides what plays:
// soft synthesized sounds ('synth') or nothing ('silent'). Background music is
// composed live from MUSIC below unless a `music` file is listed.

export type Placeholder = 'synth' | 'silent';

export interface ToneSpec {
  /** Frequencies in Hz, played one after another. */
  notes: number[];
  wave: 'sine' | 'triangle';
  noteMs: number;
  gapMs: number;
  gain: number;
  /** Each note glides to this multiple of its pitch (0.5 = an octave down, for "bloop"). */
  slide?: number;
  /** Release length as a multiple of noteMs (default 3). */
  release?: number;
}

/** Filtered noise: splashes, whooshes, rain, paper. */
export interface NoiseSpec {
  filter: 'lowpass' | 'bandpass' | 'highpass';
  hz: number;
  /** Sweep the filter to this frequency over the sound (whooshes). */
  toHz?: number;
  q?: number;
  ms: number;
  gain: number;
  delayMs?: number;
}

export interface SoundDef {
  files?: string[];
  volume: number;
  loop?: boolean;
  tone?: ToneSpec;
  noise?: NoiseSpec;
  /** Start the tone this long after the noise (a splash, then a chime). */
  toneDelayMs?: number;
  /** Ambient bed made of filtered noise, used when no file exists. */
  ambient?: { filterHz: number; gain: number; swellHz: number };
}

export const AUDIO = {
  placeholder: 'synth' as Placeholder,
  /** Effects volume (water and sounds). */
  masterDefault: 0.7,
  musicDefault: 0.7,
  /** Never louder than this, even at 100% volume. Keeps the game calm. */
  masterCeiling: 0.6,
  /** Music sits just under the effects (playtest: it was too quiet). */
  musicLevel: 1,
  /** Soft limiter on the master bus. */
  limiter: { thresholdDb: -10, kneeDb: 8, ratio: 4 },
  /** The same sound twice within this window plays once (selling a whole creel). */
  repeatGuardMs: 70,
  /** The water's sound bed (birds, surf, drips...) under the effects. */
  bedLevel: 1.5,
  /** Rain on the water, mixed in by weather. */
  rain: { filterHz: 2600, gain: 0.035 },
  /** Wind gusts, mixed in by weather. */
  wind: { filterHz: 520, gain: 0.05, swellHz: 0.11 },
};

// Pentatonic notes keep every placeholder gentle and in key.
const C4 = 261.63;
const G4 = 392.0;
const A4 = 440.0;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const E6 = 1318.5;

export const SOUNDS: Record<string, SoundDef> = {
  ambient: { volume: 0.5, loop: true, ambient: { filterHz: 420, gain: 0.05, swellHz: 0.07 } },
  // Fishing.
  cast: {
    volume: 0.5,
    noise: { filter: 'bandpass', hz: 700, toHz: 2200, q: 1.2, ms: 260, gain: 0.05 },
    tone: { notes: [G4, C5], wave: 'sine', noteMs: 70, gapMs: 20, gain: 0.04 },
  },
  plop: {
    volume: 0.55,
    noise: { filter: 'lowpass', hz: 900, ms: 120, gain: 0.07 },
    tone: { notes: [D5], wave: 'sine', noteMs: 90, gapMs: 0, gain: 0.07, slide: 0.55 },
  },
  bite: { volume: 0.6, tone: { notes: [E5, E5], wave: 'sine', noteMs: 70, gapMs: 70, gain: 0.08, slide: 0.7 } },
  reel: {
    volume: 0.5,
    noise: { filter: 'highpass', hz: 3000, ms: 380, gain: 0.015 },
    tone: { notes: [C5, D5, E5, G5], wave: 'sine', noteMs: 50, gapMs: 15, gain: 0.05 },
  },
  catch: {
    volume: 0.6,
    noise: { filter: 'lowpass', hz: 1400, ms: 240, gain: 0.08 },
    tone: { notes: [C5, G5], wave: 'sine', noteMs: 140, gapMs: 30, gain: 0.07 },
    toneDelayMs: 120,
  },
  slip: {
    volume: 0.45,
    noise: { filter: 'lowpass', hz: 1200, ms: 200, gain: 0.07 },
    tone: { notes: [G5, E5, C5], wave: 'sine', noteMs: 90, gapMs: 30, gain: 0.04, slide: 0.95 },
    toneDelayMs: 150,
  },
  quick: { volume: 0.45, tone: { notes: [E5, G5, C6], wave: 'sine', noteMs: 45, gapMs: 10, gain: 0.05 } },
  miss: { volume: 0.4, tone: { notes: [E5, C5], wave: 'sine', noteMs: 120, gapMs: 40, gain: 0.04, slide: 0.94 } },
  keep: {
    volume: 0.5,
    noise: { filter: 'lowpass', hz: 500, ms: 90, gain: 0.06 },
    tone: { notes: [G4], wave: 'triangle', noteMs: 80, gapMs: 0, gain: 0.06, slide: 0.8 },
  },
  coin: { volume: 0.4, tone: { notes: [A5, C6], wave: 'sine', noteMs: 60, gapMs: 10, gain: 0.05 } },
  gem: { volume: 0.55, tone: { notes: [E6, C6, E6], wave: 'sine', noteMs: 60, gapMs: 30, gain: 0.05, release: 5 } },
  set: { volume: 0.6, tone: { notes: [C5, E5, G5, C6, G5, C6, E6], wave: 'triangle', noteMs: 70, gapMs: 15, gain: 0.06 } },
  bundle: { volume: 0.5, tone: { notes: [C5, E5, G5, C6, E6], wave: 'sine', noteMs: 60, gapMs: 15, gain: 0.05 } },
  // Menus and buying.
  ui_click: { volume: 0.3, tone: { notes: [G5], wave: 'sine', noteMs: 30, gapMs: 0, gain: 0.04 } },
  ui_open: {
    volume: 0.35,
    noise: { filter: 'bandpass', hz: 1800, q: 0.8, ms: 90, gain: 0.025 },
    tone: { notes: [C5, G5], wave: 'sine', noteMs: 50, gapMs: 10, gain: 0.04 },
  },
  ui_close: {
    volume: 0.3,
    noise: { filter: 'bandpass', hz: 1400, q: 0.8, ms: 80, gain: 0.02 },
    tone: { notes: [G5, C5], wave: 'sine', noteMs: 45, gapMs: 10, gain: 0.035 },
  },
  ui_deny: { volume: 0.3, tone: { notes: [A4, G4], wave: 'sine', noteMs: 60, gapMs: 10, gain: 0.035 } },
  purchase: { volume: 0.5, tone: { notes: [C5, E5, G5, C6], wave: 'sine', noteMs: 80, gapMs: 15, gain: 0.07 } },
  hire: { volume: 0.5, tone: { notes: [G4, C5, E5, G5], wave: 'triangle', noteMs: 90, gapMs: 25, gain: 0.05 } },
  unlock: { volume: 0.6, tone: { notes: [C5, E5, G5, C6], wave: 'sine', noteMs: 140, gapMs: 30, gain: 0.07 } },
  club_move: {
    volume: 0.6,
    noise: { filter: 'lowpass', hz: 600, toHz: 300, ms: 900, gain: 0.05 },
    tone: { notes: [C4, G4, C5, E5, G5, C6], wave: 'triangle', noteMs: 160, gapMs: 40, gain: 0.06, release: 4 },
    toneDelayMs: 200,
  },
  daily: { volume: 0.55, tone: { notes: [E5, G5, A5, C6, E6], wave: 'sine', noteMs: 70, gapMs: 20, gain: 0.05 } },
  phase: { volume: 0.3, tone: { notes: [G5, E5], wave: 'sine', noteMs: 220, gapMs: 120, gain: 0.03, release: 5 } },
  tip: { volume: 0.3, tone: { notes: [E5, A5], wave: 'sine', noteMs: 70, gapMs: 20, gain: 0.03 } },
  // Rarity stings grow with the tier.
  sting_common: { volume: 0.4, tone: { notes: [C5], wave: 'sine', noteMs: 120, gapMs: 0, gain: 0.05 } },
  sting_uncommon: { volume: 0.5, tone: { notes: [C5, E5], wave: 'sine', noteMs: 120, gapMs: 20, gain: 0.06 } },
  sting_rare: { volume: 0.55, tone: { notes: [C5, E5, G5], wave: 'triangle', noteMs: 130, gapMs: 20, gain: 0.06 } },
  sting_epic: { volume: 0.6, tone: { notes: [C5, E5, G5, A5], wave: 'triangle', noteMs: 140, gapMs: 25, gain: 0.06 } },
  sting_legendary: { volume: 0.65, tone: { notes: [C5, E5, G5, C6, G5, C6], wave: 'triangle', noteMs: 150, gapMs: 30, gain: 0.07 } },
};

/** One layer of a water's sound bed (systems/soundBed.ts). Waters list layers by id in `sound.bed`. */
export interface BedLayerDef {
  /** `loop`: steady filtered noise. `call`: a short synthesized call now and then. */
  kind: 'loop' | 'call';
  gain: number;
  /** Only during these times of day (all if left out). */
  phases?: string[];
  // Loops.
  filter?: BiquadFilterType;
  hz?: number;
  q?: number;
  swellHz?: number;
  swellDepth?: number;
  /** A very low tone under the noise (the cave). */
  drone?: number;
  // Calls.
  voice?: 'birds' | 'frogs' | 'crickets' | 'owl' | 'gulls' | 'bell' | 'drip' | 'chimes';
  /** Seconds between calls, as a range. */
  everyS?: [number, number];
}

export const BED: Record<string, BedLayerDef> = {
  stream: { kind: 'loop', gain: 0.05, filter: 'bandpass', hz: 1100, q: 0.6, swellHz: 3.3, swellDepth: 0.25 },
  surf: { kind: 'loop', gain: 0.07, filter: 'lowpass', hz: 650, swellHz: 0.085, swellDepth: 0.8 },
  lagoon: { kind: 'loop', gain: 0.045, filter: 'lowpass', hz: 900, swellHz: 0.12, swellDepth: 0.6 },
  cave_hum: { kind: 'loop', gain: 0.05, filter: 'lowpass', hz: 170, drone: 55 },
  high_breeze: { kind: 'loop', gain: 0.04, filter: 'bandpass', hz: 1700, q: 0.5, swellHz: 0.05, swellDepth: 0.7 },
  birds: { kind: 'call', voice: 'birds', gain: 0.022, phases: ['day', 'dawn'], everyS: [4, 11] },
  frogs: { kind: 'call', voice: 'frogs', gain: 0.05, phases: ['dusk', 'night'], everyS: [5, 12] },
  crickets: { kind: 'call', voice: 'crickets', gain: 0.012, phases: ['night'], everyS: [2, 5] },
  owl: { kind: 'call', voice: 'owl', gain: 0.035, phases: ['night'], everyS: [18, 40] },
  gulls: { kind: 'call', voice: 'gulls', gain: 0.02, phases: ['day', 'dawn', 'dusk'], everyS: [9, 22] },
  bell_buoy: { kind: 'call', voice: 'bell', gain: 0.025, everyS: [10, 18] },
  drips: { kind: 'call', voice: 'drip', gain: 0.03, everyS: [1.5, 5] },
  chimes: { kind: 'call', voice: 'chimes', gain: 0.018, everyS: [7, 16] },
};

/** A music file, if you add one (it replaces the composed music). Example: ['audio/music.ogg', 'audio/music.mp3']. */
export const MUSIC_FILES: string[] = [];

export type MusicVoice = 'pluck' | 'bell' | 'marimba' | 'harp';

/** A water's own music: its key (semitones from C), melody voice, and pace. */
export interface WaterMusic {
  transpose: number;
  voice?: MusicVoice;
  tempo: number;
}

export interface MusicMood {
  /** Chance of a melody note on each half beat. */
  density: number;
  /** MIDI note the melody centers on. */
  register: number;
  /** Low-pass cutoff for the pads (darker at night). */
  brightness: number;
  /** Melody voice: a soft pluck, or a music-box bell at night. Waters can pick their own. */
  voice: MusicVoice;
}

/**
 * Composed music: slow chords with a sparse pentatonic melody, a little
 * different every time, and gentler as night falls.
 */
export const MUSIC = {
  bpm: 54,
  beatsPerBar: 4,
  /** Each chord lasts this many bars; the progression loops. */
  barsPerChord: 2,
  /** MIDI notes: [bass root, pad notes]. Cmaj7, Am7, Fmaj7, G6. */
  progression: [
    [36, [55, 60, 64, 71]],
    [33, [55, 60, 64, 69]],
    [29, [53, 57, 60, 64]],
    [31, [55, 59, 62, 64]],
  ] as [number, number[]][],
  /** C major pentatonic, as semitones from C. */
  scale: [0, 2, 4, 7, 9],
  /** Every Nth bar the melody mostly rests, so phrases breathe. */
  restEvery: 4,
  gain: { pad: 0.09, bass: 0.17, pluck: 0.2, bell: 0.15, marimba: 0.2, harp: 0.17 },
  reverbSeconds: 2.8,
  reverbWet: 0.4,
  fadeInSeconds: 6,
  moods: {
    day: { density: 0.26, register: 72, brightness: 2200, voice: 'pluck' },
    dusk: { density: 0.2, register: 72, brightness: 1600, voice: 'pluck' },
    night: { density: 0.13, register: 79, brightness: 1000, voice: 'bell' },
    dawn: { density: 0.18, register: 74, brightness: 1900, voice: 'pluck' },
  } as Record<string, MusicMood>,
};
