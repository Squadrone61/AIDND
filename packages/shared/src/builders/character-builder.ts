/**
 * Shared character builder — single source of truth for D&D mechanics.
 *
 * Parsers extract CharacterIdentifiers (player choices), then delegate to
 * buildCharacter() which computes everything else from the D&D 2024 database.
 */

import type {
  CharacterData,
  CharacterStaticData,
  CharacterDynamicData,
  CharacterFeature,
  ClassResource,
  ProficiencyGroup,
  SkillProficiency,
  SavingThrowProficiency,
  SpellSlotLevel,
  AbilityScores,
} from "../types/character";
import type { CharacterIdentifiers } from "./types";
import {
  getClass,
  getSpecies,
  getSpell,
  getFeat,
  getArmor,
  getClassSpellSlots,
  getClassFeatures,
  getCasterMultiplier,
  THIRD_CASTER_SLOTS,
} from "../data/index";
import type { ClassResourceTemplate } from "../data/types";

// ─── Helpers ─────────────────────────────────────────────

function getAbilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
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

// Multiclass spell slot table (caster levels 1-20) — from PHB
const MULTICLASS_SPELL_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Third-caster subclasses that grant spellcasting */
const THIRD_CASTER_SUBCLASSES = new Set([
  "eldritch knight",
  "arcane trickster",
]);

// ─── Main Builder ────────────────────────────────────────

export function buildCharacter(
  ids: CharacterIdentifiers
): { character: CharacterData; warnings: string[] } {
  const warnings: string[] = [];

  const totalLevel = ids.classes.reduce((sum, c) => sum + c.level, 0);
  const proficiencyBonus = Math.ceil(totalLevel / 4) + 1;

  // === HP adjustments from feats/species ===
  let maxHP = ids.maxHP;
  const featureNames = new Set(
    (ids.additionalFeatures ?? []).map((f) => f.name.toLowerCase())
  );
  if (featureNames.has("tough")) {
    maxHP += 2 * totalLevel;
  }
  // Dwarven Toughness
  const speciesLowerForHP = ids.race.toLowerCase().replace(/\s*\(.*\)/, "");
  if (speciesLowerForHP === "dwarf") {
    maxHP += totalLevel;
  }

  // === AC ===
  const armorClass = ids.armorClass ?? computeArmorClass(ids);

  // === Speed ===
  const speed = ids.speed ?? computeSpeed(ids, featureNames);

  // === Skills ===
  const skills = computeSkills(ids);

  // === Saving Throws ===
  const savingThrows = computeSavingThrows(ids);

  // === Spellcasting ===
  const spellcasting = computeSpellcasting(ids, proficiencyBonus);

  // === Spell Slots ===
  const { regularSlots, pactSlots } = computeSpellSlots(ids);

  // === Enrich Spells ===
  const spells = ids.spells.map((spell) => {
    const dbSpell = getSpell(spell.name);
    if (dbSpell) {
      return {
        ...spell,
        description: spell.description || dbSpell.description,
        school: spell.school || dbSpell.school,
        castingTime: spell.castingTime || dbSpell.castingTime,
        range: spell.range || dbSpell.range,
        components: spell.components || dbSpell.components,
        duration: spell.duration || dbSpell.duration,
        concentration: spell.concentration ?? dbSpell.concentration,
        ritual: spell.ritual ?? dbSpell.ritual,
      };
    }
    return spell;
  });

  // === Features ===
  const features = computeFeatures(ids, warnings);

  // === Class Resources ===
  const classResources = computeClassResources(ids);

  // === Proficiencies ===
  const proficiencies = computeProficiencies(ids);

  // === Senses ===
  const senses = computeSenses(ids, proficiencyBonus, skills);

  const staticData: CharacterStaticData = {
    name: ids.name,
    race: ids.race,
    classes: ids.classes,
    abilities: ids.abilities,
    maxHP: Math.max(1, maxHP),
    armorClass,
    proficiencyBonus,
    speed,
    features,
    classResources,
    proficiencies,
    skills,
    savingThrows,
    senses,
    languages: ids.languages,
    spells,
    spellcastingAbility: spellcasting.spellcastingAbility,
    spellSaveDC: spellcasting.spellSaveDC,
    spellAttackBonus: spellcasting.spellAttackBonus,
    advantages: ids.advantages ?? [],
    traits: ids.traits ?? {},
    appearance: ids.appearance,
    importedAt: Date.now(),
    source: ids.source,
    sourceUrl: ids.sourceUrl,
    ddbId: ids.ddbId,
  };

  const dynamicData: CharacterDynamicData = {
    currentHP: ids.initialDynamic?.currentHP ?? staticData.maxHP,
    tempHP: ids.initialDynamic?.tempHP ?? 0,
    spellSlotsUsed: ids.initialDynamic?.spellSlotsUsed ?? regularSlots,
    pactMagicSlots: ids.initialDynamic?.pactMagicSlots ?? pactSlots,
    resourcesUsed: ids.initialDynamic?.resourcesUsed ?? {},
    conditions: ids.initialDynamic?.conditions ?? [],
    deathSaves: ids.initialDynamic?.deathSaves ?? { successes: 0, failures: 0 },
    inventory: ids.initialDynamic?.inventory ?? ids.equipment,
    currency: ids.initialDynamic?.currency ?? ids.currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    xp: ids.initialDynamic?.xp ?? 0,
    heroicInspiration: ids.initialDynamic?.heroicInspiration ?? false,
  };

  return {
    character: { static: staticData, dynamic: dynamicData },
    warnings,
  };
}

// ─── AC Computation ──────────────────────────────────────

function computeArmorClass(ids: CharacterIdentifiers): number {
  const dexMod = getAbilityMod(ids.abilities.dexterity);
  const conMod = getAbilityMod(ids.abilities.constitution);
  const wisMod = getAbilityMod(ids.abilities.wisdom);

  // Find equipped armor and shields from equipment
  let baseAC = 10 + dexMod;
  let hasBodyArmor = false;
  let hasShield = false;

  for (const item of ids.equipment) {
    if (!item.equipped) continue;
    if (item.type === "Shield") {
      hasShield = true;
      continue;
    }
    if (item.type === "Armor" && item.name) {
      const armorData = getArmor(item.name);
      if (armorData && armorData.category !== "shield") {
        hasBodyArmor = true;
        switch (armorData.category) {
          case "light":
            baseAC = armorData.ac + dexMod;
            break;
          case "medium":
            baseAC = armorData.ac + Math.min(dexMod, 2);
            break;
          case "heavy":
            baseAC = armorData.ac;
            break;
        }
      } else if (!armorData && item.armorClass) {
        // Fallback to item's AC if not found in DB
        hasBodyArmor = true;
        baseAC = item.armorClass + dexMod; // assume light
      }
    }
  }

  // Unarmored Defense
  if (!hasBodyArmor) {
    const classNames = ids.classes.map((c) => c.name.toLowerCase());
    if (classNames.includes("barbarian")) {
      baseAC = Math.max(baseAC, 10 + dexMod + conMod);
    }
    if (classNames.includes("monk") && !hasShield) {
      baseAC = Math.max(baseAC, 10 + dexMod + wisMod);
    }
    // Draconic Resilience (Sorcerer with Draconic subclass)
    if (
      ids.classes.some(
        (c) =>
          c.name.toLowerCase() === "sorcerer" &&
          c.subclass?.toLowerCase()?.includes("draconic")
      )
    ) {
      baseAC = Math.max(baseAC, 13 + dexMod);
    }
  }

  if (hasShield) {
    baseAC += 2;
  }

  // Defense fighting style: +1 AC when wearing armor
  if (hasBodyArmor) {
    const featNames = (ids.additionalFeatures ?? []).map((f) => f.name.toLowerCase());
    if (featNames.includes("defense") || featNames.includes("fighting style: defense")) {
      baseAC += 1;
    }
  }

  return baseAC;
}

// ─── Speed Computation ───────────────────────────────────

function computeSpeed(ids: CharacterIdentifiers, featureNames: Set<string>): number {
  // Look up species base speed
  const speciesLower = ids.race.toLowerCase().replace(/\s*\(.*\)/, "");
  let speed = getSpecies(speciesLower)?.speed ?? 30;

  const totalLevel = ids.classes.reduce((sum, c) => sum + c.level, 0);
  const classNames = ids.classes.map((c) => c.name.toLowerCase());

  // Barbarian Fast Movement (+10 at level 5+)
  if (classNames.includes("barbarian") && totalLevel >= 5) {
    speed += 10;
  }

  // Monk Unarmored Movement
  const monkClass = ids.classes.find((c) => c.name.toLowerCase() === "monk");
  if (monkClass && monkClass.level >= 2) {
    const lvl = monkClass.level;
    const monkBonus =
      lvl >= 18 ? 30 : lvl >= 14 ? 25 : lvl >= 10 ? 20 : lvl >= 6 ? 15 : 10;
    speed += monkBonus;
  }

  // Feat-based speed bonuses
  if (featureNames.has("mobile")) speed += 10;
  if (featureNames.has("speedy")) speed += 10;
  if (featureNames.has("squat nimbleness")) speed += 5;

  return speed;
}

// ─── Skills Computation ──────────────────────────────────

function computeSkills(ids: CharacterIdentifiers): SkillProficiency[] {
  const profSet = new Set(ids.skillProficiencies);
  const expertiseSet = new Set(ids.skillExpertise);

  return Object.entries(SKILL_ABILITY_MAP).map(([skillSlug, ability]) => ({
    name: skillSlug,
    ability,
    proficient: profSet.has(skillSlug),
    expertise: expertiseSet.has(skillSlug),
    bonus: ids.skillBonuses?.get(skillSlug) || undefined,
  }));
}

// ─── Saving Throws ───────────────────────────────────────

function computeSavingThrows(ids: CharacterIdentifiers): SavingThrowProficiency[] {
  const profSet = new Set(ids.saveProficiencies);

  const abilityList: (keyof AbilityScores)[] = [
    "strength", "dexterity", "constitution",
    "intelligence", "wisdom", "charisma",
  ];

  return abilityList.map((ability) => ({
    ability,
    proficient: profSet.has(ability),
    bonus: ids.saveBonuses?.get(ability) || undefined,
  }));
}

// ─── Spellcasting ────────────────────────────────────────

function computeSpellcasting(
  ids: CharacterIdentifiers,
  proficiencyBonus: number
): {
  spellcastingAbility?: keyof AbilityScores;
  spellSaveDC?: number;
  spellAttackBonus?: number;
} {
  // Find the highest-level class that can cast spells
  let bestAbility: keyof AbilityScores | undefined;
  let bestLevel = 0;

  for (const cls of ids.classes) {
    const classData = getClass(cls.name);
    if (!classData?.spellcastingAbility) {
      // Check for third-caster subclasses
      const subLc = (cls.subclass ?? "").toLowerCase();
      if (THIRD_CASTER_SUBCLASSES.has(subLc)) {
        if (cls.level > bestLevel) {
          bestAbility = "intelligence";
          bestLevel = cls.level;
        }
      }
      continue;
    }
    if (cls.level > bestLevel) {
      bestAbility = classData.spellcastingAbility.toLowerCase() as keyof AbilityScores;
      bestLevel = cls.level;
    }
  }

  if (!bestAbility) return {};

  const mod = getAbilityMod(ids.abilities[bestAbility]);
  return {
    spellcastingAbility: bestAbility,
    spellSaveDC: 8 + proficiencyBonus + mod,
    spellAttackBonus: proficiencyBonus + mod,
  };
}

// ─── Spell Slots ─────────────────────────────────────────

function computeSpellSlots(ids: CharacterIdentifiers): {
  regularSlots: SpellSlotLevel[];
  pactSlots: SpellSlotLevel[];
} {
  const regularSlots: SpellSlotLevel[] = [];
  const pactSlots: SpellSlotLevel[] = [];

  // Separate warlock from non-warlock caster classes
  const casterClasses: { name: string; level: number; subclass?: string }[] = [];
  let warlockLevel = 0;

  for (const cls of ids.classes) {
    const lc = cls.name.toLowerCase();
    if (lc === "warlock") {
      warlockLevel = cls.level;
      continue;
    }
    const classData = getClass(cls.name);
    const subLc = (cls.subclass ?? "").toLowerCase();
    if (classData?.casterType || THIRD_CASTER_SUBCLASSES.has(subLc)) {
      casterClasses.push(cls);
    }
  }

  // Warlock pact magic
  if (warlockLevel > 0) {
    const slots = getClassSpellSlots("Warlock", warlockLevel);
    if (slots && slots.length > 0) {
      for (let i = slots.length - 1; i >= 0; i--) {
        if (slots[i] > 0) {
          pactSlots.push({ level: i + 1, total: slots[i], used: 0 });
          break;
        }
      }
    }
  }

  if (casterClasses.length === 0) {
    return { regularSlots, pactSlots };
  }

  let slotRow: number[] | undefined;

  if (casterClasses.length === 1) {
    // Single caster class
    const cls = casterClasses[0];
    const classData = getClass(cls.name);
    const subLc = (cls.subclass ?? "").toLowerCase();

    if (THIRD_CASTER_SUBCLASSES.has(subLc)) {
      slotRow = THIRD_CASTER_SLOTS[cls.level] ?? [];
    } else if (classData?.casterType) {
      slotRow = getClassSpellSlots(cls.name, cls.level);
    }
  } else {
    // Multiclass: compute weighted caster level
    let combinedCasterLevel = 0;
    for (const cls of casterClasses) {
      const lc = cls.name.toLowerCase();
      const multiplier = getCasterMultiplier(lc);
      const subLc = (cls.subclass ?? "").toLowerCase();
      const thirdCasterMult = THIRD_CASTER_SUBCLASSES.has(subLc) ? 1 / 3 : 0;
      combinedCasterLevel += cls.level * (multiplier || thirdCasterMult);
    }
    const effectiveLevel = Math.min(Math.max(Math.floor(combinedCasterLevel), 1), 20);
    slotRow = MULTICLASS_SPELL_SLOTS[effectiveLevel - 1];
  }

  if (slotRow) {
    for (let i = 0; i < slotRow.length; i++) {
      if (slotRow[i] > 0) {
        regularSlots.push({ level: i + 1, total: slotRow[i], used: 0 });
      }
    }
  }

  return { regularSlots, pactSlots };
}

// ─── Features ────────────────────────────────────────────

function computeFeatures(
  ids: CharacterIdentifiers,
  warnings: string[]
): CharacterFeature[] {
  const features: CharacterFeature[] = [];
  const seen = new Set<string>();

  const addFeature = (f: CharacterFeature) => {
    if (!seen.has(f.name)) {
      seen.add(f.name);
      features.push(f);
    }
  };

  // Parser-provided features first (they may have richer data)
  if (ids.additionalFeatures) {
    for (const f of ids.additionalFeatures) {
      addFeature(f);
    }
  }

  // Class features from DB
  for (const cls of ids.classes) {
    const dbFeatures = getClassFeatures(cls.name, cls.level);
    for (const dbf of dbFeatures) {
      addFeature({
        name: dbf.name,
        description: dbf.description,
        source: "class",
        sourceLabel: cls.name,
        requiredLevel: dbf.level,
        activationType: dbf.activationType,
      });
    }

    // Subclass as a feature
    if (cls.subclass && !seen.has(cls.subclass)) {
      // Check if DB has subclass features
      const classData = getClass(cls.name);
      const subclassData = classData?.subclasses.find(
        (s) => s.name.toLowerCase() === cls.subclass!.toLowerCase()
      );
      if (subclassData) {
        for (const sf of subclassData.features) {
          if (sf.level <= cls.level) {
            addFeature({
              name: sf.name,
              description: sf.description,
              source: "class",
              sourceLabel: `${cls.name} (${cls.subclass})`,
              requiredLevel: sf.level,
              activationType: sf.activationType,
            });
          }
        }
      }
      if (!seen.has(cls.subclass)) {
        addFeature({
          name: cls.subclass,
          description: `${cls.name} subclass`,
          source: "class",
          sourceLabel: cls.name,
          requiredLevel: 3,
        });
      }
    }
  }

  // Feat features from DB
  for (const feat of ids.additionalFeatures?.filter((f) => f.source === "feat") ?? []) {
    const dbFeat = getFeat(feat.name);
    if (dbFeat && !feat.description) {
      // Enrich with DB description
      const idx = features.findIndex((f) => f.name === feat.name);
      if (idx >= 0) {
        features[idx] = { ...features[idx], description: dbFeat.description };
      }
    }
  }

  // Species traits from DB
  const speciesLower = ids.race.toLowerCase().replace(/\s*\(.*\)/, "");
  const speciesData = getSpecies(speciesLower);
  if (speciesData) {
    for (const trait of speciesData.traits) {
      addFeature({
        name: trait.name,
        description: trait.description,
        source: "race",
        sourceLabel: ids.race,
        activationType: trait.activationType,
      });
    }
  }

  return features;
}

// ─── Class Resources ─────────────────────────────────────

function computeClassResources(ids: CharacterIdentifiers): ClassResource[] {
  const resources: ClassResource[] = [];
  const seen = new Set<string>();
  const totalLevel = ids.classes.reduce((sum, c) => sum + c.level, 0);
  const proficiencyBonus = Math.ceil(totalLevel / 4) + 1;

  for (const cls of ids.classes) {
    const classData = getClass(cls.name);
    if (!classData) continue;

    for (const template of classData.resources) {
      if (cls.level < template.levelAvailable) continue;
      if (seen.has(template.name)) continue;
      seen.add(template.name);

      const maxUses = resolveResourceUses(template, cls.level, ids.abilities);
      if (maxUses <= 0) continue;

      resources.push({
        name: template.name,
        maxUses,
        resetType: template.resetType,
        source: cls.name,
      });
    }
  }

  // Lucky feat: PB luck points, long rest
  const featureNames = (ids.additionalFeatures ?? []).map((f) => f.name.toLowerCase());
  if (featureNames.includes("lucky") && !seen.has("Luck Points")) {
    resources.push({
      name: "Luck Points",
      maxUses: proficiencyBonus,
      resetType: "long",
      source: "Lucky",
    });
  }

  return resources;
}

function resolveResourceUses(
  template: ClassResourceTemplate,
  level: number,
  abilities: AbilityScores
): number {
  // Check usesTable first (level-specific overrides)
  if (template.usesTable && template.usesTable[level] !== undefined) {
    return template.usesTable[level];
  }

  // Resolve uses value
  if (typeof template.uses === "number") {
    return template.uses;
  }

  // Ability modifier-based uses
  const abilityKey = template.uses.abilityMod.toLowerCase() as keyof AbilityScores;
  const mod = getAbilityMod(abilities[abilityKey] ?? 10);
  const minimum = template.uses.minimum ?? 1;
  return Math.max(minimum, mod);
}

// ─── Proficiencies ───────────────────────────────────────

function computeProficiencies(ids: CharacterIdentifiers): ProficiencyGroup {
  // If parser provided explicit proficiencies, use those
  if (ids.armorProficiencies || ids.weaponProficiencies) {
    return {
      armor: ids.armorProficiencies ?? [],
      weapons: ids.weaponProficiencies ?? [],
      tools: ids.toolProficiencies ?? [],
      other: ids.otherProficiencies ?? [],
    };
  }

  // Compute from DB
  const armorSet = new Set<string>();
  const weaponSet = new Set<string>();

  for (const cls of ids.classes) {
    const classData = getClass(cls.name);
    if (!classData) continue;
    for (const a of classData.armorProficiencies) armorSet.add(a);
    for (const w of classData.weaponProficiencies) weaponSet.add(w);
  }

  return {
    armor: [...armorSet],
    weapons: [...weaponSet],
    tools: ids.toolProficiencies ?? [],
    other: ids.otherProficiencies ?? [],
  };
}

// ─── Senses ──────────────────────────────────────────────

function computeSenses(
  ids: CharacterIdentifiers,
  proficiencyBonus: number,
  skills: SkillProficiency[]
): string[] {
  // If parser provided custom senses, use those directly
  if (ids.senses) return ids.senses;

  const senses: string[] = [];
  const wisMod = getAbilityMod(ids.abilities.wisdom);

  // Darkvision from species
  const speciesLower = ids.race.toLowerCase().replace(/\s*\(.*\)/, "");
  const speciesData = getSpecies(speciesLower);
  if (speciesData?.darkvision) {
    senses.push(`Darkvision ${speciesData.darkvision} ft.`);
  }

  // Passive Perception
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
