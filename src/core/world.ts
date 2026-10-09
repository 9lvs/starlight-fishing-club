// Shared world state: which water the boat is on, the current time of day and
// weather, and which decorations are showing. Features read it; the map feature
// changes the water through setWater().
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
  /** Waters the player has already been told about, so unlock toasts fire once. */
  knownUnlocked: string[];
}

export function worldSliceDef(defaultWater: string): SaveSliceDef<WorldSlice> {
  return {
    key: 'world',
    version: 1,
    defaults: () => ({ waterId: defaultWater, knownUnlocked: [defaultWater] }),
  };
}

export class WorldState {
  private _phase: string;
  private _weather: string;
  private forcedWeather: string | null = null;
  private decorations = new Set<string>();

  constructor(
    private readonly slice: WorldSlice,
    private readonly registries: Registries,
    private readonly stats: StatsService,
    private readonly clock: Clock,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this._phase = phaseAt(clock.now(), TIME).id;
    this._weather = this.computeWeather();
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

  isUnlocked(waterId: string): boolean {
    const w = this.registries.waters.tryGet(waterId);
    if (!w || w.comingSoon) return false;
    return this.stats.get('boatRange') >= w.rangeRequired;
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

  checkUnlocks(announce: boolean): void {
    for (const id of this.unlockedWaters()) {
      if (this.slice.knownUnlocked.includes(id)) continue;
      this.slice.knownUnlocked.push(id);
      if (announce) this.bus.emit('waterUnlocked', { waterId: id });
    }
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

  private firstWater(): string {
    const first = this.unlockedWaters()[0];
    if (!first) throw new Error('no playable water: check rangeRequired in waters.json');
    return first;
  }
}
