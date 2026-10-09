// Crew save slice.
import type { SaveSliceDef } from '../../core/feature';

export interface CrewMember {
  id: string;
  typeId: string;
  waterId: string;
  progressMs: number;
  catches: number;
  earned: number;
}

export interface CrewSlice {
  members: CrewMember[];
  nextId: number;
}

export const crewSlice: SaveSliceDef<CrewSlice> = {
  key: 'crew',
  version: 1,
  defaults: () => ({ members: [], nextId: 1 }),
};
