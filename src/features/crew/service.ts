// Crew: hired helpers each fish one water on a timer. While you play, their
// catches sell automatically at the crewSellMult share of value, so hand fishing
// (with pity and full value) stays worthwhile. While you are away they only fill
// the creel, so a bigger creel and checking in often both pay.
import { LOOT } from '../../config/balance';
import { ECONOMY } from '../../config/balance';
import { TIME, WEATHER } from '../../config/time';
import { lootFish, lootRarities, makeCatch, rollSize } from '../../core/catching';
import type { GameContext } from '../../core/context';
import type { CrewDef } from '../../core/content/schemas';
import type { OfflineReport } from '../../core/types';
import { simulateOffline } from '../../systems/offlineSim';
import { formatDuration, formatNumber } from '../../ui/format';
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
    // You need a crew contract (Hire Help) and a bunk on your boat for each helper.
    return Math.min(this.ctx.stats.get('crewSlots'), this.ctx.stats.get('crewBunks'));
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

  /** Offline: exact math over the gap, no loop over rolls. Catches go to the creel until it is full. */
  catchUp(elapsedMs: number): OfflineReport | void {
    const members = this.slice.members;
    if (members.length === 0) {
      return { featureId: 'crew', title: 'Your crew', lines: ['The water was quiet.', 'Hire crew in Crew upgrades to fish while you are away.'] };
    }
    const room = { room: 0 };
    this.ctx.bus.emit('creelRoom', room);
    if (room.room <= 0) {
      return { featureId: 'crew', title: 'Your crew', lines: ['Your creel was already full, so your crew rested.', 'Sell your catch and they will fish again.'] };
    }
    const start = this.ctx.clock.now() - elapsedMs;
    let result = this.simulate(start, elapsedMs);
    let filledAfter: number | null = null;
    if (result.rolls > room.room) {
      // The crew fish at a steady pace, so the creel filled about this far in.
      filledAfter = Math.max(1, Math.floor((elapsedMs * room.room) / result.rolls));
      result = this.simulate(start, filledAfter);
    }
    // Rarest first, so if rounding leaves one too many, a common one is dropped.
    const r = this.ctx.registries;
    const tier = (id: string) => r.rarities.tryGet(r.fish.tryGet(id)?.rarity ?? '')?.tier ?? 0;
    const items = Object.entries(result.catches)
      .sort((a, b) => tier(b[0]) - tier(a[0]))
      .flatMap(([fishId, n]) => Array.from({ length: n }, () => ({ fishId, size: rollSize(r.fish.get(fishId), this.ctx.rng), at: this.ctx.clock.now(), crew: true })));
    const deposit = { items: items.slice(0, room.room), accepted: 0 };
    this.ctx.bus.emit('creelDeposit', deposit);
    const kept = deposit.items.slice(0, deposit.accepted);

    const lines: string[] = [];
    for (const res of result.perCrew) {
      const m = members.find((x) => x.id === res.id)!;
      m.progressMs = filledAfter === null ? res.progressMs : 0;
      m.catches += res.rolls;
      lines.push(`${this.type(m)?.name ?? m.typeId} caught ${formatNumber(res.rolls)} fish`);
    }
    if (filledAfter !== null) lines.push(`Your creel filled up after ${formatDuration(filledAfter)}. A bigger boat holds more.`);
    if (kept.length > 0) lines.push('They are fresh now. Sell them soon for the best price.');

    const counts: Record<string, number> = {};
    for (const k of kept) counts[k.fishId] = (counts[k.fishId] ?? 0) + 1;
    const entries = kept.map((k) => ({ fishId: k.fishId, count: 1, size: k.size }));
    if (entries.length > 0) this.ctx.bus.emit('catchesBatched', { source: 'crew', entries, at: this.ctx.clock.now() });
    return { featureId: 'crew', title: 'Your crew', lines, catches: counts, kept: kept.length };
  }

  private simulate(startMs: number, elapsedMs: number) {
    return simulateOffline({
      startMs,
      elapsedMs,
      crew: this.slice.members.map((m) => ({
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
      valueMult: 1,
    });
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
