// Shared world state: which water the boat is on, how far the club has come
// (its rank), the current time of day and weather, and which decorations and
// looks (rod, boat) are showing. Features read it; the map feature changes the
// water through setWater() and core/club.ts moves the club.
import { TIME, WEATHER } from '../config/time';
import { phaseAt, weatherAt } from '../systems/timeOfDay';
import type { Conditions } from '../systems/lootTable';
import type { Clock } from './clock';
import type { EventBus } from './eventBus';
import type { GameEvents } from './events';
import type { SaveSliceDef } from './feature';
import type { Registries } from './context';
import type { StatsService } from './stats';

export interface WorldSlice {
  waterId: string;
  /** Waters the player has already been told about, so "you can move here" toasts fire once. */
  knownUnlocked: string[];
  /** rangeRequired of the club's home water. Every water up to it can be visited. */
  clubRank: number;
}

export function worldSliceDef(defaultWater: string): SaveSliceDef<WorldSlice> {
  return {
    key: 'world',
    version: 2,
    defaults: () => ({ waterId: defaultWater, knownUnlocked: [defaultWater], clubRank: 0 }),
    // v1 unlocked waters with boat range alone. Keep every water reached so far
    // (worked out from knownUnlocked once the registries exist, see WorldState).
    migrate: (old) => ({ ...(old as WorldSlice), clubRank: -1 }),
  };
}

interface LookEntry {
  value: Record<string, unknown>;
  priority: number;
}

export class WorldState {
  private _phase: string;
  private _weather: string;
  private forcedWeather: string | null = null;
  private decorations = new Set<string>();
  private looks = new Map<string, Map<string, LookEntry>>();

  constructor(
    private readonly slice: WorldSlice,
    private readonly registries: Registries,
    private readonly stats: StatsService,
    private readonly clock: Clock,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this._phase = phaseAt(clock.now(), TIME).id;
    this._weather = this.computeWeather();
    if (!(slice.clubRank >= 0)) slice.clubRank = this.rankFromKnown();
    if (!this.isUnlocked(slice.waterId)) slice.waterId = this.firstWater();
    bus.on('statsChanged', ({ stats }) => {
      if (stats.includes('boatRange')) this.checkUnlocks(true);
    });
  }

  get waterId(): string {
    return this.slice.waterId;
  }

  get phase(): string {
    return this._phase;
  }

  get weather(): string {
    return this._weather;
  }

  conditions(waterId = this.waterId): Conditions {
    return { waterId, phase: this._phase, weather: this._weather };
  }

  get clubRank(): number {
    return this.slice.clubRank;
  }

  /** The water the club calls home (the furthest one reached). */
  clubWater(): string {
    return this.watersByRank().find((w) => w.rangeRequired === this.slice.clubRank)?.id ?? this.firstWater();
  }

  /** The next stop on the journey, even if it is still "coming soon". */
  nextWater(): string | null {
    return this.watersByRank().find((w) => w.rangeRequired > this.slice.clubRank)?.id ?? null;
  }

  /** Waters up to the club's rank can be visited freely. */
  isUnlocked(waterId: string): boolean {
    const w = this.registries.waters.tryGet(waterId);
    if (!w || w.comingSoon) return false;
    return w.rangeRequired <= this.slice.clubRank;
  }

  /** The club can move to the next water once the boat has the range. */
  canMoveTo(waterId: string): boolean {
    const w = this.registries.waters.tryGet(waterId);
    if (!w || w.comingSoon || this.nextWater() !== waterId) return false;
    return this.stats.get('boatRange') >= w.rangeRequired;
  }

  /** Make a water the club's home. Callers go through core/club.ts, which also resets progress. */
  moveClub(waterId: string): { rank: number; previousRank: number } | null {
    const w = this.registries.waters.tryGet(waterId);
    if (!w || w.comingSoon) return null;
    const previousRank = this.slice.clubRank;
    this.slice.clubRank = w.rangeRequired;
    if (!this.slice.knownUnlocked.includes(waterId)) this.slice.knownUnlocked.push(waterId);
    if (this.slice.waterId !== waterId) {
      const previous = this.slice.waterId;
      this.slice.waterId = waterId;
      this.bus.emit('waterChanged', { waterId, previous });
    }
    return { rank: w.rangeRequired, previousRank };
  }

  unlockedWaters(): string[] {
    return this.registries.waters
      .list()
      .filter((w) => this.isUnlocked(w.id))
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
  }

  setWater(waterId: string): boolean {
    if (!this.isUnlocked(waterId) || waterId === this.slice.waterId) return false;
    const previous = this.slice.waterId;
    this.slice.waterId = waterId;
    this.bus.emit('waterChanged', { waterId, previous });
    return true;
  }

  /** Called every tick; emits time and weather changes. */
  update(): void {
    const phase = phaseAt(this.clock.now(), TIME).id;
    if (phase !== this._phase) {
      const previous = this._phase;
      this._phase = phase;
      this.bus.emit('timeOfDayChanged', { phase, previous });
    }
    const weather = this.computeWeather();
    if (weather !== this._weather) {
      const previous = this._weather;
      this._weather = weather;
      this.bus.emit('weatherChanged', { weather, previous });
    }
  }

  /** Debug: pin the weather, or pass null to follow the schedule again. */
  forceWeather(id: string | null): void {
    this.forcedWeather = id;
    this.update();
  }

  /** Announce once when the boat can first reach the next water. */
  checkUnlocks(announce: boolean): void {
    const next = this.nextWater();
    if (!next || !this.canMoveTo(next) || this.slice.knownUnlocked.includes(next)) return;
    this.slice.knownUnlocked.push(next);
    if (announce) this.bus.emit('waterUnlocked', { waterId: next });
  }

  // Looks (rod, boat): several owned upgrades may offer one; the highest priority shows.
  setLook(slot: string, source: string, value: Record<string, unknown> | null, priority = 0): void {
    const entries = this.looks.get(slot) ?? new Map<string, LookEntry>();
    if (value) entries.set(source, { value, priority });
    else if (!entries.delete(source)) return;
    this.looks.set(slot, entries);
    this.bus.emit('lookChanged', { slot });
  }

  look(slot: string): Record<string, unknown> | null {
    let best: LookEntry | null = null;
    for (const e of this.looks.get(slot)?.values() ?? []) if (!best || e.priority > best.priority) best = e;
    return best?.value ?? null;
  }

  // Decorations are shown by effect handlers; they are rebuilt from upgrades on load.
  addDecoration(id: string): void {
    if (this.decorations.has(id)) return;
    this.decorations.add(id);
    this.bus.emit('decorationsChanged', { ids: this.activeDecorations() });
  }

  removeDecoration(id: string): void {
    if (this.decorations.delete(id)) this.bus.emit('decorationsChanged', { ids: this.activeDecorations() });
  }

  activeDecorations(): string[] {
    return [...this.decorations];
  }

  private computeWeather(): string {
    if (this.forcedWeather) return this.forcedWeather;
    return weatherAt(this.clock.now(), this.registries.weather.list(), WEATHER);
  }

  private watersByRank() {
    return [...this.registries.waters.list()].sort((a, b) => a.rangeRequired - b.rangeRequired || a.order - b.order);
  }

  /** Old saves: the furthest playable water the player had already reached. */
  private rankFromKnown(): number {
    let rank = 0;
    for (const id of this.slice.knownUnlocked ?? []) {
      const w = this.registries.waters.tryGet(id);
      if (w && !w.comingSoon) rank = Math.max(rank, w.rangeRequired);
    }
    return rank;
  }

  private firstWater(): string {
    const first = this.unlockedWaters()[0];
    if (!first) throw new Error('no playable water: check rangeRequired in waters.json');
    return first;
  }
}
