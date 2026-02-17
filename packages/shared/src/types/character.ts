// === Character Data Types ===
// Structured to separate static (imported) data from dynamic (gameplay) data.

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CharacterClass {
  name: string;
  level: number;
  subclass?: string;
}

export interface CharacterSpell {
  name: string;
  level: number; // 0 = cantrip
  prepared: boolean;
}

export interface SpellSlotLevel {
  level: number; // 1-9
  total: number;
  used: number;
}

export interface InventoryItem {
  name: string;
  equipped: boolean;
  quantity: number;
  type?: string; // "weapon", "armor", "shield", "gear", etc.
  armorClass?: number; // for armor/shields
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface CharacterTraits {
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
}

export interface DeathSaves {
  successes: number;
  failures: number;
}

/**
 * Static data imported from D&D Beyond (or manual entry).
 * Only changes when the character is re-imported.
 */
export interface CharacterStaticData {
  name: string;
  race: string;
  classes: CharacterClass[];
  abilities: AbilityScores;
  maxHP: number;
  armorClass: number;
  proficiencyBonus: number;
  speed: number;
  features: string[];
  proficiencies: string[];
  spells: CharacterSpell[];
  traits: CharacterTraits;
  importedAt: number; // timestamp
  sourceUrl?: string; // DDB URL if imported from URL
  ddbId?: number; // DDB character ID
}

/**
 * Dynamic data owned by our system — changes during gameplay.
 * Preserved across re-imports; initialized from static data on first import.
 */
export interface CharacterDynamicData {
  currentHP: number;
  tempHP: number;
  spellSlotsUsed: SpellSlotLevel[];
  conditions: string[]; // "poisoned", "stunned", etc.
  deathSaves: DeathSaves;
  inventory: InventoryItem[];
  currency: Currency;
  xp: number;
}

/**
 * Complete character data — static + dynamic.
 */
export interface CharacterData {
  static: CharacterStaticData;
  dynamic: CharacterDynamicData;
}

/**
 * Minimal public info shown in party lists and popovers.
 */
export interface CharacterSummary {
  name: string;
  race: string;
  classes: CharacterClass[];
  totalLevel: number;
}

/**
 * Player info with online/offline tracking.
 */
export interface PlayerInfo {
  name: string;
  online: boolean;
  isHost: boolean;
}
