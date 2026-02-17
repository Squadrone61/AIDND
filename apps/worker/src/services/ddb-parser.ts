/**
 * D&D Beyond character JSON parser.
 * Normalizes the DDB v5 API response into our CharacterData format.
 *
 * DDB stores data in a complex nested structure with modifiers, stats arrays,
 * and override systems. This parser handles the merge logic.
 */

import type {
  CharacterData,
  CharacterStaticData,
  CharacterDynamicData,
  CharacterClass,
  CharacterSpell,
  SpellSlotLevel,
  InventoryItem,
  AbilityScores,
  Currency,
  CharacterTraits,
} from "@aidnd/shared/types";

// DDB stat IDs map to ability scores
const STAT_ID_MAP: Record<number, keyof AbilityScores> = {
  1: "strength",
  2: "dexterity",
  3: "constitution",
  4: "intelligence",
  5: "wisdom",
  6: "charisma",
};

// DDB armor type IDs
const ARMOR_TYPES: Record<number, string> = {
  1: "light",
  2: "medium",
  3: "heavy",
  4: "shield",
};

interface DDBModifier {
  type: string;
  subType?: string;
  value?: number | null;
  statId?: number | null;
  modifierTypeId?: number;
  modifierSubTypeId?: number;
  friendlyTypeName?: string;
  friendlySubtypeName?: string;
  componentId?: number;
  componentTypeId?: number;
}

interface DDBClassInfo {
  definition: {
    name: string;
    [key: string]: unknown;
  };
  level: number;
  subclassDefinition?: {
    name: string;
    [key: string]: unknown;
  } | null;
  isStartingClass?: boolean;
}

/**
 * Parse raw DDB v5 JSON into our CharacterData format.
 * Accepts either the full API response (with .data wrapper) or the character object directly.
 */
export function parseDDBCharacter(raw: unknown): {
  character: CharacterData;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Handle both { data: { ... } } wrapper and direct character object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let char: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawObj = raw as any;

  if (rawObj?.data?.name) {
    char = rawObj.data;
  } else if (rawObj?.name && rawObj?.race) {
    char = rawObj;
  } else {
    throw new Error(
      "Invalid D&D Beyond character JSON. Expected an object with character data."
    );
  }

  // === Basic Info ===
  const name: string = char.name || "Unknown Character";
  const race: string =
    char.race?.fullName ||
    char.race?.baseName ||
    char.race?.baseRaceName ||
    "Unknown Race";

  // === Classes ===
  const classes: CharacterClass[] = (char.classes || []).map(
    (c: DDBClassInfo) => ({
      name: c.definition?.name || "Unknown",
      level: c.level || 1,
      subclass: c.subclassDefinition?.name || undefined,
    })
  );
  if (classes.length === 0) {
    classes.push({ name: "Unknown", level: 1 });
    warnings.push("No class data found");
  }

  // === Ability Scores ===
  const abilities = computeAbilityScores(char, warnings);

  // === Modifiers (for HP, AC, etc.) ===
  const allModifiers = gatherModifiers(char);

  // === HP ===
  const { maxHP, currentHP, tempHP } = computeHP(char, abilities, allModifiers, warnings);

  // === AC ===
  const armorClass = computeArmorClass(char, abilities, allModifiers, warnings);

  // === Speed ===
  const speed = computeSpeed(char);

  // === Proficiency Bonus ===
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0);
  const proficiencyBonus = Math.ceil(totalLevel / 4) + 1;

  // === Features ===
  const features = extractFeatures(char);

  // === Proficiencies ===
  const proficiencies = extractProficiencies(allModifiers);

  // === Spells ===
  const spells = extractSpells(char);

  // === Spell Slots ===
  const spellSlots = extractSpellSlots(char);

  // === Inventory ===
  const inventory = extractInventory(char);

  // === Currency ===
  const currency = extractCurrency(char);

  // === Traits ===
  const traits = extractTraits(char);

  // === XP ===
  const xp: number = char.currentXp || 0;

  const staticData: CharacterStaticData = {
    name,
    race,
    classes,
    abilities,
    maxHP,
    armorClass,
    proficiencyBonus,
    speed,
    features,
    proficiencies,
    spells,
    traits,
    importedAt: Date.now(),
    ddbId: char.id || undefined,
  };

  const dynamicData: CharacterDynamicData = {
    currentHP,
    tempHP,
    spellSlotsUsed: spellSlots,
    conditions: [],
    deathSaves: {
      successes: char.deathSaves?.successCount ?? 0,
      failures: char.deathSaves?.failCount ?? 0,
    },
    inventory,
    currency,
    xp,
  };

  return {
    character: { static: staticData, dynamic: dynamicData },
    warnings,
  };
}

// === Internal Helpers ===

function computeAbilityScores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  char: any,
  warnings: string[]
): AbilityScores {
  const abilities: AbilityScores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };

  // Base stats from stats array
  const stats: Array<{ id: number; value: number | null }> = char.stats || [];
  for (const stat of stats) {
    const key = STAT_ID_MAP[stat.id];
    if (key && stat.value !== null && stat.value !== undefined) {
      abilities[key] = stat.value;
    }
  }

  // Bonus stats (added to base)
  const bonusStats: Array<{ id: number; value: number | null }> =
    char.bonusStats || [];
  for (const stat of bonusStats) {
    const key = STAT_ID_MAP[stat.id];
    if (key && stat.value !== null && stat.value !== undefined) {
      abilities[key] += stat.value;
    }
  }

  // Override stats (replace entirely if set)
  const overrideStats: Array<{ id: number; value: number | null }> =
    char.overrideStats || [];
  for (const stat of overrideStats) {
    const key = STAT_ID_MAP[stat.id];
    if (key && stat.value !== null && stat.value !== undefined) {
      abilities[key] = stat.value;
    }
  }

  // Apply modifiers that grant ability score bonuses
  const allModifiers = gatherModifiers(char);
  for (const mod of allModifiers) {
    if (mod.type === "bonus" && mod.statId && mod.value) {
      const key = STAT_ID_MAP[mod.statId];
      if (key) {
        abilities[key] += mod.value;
      }
    }
  }

  // Validate
  for (const [key, val] of Object.entries(abilities)) {
    if (val < 1 || val > 30) {
      warnings.push(`${key} score ${val} is unusual (expected 1-30)`);
    }
  }

  return abilities;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gatherModifiers(char: any): DDBModifier[] {
  const modifiers: DDBModifier[] = [];
  const modMap = char.modifiers || {};

  for (const category of Object.values(modMap)) {
    if (Array.isArray(category)) {
      for (const mod of category) {
        modifiers.push(mod as DDBModifier);
      }
    }
  }

  return modifiers;
}

function computeHP(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  char: any,
  abilities: AbilityScores,
  modifiers: DDBModifier[],
  warnings: string[]
): { maxHP: number; currentHP: number; tempHP: number } {
  // DDB provides baseHitPoints, bonusHitPoints, overrideHitPoints
  let maxHP: number = char.overrideHitPoints ?? char.baseHitPoints ?? 10;

  // Add CON modifier × level
  const conMod = Math.floor((abilities.constitution - 10) / 2);
  const totalLevel = (char.classes || []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, c: any) => sum + (c.level || 1),
    0
  );
  if (!char.overrideHitPoints) {
    maxHP += conMod * totalLevel;
  }

  // Bonus HP
  if (char.bonusHitPoints) {
    maxHP += char.bonusHitPoints;
  }

  // HP modifiers (e.g., Tough feat, items)
  for (const mod of modifiers) {
    if (
      mod.type === "bonus" &&
      mod.subType === "hit-points-per-level" &&
      mod.value
    ) {
      maxHP += mod.value * totalLevel;
    }
  }

  maxHP = Math.max(1, maxHP);

  // Current HP
  const removedHP: number = char.removedHitPoints || 0;
  const currentHP = Math.max(0, maxHP - removedHP);
  const tempHP: number = char.temporaryHitPoints || 0;

  if (maxHP <= 0) {
    warnings.push("Computed max HP is 0 or negative, defaulting to 1");
    return { maxHP: 1, currentHP: 1, tempHP };
  }

  return { maxHP, currentHP, tempHP };
}

function computeArmorClass(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  char: any,
  abilities: AbilityScores,
  modifiers: DDBModifier[],
  warnings: string[]
): number {
  // If DDB provides an override, use it
  if (char.overrideArmorClass) {
    return char.overrideArmorClass;
  }

  const dexMod = Math.floor((abilities.dexterity - 10) / 2);
  let baseAC = 10 + dexMod; // Unarmored base

  // Check equipped armor
  const items: Array<{
    equipped: boolean;
    definition: {
      armorClass?: number;
      armorTypeId?: number;
      type?: string;
      filterType?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }> = (char.inventory || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) =>
      i.equipped &&
      i.definition?.filterType === "Armor"
  );

  let hasArmor = false;
  let shieldBonus = 0;

  for (const item of items) {
    const armorTypeId = item.definition.armorTypeId;
    const armorType = armorTypeId ? ARMOR_TYPES[armorTypeId] : undefined;
    const ac = item.definition.armorClass || 0;

    if (armorType === "shield") {
      shieldBonus = ac;
    } else if (armorType === "light") {
      baseAC = ac + dexMod;
      hasArmor = true;
    } else if (armorType === "medium") {
      baseAC = ac + Math.min(dexMod, 2);
      hasArmor = true;
    } else if (armorType === "heavy") {
      baseAC = ac;
      hasArmor = true;
    }
  }

  let totalAC = baseAC + shieldBonus;

  // Add AC bonuses from modifiers (magic items, etc.)
  for (const mod of modifiers) {
    if (mod.type === "bonus" && mod.subType === "armor-class" && mod.value) {
      totalAC += mod.value;
    }
  }

  if (!hasArmor && totalAC < 10) {
    warnings.push("Computed AC is unusually low, check armor data");
  }

  return totalAC;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeSpeed(char: any): number {
  // DDB stores speed in weightSpeeds or the race
  const walkSpeed =
    char.race?.weightSpeeds?.normal?.walk ??
    char.walkSpeed ??
    30;

  return walkSpeed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFeatures(char: any): string[] {
  const features: string[] = [];

  // Class features
  for (const cls of char.classes || []) {
    for (const feature of cls.classFeatures || []) {
      if (feature.definition?.name) {
        features.push(feature.definition.name);
      }
    }
  }

  // Race features
  for (const trait of char.race?.racialTraits || []) {
    if (trait.definition?.name) {
      features.push(trait.definition.name);
    }
  }

  // Feats
  for (const feat of char.feats || []) {
    if (feat.definition?.name) {
      features.push(feat.definition.name);
    }
  }

  return [...new Set(features)]; // Deduplicate
}

function extractProficiencies(modifiers: DDBModifier[]): string[] {
  const proficiencies: string[] = [];

  for (const mod of modifiers) {
    if (mod.type === "proficiency" && mod.friendlySubtypeName) {
      proficiencies.push(mod.friendlySubtypeName);
    }
  }

  return [...new Set(proficiencies)];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSpells(char: any): CharacterSpell[] {
  const spells: CharacterSpell[] = [];
  const seen = new Set<string>();

  // Class spells
  for (const classSpells of char.classSpells || []) {
    for (const spell of classSpells.spells || []) {
      const def = spell.definition;
      if (!def?.name) continue;
      if (seen.has(def.name)) continue;
      seen.add(def.name);

      spells.push({
        name: def.name,
        level: def.level ?? 0,
        prepared:
          spell.prepared || spell.alwaysPrepared || def.level === 0 || false,
      });
    }
  }

  // Race spells
  for (const spell of char.spells?.race || []) {
    const def = spell.definition;
    if (!def?.name || seen.has(def.name)) continue;
    seen.add(def.name);

    spells.push({
      name: def.name,
      level: def.level ?? 0,
      prepared: true,
    });
  }

  return spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSpellSlots(char: any): SpellSlotLevel[] {
  const slots: SpellSlotLevel[] = [];

  // DDB stores spell slots in spellSlots array [{level, max, used}]
  // or in pactMagic for warlocks
  const spellSlots: Array<{
    level: number;
    max?: number;
    used?: number;
    available?: number;
  }> = char.spellSlots || [];

  for (const slot of spellSlots) {
    if (slot.level >= 1 && slot.level <= 9 && slot.max && slot.max > 0) {
      slots.push({
        level: slot.level,
        total: slot.max,
        used: slot.used || 0,
      });
    }
  }

  // Pact magic slots (warlocks)
  const pactMagic = char.pactMagic;
  if (pactMagic) {
    for (const slot of pactMagic || []) {
      if (slot.level >= 1 && slot.max && slot.max > 0) {
        // Merge with existing or add
        const existing = slots.find((s) => s.level === slot.level);
        if (existing) {
          existing.total += slot.max;
          existing.used += slot.used || 0;
        } else {
          slots.push({
            level: slot.level,
            total: slot.max,
            used: slot.used || 0,
          });
        }
      }
    }
  }

  return slots.sort((a, b) => a.level - b.level);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInventory(char: any): InventoryItem[] {
  const items: InventoryItem[] = [];

  for (const item of char.inventory || []) {
    const def = item.definition;
    if (!def?.name) continue;

    items.push({
      name: def.name,
      equipped: item.equipped || false,
      quantity: item.quantity || 1,
      type: def.filterType || def.type || undefined,
      armorClass: def.armorClass || undefined,
    });
  }

  return items;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCurrency(char: any): Currency {
  const currencies = char.currencies || {};
  return {
    cp: currencies.cp || 0,
    sp: currencies.sp || 0,
    ep: currencies.ep || 0,
    gp: currencies.gp || 0,
    pp: currencies.pp || 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTraits(char: any): CharacterTraits {
  const t = char.traits || {};
  return {
    personalityTraits: t.personalityTraits || undefined,
    ideals: t.ideals || undefined,
    bonds: t.bonds || undefined,
    flaws: t.flaws || undefined,
  };
}
