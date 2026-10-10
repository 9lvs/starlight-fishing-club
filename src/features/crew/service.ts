// Crew: hired helpers each fish one water on a timer. Their catches go to the
// journal and sell automatically at the crewSellMult share of value, so hand
// fishing (with pity and full value) always stays worthwhile.
import { LOOT } from '../../config/balance';
import { ECONOMY } from '../../config/balance';
import { TIME, WEATHER } from '../../config/time';
import { lootFish, lootRarities, makeCatch, rollSize } from '../../core/catching';
import type { GameContext } from '../../core/context';
import type { CrewDef } from '../../core/content/schemas';
import type { OfflineReport } from '../../core/types';
import { simulateOffline } from '../../systems/offlineSim';
import { formatNumber } from '../../ui/format';
import type { CrewMember, CrewSlice } from './state';

export class CrewService {
  constructor(
    private readonly ctx: GameContext,
    readonly slice: CrewSlice,
  ) {}

  type(m: CrewMember): CrewDef | undefined {
    return this.ctx.registries.crewTypes.tryGet(m.typeId);
  }

  intervalMs(m: CrewMember): number {
    return this.ctx.stats.get('crewIntervalMs') * (this.type(m)?.intervalMult ?? 1);
  }

  private valueMult(m: CrewMember): number {
    const s = this.ctx.stats;
    return s.get('sellValueMult') * s.get('crewSellMult') * (this.type(m)?.valueMult ?? 1);
  }

  private luck(m: CrewMember): number {
    return this.ctx.stats.get('crewLuck') + (this.type(m)?.luck ?? 0);
  }

  get slots(): number {
    return this.ctx.stats.get('crewSlots');
  }

  get freeSlots(): number {
    return Math.max(0, this.slots - this.slice.members.length);
  }

  isHired(typeId: string): boolean {
    return this.slice.members.some((m) => m.typeId === typeId);
  }

  canHire(t: CrewDef): boolean {
    return this.freeSlots > 0 && !this.isHired(t.id) && this.ctx.wallet.canAfford(t.currency ?? ECONOMY.defaultCurrency, t.hireCost);
  }

  hire(typeId: string): boolean {
    const t = this.ctx.registries.crewTypes.get(typeId);
    if (!this.canHire(t)) return false;
    if (!this.ctx.wallet.spend(t.currency ?? ECONOMY.defaultCurrency, t.hireCost)) return false;
    const m: CrewMember = { id: `c${this.slice.nextId++}`, typeId, waterId: this.ctx.world.waterId, progressMs: 0, catches: 0, earned: 0 };
    this.slice.members.push(m);
    this.ctx.bus.emit('crewHired', { crewId: m.id, typeId });
    return true;
  }

  assign(crewId: string, waterId: string): void {
    const m = this.slice.members.find((x) => x.id === crewId);
    if (!m || !this.ctx.world.isUnlocked(waterId)) return;
    m.waterId = waterId;
    this.ctx.bus.emit('crewAssigned', { crewId, waterId });
  }

  /** The club moved: helpers stay behind, and new ones are hired at the new water. */
  resetForMove(): void {
    this.slice.members.length = 0;
  }

  /** Live fishing: one real roll each time a helper's timer fills. */
  tick(dt: number): void {
    for (const m of this.slice.members) {
      const interval = this.intervalMs(m);
      m.progressMs += dt;
      while (m.progressMs >= interval) {
        m.progressMs -= interval;
        const made = makeCatch(this.ctx, { waterId: m.waterId, luck: this.luck(m), valueMult: this.valueMult(m) });
        if (!made) continue;
        const c = made.result;
        m.catches += 1;
        m.earned += c.value;
        this.ctx.wallet.add(c.currency, c.value);
        this.ctx.bus.emit('catchLanded', { catch: c, source: 'crew', crewId: m.id });
        this.ctx.bus.emit('fishSold', { fishId: c.fishId, value: c.value, currency: c.currency, source: 'crew' });
      }
    }
  }

  /** Offline: exact math over the gap, no loop over rolls. */
  catchUp(elapsedMs: number): OfflineReport | void {
    const members = this.slice.members;
    if (members.length === 0) {
      return { featureId: 'crew', title: 'Your crew', lines: ['The water was quiet.', 'Hire crew in Club upgrades to fish while you are away.'] };
    }
    const start = this.ctx.clock.now() - elapsedMs;
    const result = simulateOffline({
      startMs: start,
      elapsedMs,
      crew: members.map((m) => ({
        id: m.id,
        waterId: m.waterId,
        intervalMs: this.intervalMs(m),
        progressMs: m.progressMs,
        luck: this.luck(m),
        valueMult: this.type(m)?.valueMult ?? 1,
      })),
      time: TIME,
      weatherList: this.ctx.registries.weather.list(),
      weatherCfg: WEATHER,
      rarities: lootRarities(this.ctx),
      fish: lootFish(this.ctx),
      lootCfg: LOOT,
      valueMult: this.ctx.stats.get('sellValueMult') * this.ctx.stats.get('crewSellMult') * this.ctx.stats.get('offlineValueMult'),
    });
    const lines: string[] = [];
    for (const r of result.perCrew) {
      const m = members.find((x) => x.id === r.id)!;
      m.progressMs = r.progressMs;
      m.catches += r.rolls;
      m.earned += r.coins;
      const name = this.type(m)?.name ?? m.typeId;
      lines.push(`${name} caught ${formatNumber(r.rolls)} fish (+${formatNumber(r.coins)})`);
    }
    if (result.coins > 0) this.ctx.wallet.add(ECONOMY.defaultCurrency, result.coins);
    const entries = Object.entries(result.catches).map(([fishId, count]) => {
      const fish = this.ctx.registries.fish.get(fishId);
      return { fishId, count, size: rollSize(fish, this.ctx.rng) };
    });
    if (entries.length > 0) this.ctx.bus.emit('catchesBatched', { source: 'crew', entries, at: this.ctx.clock.now() });
    return {
      featureId: 'crew',
      title: 'Your crew',
      lines,
      earned: { [ECONOMY.defaultCurrency]: result.coins },
      catches: result.catches,
    };
  }
}

let active: CrewService | null = null;
export function setCrewService(s: CrewService): void {
  active = s;
}
export function getCrewService(): CrewService {
  if (!active) throw new Error('crew feature is not initialised');
  return active;
}
