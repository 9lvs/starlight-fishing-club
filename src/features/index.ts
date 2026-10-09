// THE feature registry. This is the only file that lists features. Removing a
// line here removes that feature cleanly; the core never imports a feature.
import type { GameFeature } from '../core/feature';
import { fishingFeature } from './fishing';
import { journalFeature } from './journal';
import { mapFeature } from './map';
import { upgradesFeature } from './upgrades';

export const FEATURES: GameFeature[] = [fishingFeature, upgradesFeature, journalFeature, mapFeature];
