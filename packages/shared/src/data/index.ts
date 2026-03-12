// D&D 2024 Database — Single Source of Truth
// Type-safe exports + lookup helpers

import type {
  ClassData,
  ClassFeatureData,
  FeatData,
  SpellData,
  SpeciesData,
  BackgroundData,
  ConditionData,
  WeaponData,
  ArmorData,
  GearData,
  ToolData,
  EquipmentDatabase,
  MagicItemData,
  MonsterData,
} from "./types";

import classesData from "./classes.json";
import featsData from "./feats.json";
import spellsData from "./spells.json";
import speciesData from "./species.json";
import backgroundsData from "./backgrounds.json";
import conditionsData from "./conditions.json";
import equipmentData from "./equipment.json";
import magicItemsData from "./magic-items.json";
import monstersData from "./monsters.json";

// ─── Case-insensitive lookup maps ───────────────────────

function buildMap<T extends { name: string }>(data: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of data) {
    map.set(item.name.toLowerCase(), item);
  }
  return map;
}

export const classes = buildMap(classesData as unknown as ClassData[]);
export const feats = buildMap(featsData as unknown as FeatData[]);
export const spells = buildMap(spellsData as unknown as SpellData[]);
export const species = buildMap(speciesData as unknown as SpeciesData[]);
export const backgrounds = buildMap(backgroundsData as unknown as BackgroundData[]);
export const conditions = buildMap(conditionsData as unknown as ConditionData[]);
export const weapons = buildMap((equipmentData as unknown as EquipmentDatabase).weapons);
export const armor = buildMap((equipmentData as unknown as EquipmentDatabase).armor);
export const gear = buildMap((equipmentData as unknown as EquipmentDatabase).gear);
export const tools = buildMap((equipmentData as unknown as EquipmentDatabase).tools);
export const magicItems = buildMap(magicItemsData as unknown as MagicItemData[]);
export const monsters = buildMap(monstersData as unknown as MonsterData[]);

// ─── Raw arrays (for iteration/filtering) ───────────────

export const classesArray = classesData as unknown as ClassData[];
export const featsArray = featsData as unknown as FeatData[];
export const spellsArray = spellsData as unknown as SpellData[];
export const speciesArray = speciesData as unknown as SpeciesData[];
export const backgroundsArray = backgroundsData as unknown as BackgroundData[];
export const conditionsArray = conditionsData as unknown as ConditionData[];
export const equipmentDb = equipmentData as unknown as EquipmentDatabase;
export const magicItemsArray = magicItemsData as unknown as MagicItemData[];
export const monstersArray = monstersData as unknown as MonsterData[];

// ─── Convenience functions ──────────────────────────────

export function getClass(name: string): ClassData | undefined {
  return classes.get(name.toLowerCase());
}

export function getFeat(name: string): FeatData | undefined {
  return feats.get(name.toLowerCase());
}

export function getSpell(name: string): SpellData | undefined {
  return spells.get(name.toLowerCase());
}

export function getSpecies(name: string): SpeciesData | undefined {
  return species.get(name.toLowerCase());
}

export function getBackground(name: string): BackgroundData | undefined {
  return backgrounds.get(name.toLowerCase());
}

export function getCondition(name: string): ConditionData | undefined {
  return conditions.get(name.toLowerCase());
}

export function getWeapon(name: string): WeaponData | undefined {
  return weapons.get(name.toLowerCase());
}

export function getArmor(name: string): ArmorData | undefined {
  return armor.get(name.toLowerCase());
}

export function getGear(name: string): GearData | undefined {
  return gear.get(name.toLowerCase());
}

export function getTool(name: string): ToolData | undefined {
  return tools.get(name.toLowerCase());
}

export function getMagicItem(name: string): MagicItemData | undefined {
  return magicItems.get(name.toLowerCase());
}

export function getMonster(name: string): MonsterData | undefined {
  return monsters.get(name.toLowerCase());
}

// ─── Filtered queries ───────────────────────────────────

export function getSpellsByClass(className: string): SpellData[] {
  const lower = className.toLowerCase();
  return spellsArray.filter((s) =>
    s.classes.some((c) => c.toLowerCase() === lower)
  );
}

export function getSpellsByLevel(level: number): SpellData[] {
  return spellsArray.filter((s) => s.level === level);
}

export function getClassSpellSlots(
  className: string,
  characterLevel: number
): number[] {
  const cls = getClass(className);
  if (!cls) return [];

  if (cls.casterType === "pact" && cls.pactSlotTable) {
    const entry = cls.pactSlotTable.find((e) => e.level === characterLevel);
    if (!entry) return [];
    // Return as array where index = slot level - 1
    const slots = new Array(9).fill(0);
    slots[entry.slotLevel - 1] = entry.slots;
    return slots;
  }

  if (cls.spellSlotTable && characterLevel >= 1 && characterLevel <= 20) {
    return cls.spellSlotTable[characterLevel - 1];
  }

  return [];
}

export function getClassFeatures(
  className: string,
  upToLevel: number
): ClassFeatureData[] {
  const cls = getClass(className);
  if (!cls) return [];
  return cls.features.filter((f) => f.level <= upToLevel);
}

// ─── Third-Caster Spell Slot Table ───────────────────────
// Eldritch Knight, Arcane Trickster — subclasses not in class spellSlotTable
export const THIRD_CASTER_SLOTS: Record<number, number[]> = {
  1: [], 2: [], 3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2],
  9: [4, 2], 10: [4, 3], 11: [4, 3], 12: [4, 3], 13: [4, 3, 2], 14: [4, 3, 2],
  15: [4, 3, 2], 16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3], 19: [4, 3, 3, 1],
  20: [4, 3, 3, 1],
};

/** Get the caster level multiplier for a class (for multiclass spell slot computation). */
export function getCasterMultiplier(className: string): number {
  const cls = getClass(className);
  if (!cls) return 0;
  switch (cls.casterType) {
    case "full": return 1;
    case "half": return 0.5;
    case "third": return 1 / 3;
    case "pact": return 0; // Warlock uses pact magic, handled separately
    default: return 0;
  }
}

// ─── Weapon Property Decoder ────────────────────────────

const PROPERTY_CODES: Record<string, string> = {
  "2H": "Two-Handed",
  A: "Ammunition",
  AF: "Automatic Fire",
  BF: "Burst Fire",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  R: "Reach",
  RLD: "Reload",
  T: "Thrown",
  V: "Versatile",
};

/** Decode a weapon property code like "F|XPHB" → "Finesse" */
export function formatWeaponProperty(raw: string | { uid: string; note?: string }): string {
  const str = typeof raw === "string" ? raw : raw.uid;
  const code = str.split("|")[0];
  const label = PROPERTY_CODES[code] ?? code;
  if (typeof raw !== "string" && raw.note) return `${label} (${raw.note})`;
  return label;
}

// ─── Search helpers ─────────────────────────────────────

export function searchSpells(query: string): SpellData[] {
  const lower = query.toLowerCase();
  return spellsArray.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.school.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
  );
}

export function searchMonsters(query: string): MonsterData[] {
  const lower = query.toLowerCase();
  return monstersArray.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.type.toLowerCase().includes(lower)
  );
}

export function searchMagicItems(query: string): MagicItemData[] {
  const lower = query.toLowerCase();
  return magicItemsArray.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.type.toLowerCase().includes(lower) ||
      s.rarity.toLowerCase().includes(lower)
  );
}

export function searchFeats(query: string): FeatData[] {
  const lower = query.toLowerCase();
  return featsArray.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.category.toLowerCase().includes(lower)
  );
}

// Re-export types
export type {
  ClassData,
  ClassFeatureData,
  SubclassData,
  ClassResourceTemplate,
  FeatData,
  SpellData,
  SpeciesData,
  SpeciesTraitData,
  BackgroundData,
  ConditionData,
  WeaponData,
  ArmorData,
  GearData,
  ToolData,
  EquipmentDatabase,
  MagicItemData,
  MonsterData,
} from "./types";
