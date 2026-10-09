// Every named stat and its base value. Upgrades, bait, decorations, and features
// change these only through modifiers (see src/core/stats.ts).
import type { StatDef } from '../core/stats';
import { FISHING } from './tuning';

export const CORE_STATS: StatDef[] = [
  { id: 'biteWindowMs', base: 1200, min: 400, max: 4000, label: 'Bite window', format: 'ms' },
  { id: 'castSpeed', base: 1, min: 0.25, max: 4, label: 'Cast speed', format: 'mult' },
  { id: 'waitMinMs', base: FISHING.waitMinMs, min: 500, label: 'Shortest wait', format: 'ms' },
  { id: 'waitMaxMs', base: FISHING.waitMaxMs, min: 1000, label: 'Longest wait', format: 'ms' },
  { id: 'luck', base: 0, min: 0, label: 'Luck', format: 'int' },
  { id: 'sellValueMult', base: 1, min: 0, label: 'Sell value', format: 'mult' },
  { id: 'storageCap', base: 6, min: 1, integer: true, label: 'Creel space', format: 'int' },
  { id: 'boatRange', base: 0, min: 0, integer: true, label: 'Boat range', format: 'int' },
  { id: 'crewSlots', base: 0, min: 0, integer: true, label: 'Crew slots', format: 'int' },
  { id: 'crewIntervalMs', base: 12000, min: 2000, label: 'Crew catch time', format: 'ms' },
  { id: 'crewSellMult', base: 0.5, min: 0, max: 1, label: 'Crew sell value', format: 'mult' },
  { id: 'crewLuck', base: 0, min: 0, label: 'Crew luck', format: 'int' },
  { id: 'offlineCapHours', base: 8, min: 0, max: 24, label: 'Offline cap', format: 'hours' },
];
