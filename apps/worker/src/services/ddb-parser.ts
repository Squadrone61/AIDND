/**
 * D&D Beyond character JSON parser.
 * Normalizes the DDB v5 API response into our CharacterData format.
 *
 * Computation logic based on ddb2alchemy (MIT license) by Alchemy RPG:
 * https://github.com/alchemyrpg/ddb2alchemy
 *
 * Extraction logic lives here (DDB's modifier system is parser-specific).
 * D&D mechanics computation is delegated to the shared character builder.
 */

import type {
  CharacterData,
  CharacterClass,
  CharacterSpell,
  CharacterFeature,
  AdvantageEntry,
  SpellSlotLevel,
  InventoryItem,
  AbilityScores,
  Currency,
  CharacterTraits,
  CharacterAppearance,
} from "@aidnd/shared/types";
import { buildCharacter } from "@aidnd/shared/builders";
import type { CharacterIdentifiers } from "@aidnd/shared/builders";


// DDB stat IDs → ability score keys
const STAT_ID_MAP: Record<number, keyof AbilityScores> = {
  1: "strength",
  2: "dexterity",
  3: "constitution",
  4: "intelligence",
  5: "wisdom",
  6: "charisma",
};

// Ability score → modifier (scores 1–30). From ddb2alchemy.
const STAT_BONUS: Record<number, number> = {
  1: -5, 2: -4, 3: -4, 4: -3, 5: -3, 6: -2, 7: -2, 8: -1, 9: -1, 10: 0,
  11: 0, 12: 1, 13: 1, 14: 2, 15: 2, 16: 3, 17: 3, 18: 4, 19: 4, 20: 5,
  21: 5, 22: 6, 23: 6, 24: 7, 25: 7, 26: 8, 27: 8, 28: 9, 29: 9, 30: 10,
};

function getAbilityMod(score: number): number {
  return STAT_BONUS[Math.min(30, Math.max(1, score))] ?? Math.floor((score - 10) / 2);
}

// All 18 D&D 5e skills → governing ability
const SKILL_ABILITY_MAP: Record<string, keyof AbilityScores> = {
  athletics: "strength",
  acrobatics: "dexterity",
  "sleight-of-hand": "dexterity",
  stealth: "dexterity",
  arcana: "intelligence",
  history: "intelligence",
  investigation: "intelligence",
  nature: "intelligence",
  religion: "intelligence",
  "animal-handling": "wisdom",
  insight: "wisdom",
  medicine: "wisdom",
  perception: "wisdom",
  survival: "wisdom",
  deception: "charisma",
  intimidation: "charisma",
  performance: "charisma",
  persuasion: "charisma",
};

// Saving throw subType patterns
const SAVE_SUBTYPE_MAP: Record<string, keyof AbilityScores> = {
  "strength-saving-throws": "strength",
  "dexterity-saving-throws": "dexterity",
  "constitution-saving-throws": "constitution",
  "intelligence-saving-throws": "intelligence",
  "wisdom-saving-throws": "wisdom",
  "charisma-saving-throws": "charisma",
};

// DDB armor type IDs
const ARMOR_TYPE_LIGHT = 1;
const ARMOR_TYPE_MEDIUM = 2;
const ARMOR_TYPE_HEAVY = 3;
const ARMOR_TYPE_SHIELD = 4;

// DDB proficiency entityTypeId constants (from ddb2alchemy)
const PROF_ENTITY_ARMOR = 174869515;
const PROF_ENTITY_WEAPON = 1782728300;
const PROF_ENTITY_TOOL = 2103445194;

// Known/spontaneous casters: all learned spells are always available (no daily preparation).
const KNOWN_CASTER_CLASSES = new Set([
  "bard", "sorcerer", "ranger", "warlock",
]);

// DDB limitedUse resetType IDs → rest type
const DDB_RESET_TYPES: Record<number, "short" | "long" | null> = {
  1: "long",
  2: "short",
  3: "long",
  4: "long",
  5: "long",
  6: null,
};

// DDB activation type IDs → human-readable
const ACTIVATION_TYPES: Record<number, string> = {
  1: "1 action",
  3: "1 bonus action",
  4: "1 reaction",
  6: "1 minute",
  7: "10 minutes",
  8: "1 hour",
  9: "8 hours",
  10: "24 hours",
};

// DDB duration type mapping
const DURATION_TYPES: Record<string, string> = {
  Instantaneous: "Instantaneous",
  Round: "round",
  Minute: "minute",
  Hour: "hour",
  Day: "day",
  Concentration: "Concentration",
  "Until Dispelled": "Until Dispelled",
  Special: "Special",
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
  restriction?: string;
  componentId?: number;
  componentTypeId?: number;
  entityTypeId?: number;
}

interface DDBClassInfo {
  definition: {
    name: string;
    spellCastingAbilityId?: number | null;
    canCastSpells?: boolean;
    spellRules?: {
      multiClassSpellSlotDivisor?: number;
      levelSpellSlots?: number[][];
      [key: string]: unknown;
    };
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
 * Filter all character modifiers by matching criteria.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModifiers(char: any, criteria: Record<string, unknown>): DDBModifier[] {
  const modMap = char.modifiers || {};
  return (Object.values(modMap) as unknown[][])
    .flat()
    .filter((mod) => {
      const m = mod as Record<string, unknown>;
      return Object.entries(criteria).every(([key, val]) => m[key] === val);
    }) as DDBModifier[];
}

/**
 * Sum values of all modifiers matching criteria.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumModifiers(char: any, criteria: Record<string, unknown>): number {
  return getModifiers(char, criteria).reduce(
    (sum, m) => sum + (m.value || 0),
    0
  );
}

/**
 * Get the highest value among matching modifiers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maxModifier(char: any, criteria: Record<string, unknown>): number {
  return getModifiers(char, criteria).reduce(
    (max, m) => Math.max(max, m.value || 0),
    0
  );
}

/**
 * Gather all modifiers into a flat array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gatherModifiers(char: any): DDBModifier[] {
  const modMap = char.modifiers || {};
  return (Object.values(modMap) as unknown[][]).flat() as DDBModifier[];
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

  // === Proficiency Bonus ===
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0);
  const proficiencyBonus = Math.ceil(totalLevel / 4) + 1;

  // === HP ===
  const { maxHP, currentHP, tempHP } = computeHP(char, abilities);

  // === AC ===
  const armorClass = computeArmorClass(char, abilities);

  // === Speed ===
  const speed = computeSpeed(char);

  // === Skills (extract proficiencies, expertise, bonuses) ===
  const { skillProficiencies, skillExpertise, skillBonuses } = extractSkillIdentifiers(char, proficiencyBonus);

  // === Saving Throws ===
  const { saveProficiencies, saveBonuses } = extractSaveIdentifiers(char);

  // === Features ===
  const features = extractFeatures(char, classes);

  // === Actions ===
  const actionFeatures = extractActions(char);
  const featureNames = new Set(features.map((f) => f.name));
  for (const af of actionFeatures) {
    if (!featureNames.has(af.name)) {
      featureNames.add(af.name);
      features.push(af);
    }
  }

  // === Class Resources ===
  // DDB class resources are extracted from the source data directly,
  // not computed from the DB, because DDB has precise runtime values
  const classResources = extractClassResources(char, abilities);

  // === Proficiencies ===
  const proficiencies = extractProficiencies(char);

  // === Languages ===
  const languages = extractLanguages(gatherModifiers(char));

  // === Senses ===
  const senses = extractSenses(char, abilities, proficiencyBonus,
    // Compute skills inline for senses (need proficiency data)
    extractSkillsForSenses(char, proficiencyBonus));

  // === Spells ===
  const spells = extractSpells(char);

  // === Spell Slots (DDB-specific: uses DDB's own slot tables) ===
  const { regularSlots, pactSlots } = extractSpellSlots(char);

  // === Inventory ===
  const inventory = extractInventory(char, abilities, proficiencyBonus);

  // === Currency ===
  const currency = extractCurrency(char);

  // === Advantages / Disadvantages ===
  const advantages = extractAdvantages(char);

  // === Traits ===
  const traits = extractTraits(char);

  // === Appearance ===
  const appearance = extractAppearance(char);

  // === XP ===
  const xp: number = char.currentXp || 0;

  // === Initial resource usage from DDB ===
  const initialResourcesUsed: Record<string, number> = {};
  for (const cls of char.classes || []) {
    for (const feature of cls.classFeatures || []) {
      const lu = feature.definition?.limitedUse ?? feature.limitedUse;
      if (lu && (lu.numberUsed ?? 0) > 0 && feature.definition?.name) {
        initialResourcesUsed[feature.definition.name] = lu.numberUsed;
      }
    }
  }

  // Build CharacterIdentifiers and delegate to shared builder
  const identifiers: CharacterIdentifiers = {
    name,
    race,
    classes,
    abilities,
    maxHP,
    skillProficiencies,
    skillExpertise,
    skillBonuses: skillBonuses.size > 0 ? skillBonuses : undefined,
    saveProficiencies,
    saveBonuses: saveBonuses.size > 0 ? saveBonuses : undefined,
    spells,
    additionalFeatures: features,
    equipment: inventory,
    languages,
    traits,
    appearance,
    currency,
    advantages,
    senses,
    // DDB provides accurate proficiencies via entityTypeId
    armorProficiencies: proficiencies.armor,
    weaponProficiencies: proficiencies.weapons,
    toolProficiencies: proficiencies.tools,
    otherProficiencies: proficiencies.other,
    // DDB computes AC and speed with its modifier system (more accurate)
    armorClass,
    speed,
    source: "ddb",
    ddbId: char.id || undefined,
    initialDynamic: {
      currentHP,
      tempHP,
      spellSlotsUsed: regularSlots,
      pactMagicSlots: pactSlots,
      resourcesUsed: initialResourcesUsed,
      deathSaves: {
        successes: char.deathSaves?.successCount ?? 0,
        failures: char.deathSaves?.failCount ?? 0,
      },
      inventory,
      currency,
      xp,
      heroicInspiration: !!char.inspiration,
    },
  };

  const result = buildCharacter(identifiers);

  // The builder computes class resources from DB, but DDB has more precise
  // runtime values. Override with DDB-extracted resources.
  if (classResources.length > 0) {
    result.character.static.classResources = classResources;
  }

  // Merge builder warnings with parser warnings
  result.warnings.unshift(...warnings);

  return result;
}


/**
 * Compute ability scores using ddb2alchemy's getStatValue pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeAbilityScores(char: any, warnings: string[]): AbilityScores {
  const abilities: AbilityScores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };

  // Step 1: Base stats
  for (const stat of char.stats || []) {
    const key = STAT_ID_MAP[stat.id];
    if (key && stat.value != null) {
      abilities[key] = stat.value;
    }
  }

  // Step 2: Override stats
  for (const stat of char.overrideStats || []) {
    const key = STAT_ID_MAP[stat.id];
    if (key && stat.value != null) {
      abilities[key] = stat.value;
    }
  }

  // Step 3: Bonus stats
  for (const stat of char.bonusStats || []) {
    const key = STAT_ID_MAP[stat.id];
    if (key && stat.value != null) {
      abilities[key] += stat.value;
    }
  }

  // Step 4: Modifiers
  const hasAbilityScoreIncreasesTrait = (char.race?.racialTraits || []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => {
      const name: string = t.definition?.name || "";
      return name === "Ability Score Increases";
    }
  );

  const skipAbilityModComponentIds = new Set<number>();
  if (hasAbilityScoreIncreasesTrait) {
    for (const mod of (char.modifiers?.race || []) as DDBModifier[]) {
      if (
        mod.type === "bonus" &&
        mod.subType?.endsWith("-score") &&
        mod.componentId != null
      ) {
        skipAbilityModComponentIds.add(mod.componentId);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bgAsiFeatIds = new Set<number>();
    for (const feat of (char.feats || []) as any[]) {
      const featName: string = feat.definition?.name || "";
      if (featName.endsWith("Ability Score Improvements")) {
        if (feat.componentId != null) bgAsiFeatIds.add(feat.componentId);
        if (feat.id != null) bgAsiFeatIds.add(feat.id);
        if (feat.definition?.id != null) bgAsiFeatIds.add(feat.definition.id);
      }
    }
    for (const mod of (char.modifiers?.feat || []) as DDBModifier[]) {
      if (
        mod.type === "bonus" &&
        mod.subType?.endsWith("-score") &&
        mod.componentId != null &&
        bgAsiFeatIds.has(mod.componentId)
      ) {
        skipAbilityModComponentIds.add(mod.componentId);
      }
    }
  }

  const setValues: Partial<Record<keyof AbilityScores, number>> = {};

  for (const statId of [1, 2, 3, 4, 5, 6] as const) {
    const key = STAT_ID_MAP[statId];
    if (!key) continue;

    const setBase = maxModifier(char, {
      type: "set",
      subType: `${key}-score`,
    });
    if (setBase > 0) {
      setValues[key] = setBase;
    }

    const bonusMods = getModifiers(char, {
      type: "bonus",
      subType: `${key}-score`,
    });
    let bonus = 0;
    for (const mod of bonusMods) {
      if (
        skipAbilityModComponentIds.size > 0 &&
        mod.componentId != null &&
        skipAbilityModComponentIds.has(mod.componentId)
      ) {
        continue;
      }
      bonus += mod.value || 0;
    }
    if (bonus !== 0) {
      abilities[key] += bonus;
    }
  }

  for (const [key, setValue] of Object.entries(setValues)) {
    const abilityKey = key as keyof AbilityScores;
    if (setValue! > abilities[abilityKey]) {
      abilities[abilityKey] = setValue!;
    }
  }

  for (const [key, val] of Object.entries(abilities)) {
    if (val < 1 || val > 30) {
      warnings.push(`${key} score ${val} is unusual (expected 1-30)`);
    }
  }

  return abilities;
}

/**
 * Compute HP using ddb2alchemy's getBaseHp/getMaxHp/getCurrentHp pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeHP(
  char: any,
  abilities: AbilityScores
): { maxHP: number; currentHP: number; tempHP: number } {
  const conMod = getAbilityMod(abilities.constitution);
  const totalLevel = (char.classes || []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, c: any) => sum + (c.level || 1),
    0
  );

  const hpPerLevelMods = getModifiers(char, { type: "bonus", subType: "hit-points-per-level" });
  let hpPerLevelBonus = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classFeatureMap = new Map<number, number>();
  for (const cls of char.classes || []) {
    for (const f of cls.classFeatures || []) {
      if (f.definition?.id) {
        classFeatureMap.set(f.definition.id, cls.level || 1);
      }
    }
  }
  for (const mod of hpPerLevelMods) {
    const classLevel = (mod.componentId && classFeatureMap.get(mod.componentId)) || totalLevel;
    hpPerLevelBonus += (mod.value || 0) * classLevel;
  }

  const baseHp: number =
    (char.baseHitPoints ?? 10) + conMod * totalLevel + hpPerLevelBonus;
  const bonusHP: number = char.bonusHitPoints || 0;
  const maxHP = Math.max(
    1,
    char.overrideHitPoints || baseHp + bonusHP
  );

  const removedHP: number = char.removedHitPoints || 0;
  const tempHP: number = char.temporaryHitPoints || 0;
  const currentHP = Math.max(0, maxHP - removedHP);

  return { maxHP, currentHP, tempHP };
}

/**
 * Compute AC using ddb2alchemy's getArmorClass pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeArmorClass(char: any, abilities: AbilityScores): number {
  if (char.overrideArmorClass) {
    return char.overrideArmorClass;
  }

  const dexMod = getAbilityMod(abilities.dexterity);

  const equippedArmor: Array<{
    armorClass: number;
    armorTypeId: number;
  }> = [];
  let shieldAC = 0;

  for (const item of char.inventory || []) {
    if (!item.equipped || item.definition?.filterType !== "Armor") continue;
    const typeId = item.definition.armorTypeId;
    const ac = item.definition.armorClass || 0;

    if (typeId === ARMOR_TYPE_SHIELD) {
      shieldAC = Math.max(shieldAC, ac);
    } else if (typeId) {
      equippedArmor.push({ armorClass: ac, armorTypeId: typeId });
    }
  }

  let baseAC: number;

  if (equippedArmor.length > 0) {
    const armor = equippedArmor[0];

    if (armor.armorTypeId === ARMOR_TYPE_LIGHT) {
      baseAC = armor.armorClass + dexMod;
    } else if (armor.armorTypeId === ARMOR_TYPE_MEDIUM) {
      baseAC = armor.armorClass + Math.min(dexMod, 2);
    } else {
      baseAC = armor.armorClass;
    }
  } else {
    let unarmoredAC = 10 + dexMod;
    const conMod = getAbilityMod(abilities.constitution);
    const wisMod = getAbilityMod(abilities.wisdom);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const classes = char.classes || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const classNames = classes.map((c: any) => ((c.definition?.name as string) || "").toLowerCase());

    if (classNames.includes("barbarian")) {
      unarmoredAC = Math.max(unarmoredAC, 10 + dexMod + conMod);
    }
    if (classNames.includes("monk") && shieldAC === 0) {
      unarmoredAC = Math.max(unarmoredAC, 10 + dexMod + wisMod);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasDraconicResilience = classes.some(
      (c: any) => c.definition?.name?.toLowerCase() === "sorcerer" &&
        c.subclassDefinition?.name?.toLowerCase()?.includes("draconic")
    );
    if (hasDraconicResilience) {
      unarmoredAC = Math.max(unarmoredAC, 13 + dexMod);
    }

    baseAC = unarmoredAC;
  }

  const bonusAC = sumModifiers(char, {
    type: "bonus",
    subType: "armor-class",
  });

  return baseAC + shieldAC + bonusAC;
}

/**
 * Compute speed using ddb2alchemy's getSpeed approach.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeSpeed(char: any): number {
  let baseSpeed: number =
    char.race?.weightSpeeds?.normal?.walk ?? 30;

  const setSpeed = maxModifier(char, {
    type: "set",
    subType: "innate-speed-walking",
  });
  if (setSpeed > 0) {
    baseSpeed = Math.max(baseSpeed, setSpeed);
  }

  const speedBonus = sumModifiers(char, { type: "bonus", subType: "speed" });
  const unarmoredBonus = sumModifiers(char, {
    type: "bonus",
    subType: "unarmored-movement",
  });

  return baseSpeed + speedBonus + unarmoredBonus;
}

/**
 * Extract skill proficiency/expertise/bonus identifiers for the builder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSkillIdentifiers(char: any, proficiencyBonus: number): {
  skillProficiencies: string[];
  skillExpertise: string[];
  skillBonuses: Map<string, number>;
} {
  const profMods = getModifiers(char, { type: "proficiency" });
  const expertiseMods = getModifiers(char, { type: "expertise" });
  const bonusMods = gatherModifiers(char).filter(
    (m) => m.type === "bonus" && m.subType && SKILL_ABILITY_MAP[m.subType]
  );

  const hasHalfProfOnChecks = getModifiers(char, {
    type: "half-proficiency",
    subType: "ability-checks",
  }).length > 0;
  const halfProfBonus = hasHalfProfOnChecks ? Math.floor(proficiencyBonus / 2) : 0;

  const profSet = new Set<string>();
  const expertiseSet = new Set<string>();
  const bonusMap = new Map<string, number>();

  for (const mod of profMods) {
    if (mod.subType && SKILL_ABILITY_MAP[mod.subType]) {
      profSet.add(mod.subType);
    }
  }

  for (const mod of expertiseMods) {
    if (mod.subType && SKILL_ABILITY_MAP[mod.subType]) {
      expertiseSet.add(mod.subType);
      profSet.add(mod.subType);
    }
  }

  for (const mod of bonusMods) {
    if (mod.subType && mod.value) {
      bonusMap.set(
        mod.subType,
        (bonusMap.get(mod.subType) || 0) + mod.value
      );
    }
  }

  // Jack of All Trades: add half-prof to non-proficient skills
  if (halfProfBonus > 0) {
    for (const skillSlug of Object.keys(SKILL_ABILITY_MAP)) {
      if (!profSet.has(skillSlug)) {
        bonusMap.set(
          skillSlug,
          (bonusMap.get(skillSlug) || 0) + halfProfBonus
        );
      }
    }
  }

  return {
    skillProficiencies: [...profSet],
    skillExpertise: [...expertiseSet],
    skillBonuses: bonusMap,
  };
}

/**
 * Extract saving throw proficiency identifiers for the builder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSaveIdentifiers(char: any): {
  saveProficiencies: (keyof AbilityScores)[];
  saveBonuses: Map<keyof AbilityScores, number>;
} {
  const profSet = new Set<keyof AbilityScores>();
  const bonusMap = new Map<keyof AbilityScores, number>();

  // Build set of feature IDs belonging to the starting class
  const startingClassFeatureIds = new Set<number>();
  for (const cls of char.classes || []) {
    if (!cls.isStartingClass) continue;
    for (const feature of cls.classFeatures || []) {
      if (feature.id != null) startingClassFeatureIds.add(feature.id);
      if (feature.definition?.id != null) startingClassFeatureIds.add(feature.definition.id);
    }
  }

  // Class modifiers: only starting class grants save proficiencies
  for (const mod of (char.modifiers?.class || []) as DDBModifier[]) {
    if (!mod.subType) continue;

    if (mod.type === "proficiency" && SAVE_SUBTYPE_MAP[mod.subType]) {
      if (mod.componentId != null && startingClassFeatureIds.has(mod.componentId)) {
        profSet.add(SAVE_SUBTYPE_MAP[mod.subType]);
      }
    } else if (mod.type === "bonus" && SAVE_SUBTYPE_MAP[mod.subType] && mod.value) {
      const ability = SAVE_SUBTYPE_MAP[mod.subType];
      bonusMap.set(ability, (bonusMap.get(ability) || 0) + mod.value);
    }
  }

  // Non-class modifiers
  const nonClassCategories = ["race", "feat", "item", "background", "condition"];
  for (const category of nonClassCategories) {
    for (const mod of (char.modifiers?.[category] || []) as DDBModifier[]) {
      if (!mod.subType) continue;

      if (mod.type === "proficiency" && SAVE_SUBTYPE_MAP[mod.subType]) {
        profSet.add(SAVE_SUBTYPE_MAP[mod.subType]);
      } else if (mod.type === "bonus" && SAVE_SUBTYPE_MAP[mod.subType] && mod.value) {
        const ability = SAVE_SUBTYPE_MAP[mod.subType];
        bonusMap.set(ability, (bonusMap.get(ability) || 0) + mod.value);
      }
    }
  }

  return {
    saveProficiencies: [...profSet],
    saveBonuses: bonusMap,
  };
}

/**
 * Helper: extract skills for senses computation (need SkillProficiency[]).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSkillsForSenses(char: any, proficiencyBonus: number): { name: string; proficient: boolean; expertise: boolean; bonus?: number }[] {
  const { skillProficiencies, skillExpertise, skillBonuses } = extractSkillIdentifiers(char, proficiencyBonus);
  const profSet = new Set(skillProficiencies);
  const expertiseSet = new Set(skillExpertise);

  return Object.entries(SKILL_ABILITY_MAP).map(([skillSlug]) => ({
    name: skillSlug,
    proficient: profSet.has(skillSlug),
    expertise: expertiseSet.has(skillSlug),
    bonus: skillBonuses.get(skillSlug) || undefined,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFeatures(
  char: any,
  classes: CharacterClass[]
): CharacterFeature[] {
  const features: CharacterFeature[] = [];
  const seen = new Set<string>();

  const addFeature = (f: CharacterFeature) => {
    if (!seen.has(f.name)) {
      seen.add(f.name);
      features.push(f);
    }
  };

  // Class features
  for (const cls of char.classes || []) {
    const className: string = cls.definition?.name || "Unknown";
    const classLevel: number = cls.level || 1;

    for (const feature of cls.classFeatures || []) {
      if (!feature.definition?.name) continue;
      const requiredLevel: number | undefined =
        feature.requiredLevel ?? feature.definition?.requiredLevel;
      if (requiredLevel != null && requiredLevel > classLevel) continue;

      addFeature({
        name: feature.definition.name,
        description: feature.definition.description
          ? stripHtml(feature.definition.description)
          : "",
        source: "class",
        sourceLabel: className,
        requiredLevel: requiredLevel ?? undefined,
        activationType: formatCastingTime(feature.definition?.activation ?? feature.activation),
      });
    }
  }

  // Racial traits
  const raceName: string =
    char.race?.fullName ||
    char.race?.baseName ||
    char.race?.baseRaceName ||
    "Race";
  for (const trait of char.race?.racialTraits || []) {
    if (!trait.definition?.name) continue;
    if (trait.definition.name === "Ability Score Increases") continue;
    addFeature({
      name: trait.definition.name,
      description: trait.definition.description
        ? stripHtml(trait.definition.description)
        : "",
      source: "race",
      sourceLabel: raceName,
      activationType: formatCastingTime(trait.definition?.activation ?? trait.activation),
    });
  }

  // Feats
  for (const feat of char.feats || []) {
    if (!feat.definition?.name) continue;
    const featName: string = feat.definition.name;
    if (featName === "Dark Bargain") continue;
    if (featName.endsWith("Ability Score Improvements")) continue;
    addFeature({
      name: featName,
      description: feat.definition.description
        ? stripHtml(feat.definition.description)
        : "",
      source: "feat",
      sourceLabel: featName,
      activationType: formatCastingTime(feat.definition?.activation ?? feat.activation),
    });
  }

  return features;
}

/**
 * Extract class resources with limited uses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractClassResources(char: any, abilities: AbilityScores): { name: string; maxUses: number; resetType: "short" | "long"; source: string }[] {
  const resources: { name: string; maxUses: number; resetType: "short" | "long"; source: string }[] = [];
  const seen = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionLimitedUseMap = new Map<string, any>();
  for (const action of char.actions?.class || []) {
    if (action.name && action.limitedUse) {
      actionLimitedUseMap.set(action.name, action.limitedUse);
    }
  }

  for (const cls of char.classes || []) {
    const className: string = cls.definition?.name || "Unknown";
    const classLevel: number = cls.level || 1;

    for (const feature of cls.classFeatures || []) {
      if (!feature.definition?.name) continue;
      const requiredLevel: number | undefined =
        feature.requiredLevel ?? feature.definition?.requiredLevel;
      if (requiredLevel != null && requiredLevel > classLevel) continue;

      const name: string = feature.definition.name;

      const actionEntry = actionLimitedUseMap.has(name)
        ? [name, actionLimitedUseMap.get(name)] as const
        : [...actionLimitedUseMap.entries()].find(
            ([actionName]) => actionName.startsWith(name + " ") ||
              actionName.startsWith(name + ":") ||
              actionName.startsWith(name + "(")
          );
      const actionLU = actionEntry?.[1];
      const matchedActionName = actionEntry?.[0];
      const featureLU = feature.definition.limitedUse ?? feature.limitedUse;
      const featureLUObj = featureLU && !Array.isArray(featureLU) ? featureLU : null;
      let limitedUse = actionLU ?? featureLUObj;
      if (!limitedUse) continue;

      let maxUses: number = limitedUse.maxUses ?? 0;
      const statModId: number | undefined =
        limitedUse.statModifierUsesId ?? actionLU?.statModifierUsesId;
      if (statModId && STAT_ID_MAP[statModId]) {
        const abilityKey = STAT_ID_MAP[statModId];
        maxUses = maxUses + getAbilityMod(abilities[abilityKey]);
      }
      if (maxUses <= 0) maxUses = Math.max(1, maxUses);
      if (maxUses <= 0) continue;

      const resetType = DDB_RESET_TYPES[limitedUse.resetType ?? actionLU?.resetType] ?? null;
      if (!resetType) continue;

      if (seen.has(name)) continue;
      seen.add(name);
      if (matchedActionName) seen.add(matchedActionName);

      resources.push({ name, maxUses, resetType, source: className });
    }
  }

  // Second pass: class actions not matched to features
  for (const action of char.actions?.class || []) {
    if (!action.name || !action.limitedUse || seen.has(action.name)) continue;
    const lu = action.limitedUse;
    if (!lu.maxUses) continue;
    const resetType = DDB_RESET_TYPES[lu.resetType] ?? null;
    if (!resetType) continue;

    let maxUses: number = lu.maxUses ?? 0;
    if (lu.statModifierUsesId && STAT_ID_MAP[lu.statModifierUsesId]) {
      maxUses += getAbilityMod(abilities[STAT_ID_MAP[lu.statModifierUsesId]]);
    }
    if (maxUses <= 0) continue;

    seen.add(action.name);
    resources.push({ name: action.name, maxUses, resetType, source: "Class" });
  }

  return resources;
}

/**
 * Extract actions from DDB's char.actions object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractActions(char: any): CharacterFeature[] {
  const actions: CharacterFeature[] = [];
  const charActions = char.actions;
  if (!charActions || typeof charActions !== "object") return actions;

  const sourceMap: Record<string, CharacterFeature["source"]> = {
    race: "race",
    class: "class",
    feat: "feat",
    background: "background",
  };

  for (const [key, value] of Object.entries(charActions)) {
    if (!Array.isArray(value)) continue;
    const source = sourceMap[key] || "class";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const action of value as any[]) {
      if (!action.name) continue;
      const activationType = formatCastingTime(action.activation);
      if (!activationType) continue;
      actions.push({
        name: action.name,
        description: action.description
          ? stripHtml(action.description)
          : action.snippet
            ? stripHtml(action.snippet)
            : "",
        source,
        sourceLabel: source.charAt(0).toUpperCase() + source.slice(1),
        activationType,
      });
    }
  }

  return actions;
}

/**
 * Extract advantage and disadvantage modifiers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAdvantages(char: any): AdvantageEntry[] {
  const entries: AdvantageEntry[] = [];
  const seen = new Set<string>();

  const modCategories = char.modifiers || {};
  for (const category of Object.keys(modCategories)) {
    const mods: DDBModifier[] = modCategories[category] || [];
    for (const mod of mods) {
      const typeLower = (mod.type || "").toLowerCase();
      if (typeLower !== "advantage" && typeLower !== "disadvantage") continue;
      if (!mod.subType) continue;

      const restriction = mod.restriction || undefined;
      const dedupKey = `${typeLower}:${mod.subType}:${restriction || ""}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const source =
        mod.friendlyTypeName && mod.friendlySubtypeName
          ? `${mod.friendlyTypeName} on ${mod.friendlySubtypeName}`
          : mod.friendlySubtypeName || mod.subType;

      entries.push({
        type: typeLower as "advantage" | "disadvantage",
        subType: mod.subType,
        restriction: restriction || undefined,
        source,
      });
    }
  }

  return entries;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSpells(char: any): CharacterSpell[] {
  const spells: CharacterSpell[] = [];
  const seen = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseSpellDef(
    def: any,
    isPrepared: boolean,
    extra: {
      alwaysPrepared: boolean;
      spellSource: CharacterSpell["spellSource"];
      knownByClass: boolean;
      sourceClass?: string;
    }
  ): CharacterSpell {
    return {
      name: def.name,
      level: def.level ?? 0,
      prepared: isPrepared,
      alwaysPrepared: extra.alwaysPrepared,
      spellSource: extra.spellSource,
      knownByClass: extra.knownByClass,
      sourceClass: extra.sourceClass,
      school: def.school || undefined,
      castingTime: formatCastingTime(def.activation),
      range: formatRange(def.range),
      components: formatComponents(def.components),
      duration: formatDuration(def.duration),
      description: def.description ? stripHtml(def.description) : undefined,
      ritual: def.ritual || false,
      concentration: def.concentration || false,
    };
  }

  const classNameById = new Map<number, string>();
  for (const cls of char.classes || []) {
    const name = cls.definition?.name;
    if (!name) continue;
    if (cls.id != null) classNameById.set(cls.id, name);
    if (cls.definition?.id != null) classNameById.set(cls.definition.id, name);
  }

  // Class spells
  for (const classSpellBlock of char.classSpells || []) {
    const className = classNameById.get(classSpellBlock.characterClassId) || "";
    const isKnownCaster = KNOWN_CASTER_CLASSES.has(className.toLowerCase());

    for (const spell of classSpellBlock.spells || []) {
      const def = spell.definition;
      if (!def?.name || seen.has(def.name)) continue;
      seen.add(def.name);

      const isAlwaysPrepared = spell.alwaysPrepared || false;
      const isPrepared =
        spell.prepared || isAlwaysPrepared || def.level === 0 || isKnownCaster;
      spells.push(
        parseSpellDef(def, isPrepared, {
          alwaysPrepared: isAlwaysPrepared,
          spellSource: "class",
          knownByClass: true,
          sourceClass: className || undefined,
        })
      );
    }
  }

  // Class feature spells
  for (const spell of char.spells?.class || []) {
    const def = spell.definition;
    if (!def?.name || seen.has(def.name)) continue;
    seen.add(def.name);
    spells.push(
      parseSpellDef(def, true, {
        alwaysPrepared: true,
        spellSource: "class",
        knownByClass: true,
      })
    );
  }

  // Race spells
  for (const spell of char.spells?.race || []) {
    const def = spell.definition;
    if (!def?.name || seen.has(def.name)) continue;
    seen.add(def.name);
    spells.push(
      parseSpellDef(def, true, {
        alwaysPrepared: true,
        spellSource: "race",
        knownByClass: false,
      })
    );
  }

  // Feat spells
  for (const spell of char.spells?.feat || []) {
    const def = spell.definition;
    if (!def?.name || seen.has(def.name)) continue;
    seen.add(def.name);
    spells.push(
      parseSpellDef(def, true, {
        alwaysPrepared: true,
        spellSource: "feat",
        knownByClass: false,
      })
    );
  }

  // Item spells
  for (const spell of char.spells?.item || []) {
    const def = spell.definition;
    if (!def?.name || seen.has(def.name)) continue;
    seen.add(def.name);
    spells.push(
      parseSpellDef(def, true, {
        alwaysPrepared: true,
        spellSource: "item",
        knownByClass: false,
      })
    );
  }

  return spells.sort(
    (a, b) => a.level - b.level || a.name.localeCompare(b.name)
  );
}

/**
 * Extract spell slots from DDB's own slot tables.
 * DDB has precise slot data including current usage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSpellSlots(char: any): {
  regularSlots: SpellSlotLevel[];
  pactSlots: SpellSlotLevel[];
} {
  const slots: SpellSlotLevel[] = [];

  const usedByLevel = new Map<number, number>();
  for (const slot of char.spellSlots || []) {
    if (slot.level >= 1 && slot.level <= 9 && (slot.used ?? 0) > 0) {
      usedByLevel.set(slot.level, slot.used);
    }
  }

  const rawClasses: DDBClassInfo[] = char.classes || [];
  const casterClasses = rawClasses.filter(
    (c) => c.definition?.canCastSpells &&
      c.definition.name.toLowerCase() !== "warlock"
  );

  if (casterClasses.length > 0) {
    let slotRow: number[] | undefined;

    if (casterClasses.length > 1) {
      // Multiclass: use DDB's own multiclass slot table
      let multiCasterLevel = 0;
      for (const cls of casterClasses) {
        const divisor = cls.definition?.spellRules?.multiClassSpellSlotDivisor;
        if (divisor) {
          multiCasterLevel += cls.level / divisor;
        }
      }
      const casterLevel = Math.min(
        Math.max(Math.floor(multiCasterLevel), 1),
        20
      );
      // Use the first caster class's table at the multiclass level
      const table = casterClasses[0].definition?.spellRules?.levelSpellSlots;
      if (table && casterLevel < table.length) {
        slotRow = table[casterLevel];
      }
    } else {
      const cls = casterClasses[0];
      const table = cls.definition?.spellRules?.levelSpellSlots;
      if (table && cls.level >= 1 && cls.level < table.length) {
        slotRow = table[cls.level];
      }
    }

    if (slotRow) {
      for (let i = 0; i < slotRow.length; i++) {
        if (slotRow[i] > 0) {
          slots.push({
            level: i + 1,
            total: slotRow[i],
            used: usedByLevel.get(i + 1) || 0,
          });
        }
      }
    }
  }

  // Pact Magic (Warlock)
  const pactSlots: SpellSlotLevel[] = [];
  const warlockClass = rawClasses.find(
    (c) =>
      c.definition?.canCastSpells &&
      c.definition.name.toLowerCase() === "warlock"
  );
  if (warlockClass) {
    const pactTable = warlockClass.definition?.spellRules?.levelSpellSlots;
    if (pactTable && warlockClass.level >= 1 && warlockClass.level < pactTable.length) {
      const pactRow = pactTable[warlockClass.level];
      const pactUsed = new Map<number, number>();
      for (const slot of char.pactMagic || []) {
        if (slot.level >= 1 && (slot.used ?? 0) > 0) {
          pactUsed.set(slot.level, slot.used);
        }
      }
      if (pactRow) {
        for (let i = 0; i < pactRow.length; i++) {
          if (pactRow[i] > 0) {
            pactSlots.push({
              level: i + 1,
              total: pactRow[i],
              used: pactUsed.get(i + 1) || 0,
            });
          }
        }
      }
    }
  }

  return {
    regularSlots: slots.sort((a, b) => a.level - b.level),
    pactSlots: pactSlots.sort((a, b) => a.level - b.level),
  };
}

/**
 * Extract proficiencies using ddb2alchemy's entityTypeId approach.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProficiencies(char: any): { armor: string[]; weapons: string[]; tools: string[]; other: string[] } {
  const group = {
    armor: [] as string[],
    weapons: [] as string[],
    tools: [] as string[],
    other: [] as string[],
  };
  const seen = new Set<string>();

  const profMods = getModifiers(char, { type: "proficiency" });

  for (const mod of profMods) {
    const name = mod.friendlySubtypeName;
    if (!name || seen.has(name)) continue;
    if (/^choose\s+an?\s+/i.test(name)) continue;

    seen.add(name);

    if (mod.entityTypeId === PROF_ENTITY_ARMOR) {
      group.armor.push(name);
    } else if (mod.entityTypeId === PROF_ENTITY_WEAPON) {
      group.weapons.push(name);
    } else if (mod.entityTypeId === PROF_ENTITY_TOOL) {
      group.tools.push(name);
    } else {
      const lower = name.toLowerCase();
      const slug = lower.replace(/\s+/g, "-");
      if (
        lower.includes("saving") ||
        SKILL_ABILITY_MAP[lower] ||
        SKILL_ABILITY_MAP[slug] ||
        lower.includes("-saving-throws")
      ) {
        continue;
      }
      if (lower.includes("weapon")) {
        group.weapons.push(name);
      } else {
        group.other.push(name);
      }
    }
  }

  return group;
}

/**
 * Extract languages from modifiers.
 */
function extractLanguages(modifiers: DDBModifier[]): string[] {
  const languages = new Set<string>();
  for (const mod of modifiers) {
    if (mod.type === "language" && mod.friendlySubtypeName) {
      languages.add(mod.friendlySubtypeName);
    }
  }
  return [...languages].sort();
}

/**
 * Extract senses (darkvision, passive perception).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSenses(
  char: any,
  abilities: AbilityScores,
  proficiencyBonus: number,
  skills: { name: string; proficient: boolean; expertise: boolean; bonus?: number }[]
): string[] {
  const senses: string[] = [];

  for (const trait of char.race?.racialTraits || []) {
    const traitName: string = trait.definition?.name || "";
    if (traitName.toLowerCase().includes("darkvision")) {
      const desc: string = trait.definition?.description || "";
      const match = desc.match(/(\d+)\s*(?:feet|ft)/i);
      const range = match ? match[1] : "60";
      senses.push(`Darkvision ${range} ft.`);
    }
  }

  const darkvisionSet = maxModifier(char, {
    type: "set",
    subType: "darkvision",
  });
  if (darkvisionSet > 0 && !senses.some((s) => s.startsWith("Darkvision"))) {
    senses.push(`Darkvision ${darkvisionSet} ft.`);
  }

  const wisMod = getAbilityMod(abilities.wisdom);
  const perceptionSkill = skills.find((s) => s.name === "perception");
  let passivePerception = 10 + wisMod;
  if (perceptionSkill?.proficient) {
    passivePerception += proficiencyBonus;
    if (perceptionSkill.expertise) {
      passivePerception += proficiencyBonus;
    }
  }
  if (perceptionSkill?.bonus) {
    passivePerception += perceptionSkill.bonus;
  }
  senses.push(`Passive Perception ${passivePerception}`);

  return senses;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInventory(
  char: any,
  abilities: AbilityScores,
  proficiencyBonus: number
): InventoryItem[] {
  const items: InventoryItem[] = [];
  const strMod = getAbilityMod(abilities.strength);
  const dexMod = getAbilityMod(abilities.dexterity);

  for (const item of char.inventory || []) {
    const def = item.definition;
    if (!def?.name) continue;

    let damage: string | undefined;
    let damageType: string | undefined;
    if (def.damage?.diceString) {
      damage = def.damage.diceString;
    } else if (def.fixedDamage) {
      damage = String(def.fixedDamage);
    }
    if (def.damageType) {
      damageType = def.damageType;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: string[] = (def.properties || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p.name)
      .filter(Boolean);

    let range: string | undefined;
    const isWeapon =
      def.filterType === "Weapon" || def.attackType === 1 || def.attackType === 2;
    if (isWeapon) {
      const isRanged = def.attackType === 2;
      const hasThrown = properties.some(
        (p) => p.toLowerCase() === "thrown"
      );
      const hasReach = properties.some(
        (p) => p.toLowerCase() === "reach"
      );

      if (isRanged) {
        const short = def.range || 0;
        const long = def.longRange || 0;
        if (short > 0 && long > 0) {
          range = `${short}/${long} ft.`;
        } else if (short > 0) {
          range = `${short} ft.`;
        }
      } else if (hasThrown) {
        const short = def.range || 20;
        const long = def.longRange || short * 3;
        range = `${short}/${long} ft.`;
      } else {
        range = hasReach ? "10 ft." : "5 ft.";
      }
    }

    let attackBonus: number | undefined;
    if (isWeapon && damage) {
      const isRanged = def.attackType === 2;
      const isFinesse = properties.some(
        (p) => p.toLowerCase() === "finesse"
      );

      let abilityMod: number;
      if (isRanged) {
        abilityMod = dexMod;
      } else if (isFinesse) {
        abilityMod = Math.max(strMod, dexMod);
      } else {
        abilityMod = strMod;
      }

      const magicBonus = def.magicBonus || 0;
      attackBonus = proficiencyBonus + abilityMod + magicBonus;

      const damageMod = abilityMod + magicBonus;
      if (damageMod > 0) {
        damage = `${damage}+${damageMod}`;
      } else if (damageMod < 0) {
        damage = `${damage}${damageMod}`;
      }
    }

    items.push({
      name: def.name,
      equipped: item.equipped || false,
      quantity: item.quantity || 1,
      type: def.filterType || def.type || undefined,
      armorClass: def.armorClass || undefined,
      description: def.description ? stripHtml(def.description) : undefined,
      damage,
      damageType,
      range,
      attackBonus,
      properties: properties.length > 0 ? properties : undefined,
      weight: def.weight || undefined,
      rarity: def.rarity || undefined,
      attunement: def.canAttune || false,
      isAttuned: item.isAttuned || false,
      isMagicItem: def.magic || false,
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


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAppearance(char: any): CharacterAppearance | undefined {
  const a: CharacterAppearance = {};
  if (char.gender) a.gender = String(char.gender);
  if (char.age) a.age = String(char.age);
  if (char.height) a.height = String(char.height);
  if (char.weight) a.weight = String(char.weight);
  if (char.hair) a.hair = String(char.hair);
  if (char.eyes) a.eyes = String(char.eyes);
  if (char.skin) a.skin = String(char.skin);
  return Object.keys(a).length > 0 ? a : undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/?(ul|ol)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&hellip;/gi, "\u2026")
    .replace(/&times;/gi, "\u00D7")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCastingTime(activation: any): string | undefined {
  if (!activation) return undefined;
  const type = activation.activationType;
  if (type != null && ACTIVATION_TYPES[type]) {
    return ACTIVATION_TYPES[type];
  }
  const time = activation.activationTime;
  if (time && type) {
    return `${time} ${type}`;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatRange(range: any): string | undefined {
  if (!range) return undefined;
  if (range.origin === "Self") return "Self";
  if (range.origin === "Touch") return "Touch";
  if (range.rangeValue) return `${range.rangeValue} feet`;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatComponents(components: any): string | undefined {
  if (!Array.isArray(components) || components.length === 0) return undefined;
  const parts: string[] = [];
  if (components.includes(1)) parts.push("V");
  if (components.includes(2)) parts.push("S");
  if (components.includes(3)) parts.push("M");
  return parts.join(", ") || undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDuration(duration: any): string | undefined {
  if (!duration) return undefined;
  const type = duration.durationType;
  const interval = duration.durationInterval;
  const unit = duration.durationUnit;

  if (type === "Instantaneous") return "Instantaneous";
  if (type === "Until Dispelled") return "Until Dispelled";
  if (type === "Special") return "Special";
  if (type === "Concentration") {
    if (interval && unit) {
      const unitStr = DURATION_TYPES[unit] || unit;
      return `Concentration, up to ${interval} ${unitStr}${interval > 1 ? "s" : ""}`;
    }
    return "Concentration";
  }
  if (interval && unit) {
    const unitStr = DURATION_TYPES[unit] || unit;
    return `${interval} ${unitStr}${interval > 1 ? "s" : ""}`;
  }
  return undefined;
}
