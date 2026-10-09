// Pure time-of-day and weather math. The day cycle and weather are functions of
// the wall clock, so offline catch-up can replay any interval exactly.
import { hash01, weightedPick } from '../core/rng';

export interface PhaseDef {
  id: string;
  share: number;
}

export interface TimeConfig {
  dayCycleMs: number;
  phases: readonly PhaseDef[];
  cycleOffsetMs: number;
}

export interface WeatherConfig {
  periodMs: number;
  seed: number;
}

export interface WeightedWeather {
  id: string;
  weight: number;
}

export interface PhaseInfo {
  id: string;
  index: number;
  /** 0..1 progress through this phase. */
  progress: number;
  startMs: number;
  endMs: number;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function phaseAt(ms: number, cfg: TimeConfig): PhaseInfo {
  const local = mod(ms + cfg.cycleOffsetMs, cfg.dayCycleMs);
  const cycleStart = ms - local;
  let acc = 0;
  for (let i = 0; i < cfg.phases.length; i++) {
    const p = cfg.phases[i]!;
    const len = p.share * cfg.dayCycleMs;
    if (local < acc + len || i === cfg.phases.length - 1) {
      const startMs = cycleStart + acc;
      const endMs = i === cfg.phases.length - 1 ? cycleStart + cfg.dayCycleMs : startMs + len;
      return { id: p.id, index: i, progress: Math.min(1, (local - acc) / len), startMs, endMs };
    }
    acc += len;
  }
  throw new Error('time config has no phases');
}

/** Clock offset that moves "now" to the start of the given phase (debug helper). */
export function offsetToPhase(nowMs: number, phaseId: string, cfg: TimeConfig): number {
  let acc = 0;
  for (const p of cfg.phases) {
    if (p.id === phaseId) break;
    acc += p.share * cfg.dayCycleMs;
  }
  const local = mod(nowMs + cfg.cycleOffsetMs, cfg.dayCycleMs);
  return mod(acc - local, cfg.dayCycleMs) + 1;
}

export function weatherPeriod(ms: number, cfg: WeatherConfig): number {
  return Math.floor(ms / cfg.periodMs);
}

export function weatherForPeriod(period: number, list: readonly WeightedWeather[], cfg: WeatherConfig): string {
  const r = hash01(period, cfg.seed);
  const picked = weightedPick(
    list.map((w) => ({ item: w.id, weight: w.weight })),
    () => r,
  );
  return picked ?? list[0]?.id ?? 'clear';
}

export function weatherAt(ms: number, list: readonly WeightedWeather[], cfg: WeatherConfig): string {
  return weatherForPeriod(weatherPeriod(ms, cfg), list, cfg);
}

export interface Segment {
  start: number;
  end: number;
  phase: string;
  weather: string;
}

/** Split [start, end) into pieces where both time of day and weather are constant. */
export function segmentsBetween(
  start: number,
  end: number,
  time: TimeConfig,
  weatherList: readonly WeightedWeather[],
  weatherCfg: WeatherConfig,
): Segment[] {
  const out: Segment[] = [];
  let t = start;
  while (t < end) {
    const phase = phaseAt(t, time);
    const period = weatherPeriod(t, weatherCfg);
    const weatherEnd = (period + 1) * weatherCfg.periodMs;
    const segEnd = Math.min(end, phase.endMs, weatherEnd);
    const weather = weatherForPeriod(period, weatherList, weatherCfg);
    const last = out[out.length - 1];
    if (last && last.phase === phase.id && last.weather === weather && last.end === t) last.end = segEnd;
    else out.push({ start: t, end: segEnd, phase: phase.id, weather });
    // Guard against zero-length steps from floating point.
    t = segEnd > t ? segEnd : t + 1;
  }
  return out;
}
