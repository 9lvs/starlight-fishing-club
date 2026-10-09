// The contract every gameplay feature implements. Features are registered in
// src/features/index.ts only; the core never imports a feature directly.
import type Phaser from 'phaser';
import type { ZodType } from 'zod';
import type { GameContext } from './context';
import type { OfflineReport } from './types';

export interface MenuEntry {
  id: string;
  label: string;
  /** Sprite key of a 12x12 icon. */
  icon: string;
  /** Lower comes first in the menu bar. */
  order: number;
  /** Panel scene to open, or a custom action. */
  sceneKey?: string;
  action?: (ctx: GameContext) => void;
  /** Optional badge, e.g. a dot when something is affordable. */
  badge?: (ctx: GameContext) => boolean;
}

export interface SaveSliceDef<T = unknown> {
  key: string;
  version: number;
  defaults: () => T;
  /** Upgrade data saved by an older version of this slice. */
  migrate?: (old: unknown, fromVersion: number) => T;
}

export interface DebugCommandArg {
  name: string;
  type: 'number' | 'string' | 'select';
  default?: string | number;
  options?: string[];
}

export interface DebugCommand {
  id: string;
  label: string;
  args?: DebugCommandArg[];
  run: (ctx: GameContext, args: Record<string, string | number>) => string | void;
}

/** A layer scene sits between the world and the HUD and starts automatically. */
export interface FeatureScene {
  key: string;
  scene: new () => Phaser.Scene;
  /** 'layer' scenes start with the game; 'panel' scenes open on demand. */
  kind: 'layer' | 'panel';
}

export interface GameFeature {
  id: string;
  /** Extra content types this feature reads from src/content/<pack>/<type>.json. */
  contentTypes?: Record<string, ZodType>;
  init(ctx: GameContext): void;
  /** Runs after every feature has initialised and the save is loaded. */
  start?(ctx: GameContext): void;
  onTick?(dtMs: number, ctx: GameContext): void;
  onOfflineCatchUp?(elapsedMs: number, ctx: GameContext): OfflineReport | void;
  scenes?: FeatureScene[];
  menuEntries?: MenuEntry[];
  saveSlice?: SaveSliceDef;
  debugCommands?: DebugCommand[];
}
