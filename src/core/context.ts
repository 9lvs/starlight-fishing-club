// GameContext is the one object every feature receives. It exposes services,
// never other features.
import type { Clock } from './clock';
import type { ParsedContent } from './content/parseContent';
import type {
  BranchDef,
  CrewDef,
  CurrencyDef,
  DecorationDef,
  FishDef,
  RarityDef,
  UpgradeDef,
  WaterDef,
  WeatherDef,
} from './content/schemas';
import type { EventBus } from './eventBus';
import type { GameEvents } from './events';
import type { DebugCommand, MenuEntry } from './feature';
import type { Registry } from './registry';
import type { Rng } from './rng';
import type { StatsService } from './stats';
import type { ToastRequest } from './types';
import type { WorldState } from './world';
import type { Wallet } from '../systems/economy';
import type { SaveManager } from '../systems/saveManager';

/** Named handler for effects data cannot express as stat modifiers. */
export interface EffectHandler {
  id: string;
  /** Called with the owned level whenever it changes (and on load). Level 0 means removed. */
  apply(ctx: GameContext, args: Record<string, unknown>, level: number): void;
  /** Short text for upgrade tooltips. */
  describe?(ctx: GameContext, args: Record<string, unknown>): string;
}

export interface Registries {
  fish: Registry<FishDef>;
  waters: Registry<WaterDef>;
  rarities: Registry<RarityDef>;
  currencies: Registry<CurrencyDef>;
  weather: Registry<WeatherDef>;
  branches: Registry<BranchDef>;
  upgrades: Registry<UpgradeDef>;
  crewTypes: Registry<CrewDef>;
  decorations: Registry<DecorationDef>;
  effects: Registry<EffectHandler>;
}

export interface UiApi {
  toast(text: string, opts?: Omit<ToastRequest, 'text'>): void;
  openPanel(sceneKey: string, data?: unknown): void;
}

export interface FeatureHostApi {
  ids(): string[];
  has(id: string): boolean;
  menuEntries(): MenuEntry[];
  debugCommands(): DebugCommand[];
}

export interface GameContext {
  bus: EventBus<GameEvents>;
  stats: StatsService;
  registries: Registries;
  content: ParsedContent;
  wallet: Wallet;
  save: SaveManager;
  clock: Clock;
  rng: Rng;
  world: WorldState;
  ui: UiApi;
  features: FeatureHostApi;
  /** True with ?debug=1 or in dev builds. */
  debug: boolean;
  /** Runtime flags from the URL and settings, e.g. reducedMotion. */
  flags: Record<string, boolean>;
}

let active: GameContext | null = null;

/** Scenes get the context here; features receive it as an argument instead. */
export function getContext(): GameContext {
  if (!active) throw new Error('game context is not ready');
  return active;
}

export function setContext(ctx: GameContext): void {
  active = ctx;
}
