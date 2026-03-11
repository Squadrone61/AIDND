import type { CharacterData } from "@aidnd/shared/types";

export interface SavedCharacter {
  id: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  campaignSlug?: string;
  roomCode?: string;
  character: CharacterData;
}
