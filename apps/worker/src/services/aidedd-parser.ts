/**
 * AideDD XML character parser.
 * Parses XML exported from aidedd.org/dnd-creator/ into our CharacterData format.
 *
 * AideDD XML uses custom elements under a <creator> root (NOT HTML <input> tags).
 * Format discovered from aidedd.org's fonctions21.js readFile() function.
 *
 * AideDD stores raw form data (numeric IDs, CSV lists) and display names.
 * Computed stats (AC, HP modifiers, skill bonuses) are NOT in the XML —
 * the shared character builder computes everything from the D&D 2024 database.
 */

import type {
  CharacterClass,
  CharacterSpell,
  CharacterFeature,
  InventoryItem,
  AbilityScores,
  Currency,
  CharacterTraits,
  CharacterAppearance,
  AdvantageEntry,
} from "@aidnd/shared/types";
import type { CharacterData } from "@aidnd/shared/types";
import { getSpecies, getArmor, getClass } from "@aidnd/shared/data";
import { buildCharacter } from "@aidnd/shared/builders";
import type { CharacterIdentifiers } from "@aidnd/shared/builders";

// ─── AideDD Mapping Tables ───

/** AideDD skill IDs → our skill slugs (alphabetical D&D 5e order) */
const AIDEDD_SKILL_MAP: Record<number, { name: string; ability: keyof AbilityScores }> = {
  0: { name: "acrobatics", ability: "dexterity" },
  1: { name: "animal-handling", ability: "wisdom" },
  2: { name: "arcana", ability: "intelligence" },
  3: { name: "athletics", ability: "strength" },
  4: { name: "deception", ability: "charisma" },
  5: { name: "history", ability: "intelligence" },
  6: { name: "insight", ability: "wisdom" },
  7: { name: "intimidation", ability: "charisma" },
  8: { name: "investigation", ability: "intelligence" },
  9: { name: "medicine", ability: "wisdom" },
  10: { name: "nature", ability: "intelligence" },
  11: { name: "perception", ability: "wisdom" },
  12: { name: "performance", ability: "charisma" },
  13: { name: "persuasion", ability: "charisma" },
  14: { name: "religion", ability: "intelligence" },
  15: { name: "sleight-of-hand", ability: "dexterity" },
  16: { name: "stealth", ability: "dexterity" },
  17: { name: "survival", ability: "wisdom" },
};

/**
 * AideDD language selection IDs → language names.
 * The <lang> field stores per-slot selection IDs (NOT bitmask flags).
 */
const AIDEDD_LANG_ID_MAP: Record<number, string> = {
  1: "Draconic",
  2: "Dwarvish",
  3: "Elvish",
  4: "Giant",
  5: "Gnomish",
  6: "Goblin",
  7: "Halfling",
  8: "Orc",
  9: "Common Sign Language",
};

/** Subclasses that grant third-caster spellcasting */
const THIRD_CASTER_SUBCLASSES: Record<string, keyof AbilityScores> = {
  "eldritch knight": "intelligence",
  "arcane trickster": "intelligence",
};

// ─── Helpers ───

function getAbilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/** Decode XML entities */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

/** Extract text content of an XML element by tag name (CF Workers don't have DOMParser) */
function getXml(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? decodeXmlEntities(match[1]) : "";
}

/** Extract text content as integer */
function getXmlInt(xml: string, tag: string): number {
  const val = parseInt(getXml(xml, tag), 10);
  return isNaN(val) ? 0 : val;
}

function getClassHitDice(className: string): number {
  const cls = getClass(className);
  return cls?.hitDice ?? 8;
}

// ─── Main Parser ───

export function parseAideDDCharacter(xmlString: string): {
  character: CharacterData;
  warnings: string[];
} {
  const warnings: string[] = [];

  // ─── Version Check ───
  const version = getXml(xmlString, "version");
  if (version && version !== "0.7") {
    warnings.push(`AideDD XML version "${version}" detected (expected 0.7). Some fields may not parse correctly.`);
  }

  // ─── Basic Info ───
  const name = getXml(xmlString, "name") || "Unnamed Character";
  const className = getXml(xmlString, "className") || "Unknown";
  const subclassName = getXml(xmlString, "subClassName") || "";
  const speciesName = getXml(xmlString, "speciesName") || "Unknown";
  const backgroundName = getXml(xmlString, "backName") || "";

  // ─── Class & Level ───
  const level1 = getXmlInt(xmlString, "level1") || 1;
  const level2 = getXmlInt(xmlString, "level2");
  const class1Id = getXmlInt(xmlString, "class1");
  const class2Id = getXmlInt(xmlString, "class2");

  const CLASS_ID_TO_NAME: Record<number, string> = {
    1: "Barbarian", 2: "Bard", 3: "Cleric", 4: "Druid", 5: "Fighter",
    6: "Monk", 7: "Paladin", 8: "Ranger", 9: "Rogue", 10: "Sorcerer",
    11: "Warlock", 12: "Wizard",
  };

  const isMulticlass = level2 > 0 && class2Id > 0;
  const class1Name = isMulticlass
    ? (CLASS_ID_TO_NAME[class1Id] ?? className)
    : className;
  const subclass1Name = isMulticlass
    ? (subclassName.includes("/") ? subclassName.split("/")[0].trim() : subclassName)
    : subclassName;

  const classes: CharacterClass[] = [
    { name: class1Name, level: level1, subclass: subclass1Name || undefined },
  ];

  let class2Name = "";
  let subclass2Name = "";
  if (isMulticlass) {
    class2Name = CLASS_ID_TO_NAME[class2Id] ?? `Class ${class2Id}`;
    subclass2Name = subclassName.includes("/") ? subclassName.split("/")[1].trim() : "";
    classes.push({ name: class2Name, level: level2, subclass: subclass2Name || undefined });
  }

  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0);
  const profBonus = getProficiencyBonus(totalLevel);

  // ─── Ability Scores ───
  const abilityTags: [string, keyof AbilityScores][] = [
    ["str", "strength"], ["dex", "dexterity"], ["con", "constitution"],
    ["int", "intelligence"], ["wis", "wisdom"], ["cha", "charisma"],
  ];
  const bonusTags = ["bstr", "bdex", "bcon", "bint", "bwis", "bcha"];

  const abilities: AbilityScores = {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  };

  for (let i = 0; i < abilityTags.length; i++) {
    const [tag, key] = abilityTags[i];
    const rawScore = getXmlInt(xmlString, tag) || 10;
    const bonusStr = getXml(xmlString, bonusTags[i]).replace(/\+/g, "");
    const bonus = bonusStr ? parseInt(bonusStr, 10) || 0 : 0;
    abilities[key] = rawScore + bonus;
  }

  // ─── Feat ASI Bonuses ───
  const ABILITY_INDEX_MAP: (keyof AbilityScores)[] = [
    "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
  ];
  let resilientAbility: keyof AbilityScores | null = null;
  const ASI_FEATS = new Set([
    "ability score improvement", "war caster", "resilient", "alert",
    "actor", "athlete", "charger", "chef", "crusher", "defensive duelist",
    "durable", "fey-touched", "grappler", "heavily armored", "heavy armor master",
    "keen mind", "lightly armored", "moderately armored", "observant",
    "piercer", "poisoner", "shadow-touched", "skill expert", "slasher",
    "speedy", "telekinetic", "telepathic", "weapon master",
  ]);
  const featsFieldEarly = getXml(xmlString, "feats");
  if (featsFieldEarly) {
    const option1Field = getXml(xmlString, "option1");
    if (option1Field) {
      const featEntries = featsFieldEarly.split(",");
      const optionEntries = option1Field.split(",");
      for (let i = 0; i < featEntries.length; i++) {
        const featName = featEntries[i].trim().toLowerCase();
        if (!featName) continue;
        if (featName === "ability score improvement") {
          const asiVal = parseInt(optionEntries[i]?.trim() ?? "", 10);
          if (!isNaN(asiVal) && asiVal >= 0 && asiVal <= 5) {
            abilities[ABILITY_INDEX_MAP[asiVal]] += 1;
          }
          const option2Field = getXml(xmlString, "option2");
          if (option2Field) {
            const opt2Entries = option2Field.split(",");
            const asi2Val = parseInt(opt2Entries[i]?.trim() ?? "", 10);
            if (!isNaN(asi2Val) && asi2Val >= 0 && asi2Val <= 5) {
              abilities[ABILITY_INDEX_MAP[asi2Val]] += 1;
            }
          }
        } else if (ASI_FEATS.has(featName)) {
          const asiVal = parseInt(optionEntries[i]?.trim() ?? "", 10);
          if (!isNaN(asiVal) && asiVal >= 0 && asiVal <= 5) {
            abilities[ABILITY_INDEX_MAP[asiVal]] += 1;
            if (featName === "resilient") {
              resilientAbility = ABILITY_INDEX_MAP[asiVal];
            }
          }
        }
      }
    }
  }

  const conMod = getAbilityMod(abilities.constitution);

  // ─── HP ───
  const hpField = getXml(xmlString, "hp");
  let maxHP = 0;
  if (hpField) {
    const hpParts = hpField.split(",");
    for (let i = 1; i <= totalLevel; i++) {
      const val = parseInt(hpParts[i] ?? "0", 10);
      maxHP += isNaN(val) ? 0 : val;
    }
    maxHP += conMod * totalLevel;
    if (speciesName.toLowerCase() === "dwarf") {
      maxHP += totalLevel;
    }
  }
  if (maxHP <= 0) {
    const hitDice = getClassHitDice(class1Name);
    maxHP = hitDice + conMod;
    for (let i = 2; i <= totalLevel; i++) {
      maxHP += Math.ceil(hitDice / 2) + 1 + conMod;
    }
    warnings.push("HP was estimated from class hit dice (no hp field in XML).");
  }

  // ─── Skills ───
  const { skillProficiencies, skillExpertise } = extractSkills(xmlString, class1Name);

  // ─── Saving Throws ───
  const saveProficiencies = extractSaveProficiencies(classes, resilientAbility, warnings, class1Name);

  // ─── Languages ───
  const languages = extractLanguages(xmlString);

  // ─── Features (feats + invocations) ───
  const additionalFeatures = extractFeatures(xmlString, classes, class1Name, subclass1Name, level1, class2Name, subclass2Name, level2);

  // ─── Spells ───
  const spells = extractSpells(xmlString, classes, class1Name, subclass1Name, class2Name);

  // ─── Equipment / Inventory ───
  const equipment = extractInventory(xmlString);

  // ─── Currency ───
  const currency: Currency = {
    cp: getXmlInt(xmlString, "cp"),
    sp: getXmlInt(xmlString, "sp"),
    ep: getXmlInt(xmlString, "ep"),
    gp: getXmlInt(xmlString, "gp"),
    pp: getXmlInt(xmlString, "pp"),
  };

  // ─── Senses (AideDD-specific — builder would use DB darkvision, but AideDD has
  //     a hardcoded set since the XML doesn't specify darkvision) ───
  const senses = computeSenses(abilities, skillProficiencies, skillExpertise, profBonus, speciesName);

  // ─── Traits & Appearance ───
  const traits: CharacterTraits = {};
  const backstory = getXml(xmlString, "backstory");
  if (backstory) {
    traits.personalityTraits = backstory;
  }

  const appearance: CharacterAppearance | undefined = (() => {
    const app = getXml(xmlString, "appearance");
    if (!app) return undefined;
    return { gender: app };
  })();

  // ─── Advantages (species-based) ───
  const advantages: AdvantageEntry[] = [];
  const speciesLower = speciesName.toLowerCase().replace(/\s*\(.*\)/, "");
  if (speciesLower === "halfling") {
    advantages.push({ type: "advantage", subType: "frightened-saving-throws", source: "Brave" });
  }
  if (speciesLower === "dwarf") {
    advantages.push({ type: "advantage", subType: "saving-throws", restriction: "Against Poison", source: "Dwarven Resilience" });
  }
  if (speciesLower === "elf" || speciesLower === "half-elf") {
    advantages.push({ type: "advantage", subType: "saving-throws", restriction: "Against being charmed", source: "Fey Ancestry" });
  }

  // ─── Tool proficiencies ───
  const toolProficiencies: string[] = [];
  const toolField = getXml(xmlString, "tool");
  if (toolField) {
    const tools = toolField.split(",").map((t) => t.trim()).filter((t) => t);
    toolProficiencies.push(...new Set(tools));
  }

  // ─── Defense fighting style check for AC ───
  // Pass as additional feature so the builder can detect it
  if (featsFieldEarly) {
    const hasDefense = featsFieldEarly.split(",").some((f) => f.trim().toLowerCase() === "defense");
    if (hasDefense && !additionalFeatures.some((f) => f.name === "Defense")) {
      additionalFeatures.push({
        name: "Defense",
        description: "Fighting Style: Defense",
        source: "feat",
        sourceLabel: "Defense",
      });
    }
  }

  // ─── Build CharacterIdentifiers ───
  const identifiers: CharacterIdentifiers = {
    name,
    race: speciesName,
    classes,
    background: backgroundName || undefined,
    abilities,
    maxHP,
    skillProficiencies,
    skillExpertise,
    saveProficiencies,
    spells,
    additionalFeatures,
    equipment,
    languages,
    toolProficiencies,
    traits,
    appearance,
    currency,
    advantages,
    senses,
    source: "aidedd",
    aideddRawData: xmlString,
    initialDynamic: {
      xp: getXmlInt(xmlString, "XP"),
    },
  };

  const result = buildCharacter(identifiers);

  // Merge builder warnings with parser warnings
  result.warnings.unshift(...warnings);

  return result;
}

// ─── Extraction Helpers ───

function extractSkills(
  xmlString: string,
  class1Name: string
): { skillProficiencies: string[]; skillExpertise: string[] } {
  const skillBField = getXml(xmlString, "skillB");
  const skillCField = getXml(xmlString, "skillC");
  const skillEField = getXml(xmlString, "skillE");

  const proficientSkillIds = new Set<number>();
  const expertiseSkillIds = new Set<number>();
  const lcClass = class1Name.toLowerCase();

  // skillB = background skills
  if (skillBField) {
    for (const id of skillBField.split(",")) {
      const num = parseInt(id.trim(), 10);
      if (!isNaN(num)) proficientSkillIds.add(num);
    }
  }

  // skillC = class skills
  const CLASS_SKILL_COUNT: Record<string, number> = {
    barbarian: 3, bard: 3, cleric: 2, druid: 2, fighter: 2,
    monk: 2, paladin: 2, ranger: 3, rogue: 4, sorcerer: 2,
    warlock: 2, wizard: 2,
  };
  if (skillCField) {
    const parts = skillCField.split(",");
    const maxSkills = CLASS_SKILL_COUNT[lcClass] ?? parts.length;
    for (let i = 0; i < Math.min(parts.length, maxSkills); i++) {
      const num = parseInt(parts[i].trim(), 10);
      if (!isNaN(num)) proficientSkillIds.add(num);
    }
  }

  // skillE = species skill
  if (skillEField) {
    for (const id of skillEField.split(",")) {
      const num = parseInt(id.trim(), 10);
      if (!isNaN(num) && num > 0) {
        proficientSkillIds.add(num);
      }
    }
  }

  // Bonus skill proficiencies from class features
  const choiceField = getXml(xmlString, "choice");
  if (choiceField) {
    const choiceEntries = choiceField.split(",");
    const optionFields = [
      getXml(xmlString, "option1").split(","),
      getXml(xmlString, "option2").split(","),
      getXml(xmlString, "option3").split(","),
    ];
    for (let i = 0; i < choiceEntries.length; i++) {
      if (choiceEntries[i].trim() === "bonusProf") {
        for (const optionValues of optionFields) {
          const skillId = parseInt(optionValues[i]?.trim() ?? "", 10);
          if (!isNaN(skillId) && skillId >= 0 && skillId <= 17) {
            proficientSkillIds.add(skillId);
          }
        }
      }
    }
  }

  // Expertise from option4, option5
  for (const optTag of ["option4", "option5"]) {
    const optField = getXml(xmlString, optTag);
    if (optField) {
      const parts = optField.split(",");
      for (const part of parts) {
        const num = parseInt(part.trim(), 10);
        if (!isNaN(num) && num > 0) {
          expertiseSkillIds.add(num);
          proficientSkillIds.add(num);
        }
      }
    }
  }

  // Convert IDs to skill slugs
  const skillProficiencies: string[] = [];
  const skillExpertise: string[] = [];

  for (const id of proficientSkillIds) {
    const skill = AIDEDD_SKILL_MAP[id];
    if (skill) skillProficiencies.push(skill.name);
  }
  for (const id of expertiseSkillIds) {
    const skill = AIDEDD_SKILL_MAP[id];
    if (skill) skillExpertise.push(skill.name);
  }

  return { skillProficiencies, skillExpertise };
}

function extractSaveProficiencies(
  classes: CharacterClass[],
  resilientAbility: keyof AbilityScores | null,
  warnings: string[],
  class1Name: string
): (keyof AbilityScores)[] {
  const saveProficiencies = new Set<keyof AbilityScores>();
  for (const cls of classes) {
    const classData = getClass(cls.name);
    if (classData) {
      for (const s of classData.savingThrows) {
        saveProficiencies.add(s.toLowerCase() as keyof AbilityScores);
      }
    }
  }
  if (saveProficiencies.size === 0) {
    warnings.push(`Unknown class "${class1Name}" — saving throw proficiencies may be inaccurate.`);
  }
  if (resilientAbility) {
    saveProficiencies.add(resilientAbility);
  }
  return [...saveProficiencies];
}

function extractLanguages(xmlString: string): string[] {
  const langField = getXml(xmlString, "lang");
  const languages: string[] = ["Common"];
  if (langField) {
    const langIds = langField.split(",");
    for (const idStr of langIds) {
      const id = parseInt(idStr.trim(), 10);
      if (!isNaN(id) && id > 0 && AIDEDD_LANG_ID_MAP[id]) {
        const langName = AIDEDD_LANG_ID_MAP[id];
        if (!languages.includes(langName)) {
          languages.push(langName);
        }
      }
    }
  }
  return languages;
}

function extractFeatures(
  xmlString: string,
  classes: CharacterClass[],
  class1Name: string,
  subclass1Name: string,
  level1: number,
  class2Name: string,
  subclass2Name: string,
  level2: number
): CharacterFeature[] {
  const features: CharacterFeature[] = [];

  // Feats
  const featsField = getXml(xmlString, "feats");
  if (featsField) {
    const featNames = featsField.split(",").map((f) => f.trim()).filter((f) => f);
    for (const featName of featNames) {
      if (features.some((f) => f.name === featName)) continue;
      features.push({
        name: featName,
        description: "",
        source: "feat",
        sourceLabel: featName,
      });
    }
  }

  // Warlock invocations
  const invocField = getXml(xmlString, "invoc");
  if (invocField) {
    const invocNames = invocField.split(",").map((f) => f.trim()).filter((f) => f);
    for (const invocName of invocNames) {
      if (features.some((f) => f.name === invocName)) continue;
      features.push({
        name: invocName,
        description: "Eldritch Invocation",
        source: "class",
        sourceLabel: "Warlock",
      });
    }
  }

  return features;
}

function extractSpells(
  xmlString: string,
  classes: CharacterClass[],
  class1Name: string,
  subclass1Name: string,
  class2Name: string
): CharacterSpell[] {
  const spells: CharacterSpell[] = [];

  // Class 1 spells: <spells0> = cantrips, <spells1> = level 1, ..., <spells9> = level 9
  for (let levelIdx = 0; levelIdx <= 9; levelIdx++) {
    const spellsField = getXml(xmlString, `spells${levelIdx}`);
    if (!spellsField) continue;
    const spellNames = spellsField.split(",").map((s) => s.trim()).filter((s) => s);
    for (const spellName of spellNames) {
      if (spells.some((s) => s.name.toLowerCase() === spellName.toLowerCase())) continue;
      spells.push({
        name: spellName,
        level: levelIdx,
        prepared: true,
        alwaysPrepared: false,
        spellSource: "class",
        knownByClass: true,
        sourceClass: class1Name,
      });
    }
  }

  // Class 2 spells: <spells10> = cantrips, <spells11> = level 1, ..., <spells19> = level 9
  if (class2Name) {
    for (let levelIdx = 0; levelIdx <= 9; levelIdx++) {
      const spellsField = getXml(xmlString, `spells${10 + levelIdx}`);
      if (!spellsField) continue;
      const spellNames = spellsField.split(",").map((s) => s.trim()).filter((s) => s);
      for (const spellName of spellNames) {
        if (spells.some((s) => s.name.toLowerCase() === spellName.toLowerCase())) continue;
        spells.push({
          name: spellName,
          level: levelIdx,
          prepared: true,
          alwaysPrepared: false,
          spellSource: "class",
          knownByClass: true,
          sourceClass: class2Name,
        });
      }
    }
  }

  return spells;
}

function extractInventory(xmlString: string): InventoryItem[] {
  const inventory: InventoryItem[] = [];

  // Parse <armor> CSV
  const armorField = getXml(xmlString, "armor");
  if (armorField) {
    const parts = armorField.split(",").map((s) => s.trim());
    if (parts[0] && !parts[0].toLowerCase().startsWith("without")) {
      const armorData = getArmor(parts[0].toLowerCase());
      inventory.push({
        name: parts[0],
        equipped: true,
        quantity: 1,
        type: "Armor",
        armorClass: armorData && armorData.category !== "shield" ? armorData.ac : undefined,
      });
    }
    if (parts[1] && !parts[1].toLowerCase().startsWith("without")) {
      const isShield = parts[1].toLowerCase().includes("shield");
      inventory.push({
        name: parts[1],
        equipped: true,
        quantity: 1,
        type: isShield ? "Shield" : "Armor",
        armorClass: isShield ? 2 : undefined,
      });
    }
  }

  // Parse <weapons> CSV (pairs of name, qty)
  const weaponsField = getXml(xmlString, "weapons");
  if (weaponsField) {
    const parts = weaponsField.split(",").map((s) => s.trim());
    for (let i = 0; i < parts.length; i += 2) {
      const weaponName = parts[i];
      const qtyStr = parts[i + 1];
      if (!weaponName || weaponName === "-") continue;
      const qty = parseInt(qtyStr ?? "1", 10) || 1;
      if (inventory.some((inv) => inv.name.toLowerCase() === weaponName.toLowerCase())) continue;
      inventory.push({
        name: weaponName,
        equipped: true,
        quantity: qty,
        type: "Weapon",
      });
    }
  }

  // Parse cantrip attack weapons
  for (let i = 4; i <= 6; i++) {
    const cantripData = getXml(xmlString, `cantrips${i}`);
    if (!cantripData) continue;
    const segments = cantripData.split("|");
    const cantripName = segments[0]?.trim();
    if (!cantripName) continue;
    inventory.push({
      name: cantripName,
      equipped: true,
      quantity: 1,
      type: "Weapon",
      damage: segments[2]?.trim() || undefined,
      attackBonus: segments[1] ? parseInt(segments[1].replace("+", ""), 10) || undefined : undefined,
      properties: segments[3] ? [segments[3].trim()] : undefined,
    });
  }

  // Parse <equipment> free text
  const equipField = getXml(xmlString, "equipment");
  if (equipField) {
    const lines = equipField.split("\n").map((l) => l.trim()).filter((l) => l);
    for (const line of lines) {
      const items = line.split(",").map((s) => s.trim()).filter((s) => s);
      for (const itemStr of items) {
        const normalized = itemStr.replace(/\s*\(\d+\)\s*$/, "").trim();
        if (inventory.some((inv) => inv.name.toLowerCase() === normalized.toLowerCase())) continue;

        const qtyMatch = itemStr.match(/^(.+?)\s*\((\d+)\)$/);
        const itemName = qtyMatch ? qtyMatch[1].trim() : itemStr;
        const itemQty = qtyMatch ? parseInt(qtyMatch[2], 10) : 1;

        inventory.push({
          name: itemName,
          equipped: false,
          quantity: itemQty,
          type: "Gear",
        });
      }
    }
  }

  // Attunement items
  const attunedNames: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const attunName = getXml(xmlString, `attun${i}`);
    if (attunName) attunedNames.push(attunName.toLowerCase());
  }
  for (const item of inventory) {
    if (attunedNames.includes(item.name.toLowerCase())) {
      item.attunement = true;
      item.isAttuned = true;
      item.isMagicItem = true;
    }
  }
  for (let i = 1; i <= 3; i++) {
    const attunName = getXml(xmlString, `attun${i}`);
    if (!attunName) continue;
    if (!inventory.some((inv) => inv.name.toLowerCase() === attunName.toLowerCase())) {
      inventory.push({
        name: attunName,
        equipped: true,
        quantity: 1,
        type: "Gear",
        attunement: true,
        isAttuned: true,
        isMagicItem: true,
      });
    }
  }

  // Restore item descriptions from AIDND_INVENTORY comment
  const inventoryCommentMatch = xmlString.match(/<!-- AIDND_INVENTORY:([\s\S]*?) -->/);
  const legacyInventoryJson = getXml(xmlString, "aidnd_inventory");
  const inventoryJson = inventoryCommentMatch
    ? decodeURIComponent(atob(inventoryCommentMatch[1].trim()))
    : legacyInventoryJson || null;

  if (inventoryJson) {
    try {
      const savedItems = JSON.parse(inventoryJson) as InventoryItem[];
      const savedMap = new Map(savedItems.map((item) => [item.name, item]));
      for (const item of inventory) {
        const saved = savedMap.get(item.name);
        if (saved?.description) {
          item.description = saved.description;
        }
      }
      for (const saved of savedItems) {
        if (!inventory.some((i) => i.name === saved.name)) {
          inventory.push(saved);
        }
      }
    } catch {
      // Malformed data — ignore
    }
  }

  return inventory;
}

function computeSenses(
  abilities: AbilityScores,
  skillProficiencies: string[],
  skillExpertise: string[],
  profBonus: number,
  speciesName: string
): string[] {
  const senses: string[] = [];
  const wisMod = getAbilityMod(abilities.wisdom);
  const isProfPerception = skillProficiencies.includes("perception");
  const isExpertPerception = skillExpertise.includes("perception");
  const passivePerception =
    10 + wisMod + (isProfPerception ? profBonus : 0) + (isExpertPerception ? profBonus : 0);
  senses.push(`Passive Perception ${passivePerception}`);

  // Check species DB for darkvision first
  const speciesLower = speciesName.toLowerCase().replace(/\s*\(.*\)/, "");
  const speciesData = getSpecies(speciesLower);
  if (speciesData?.darkvision) {
    senses.push(`Darkvision ${speciesData.darkvision} ft.`);
  } else {
    // Fallback: hardcoded species set for cases not in DB
    const darkvisionSpecies = new Set(["elf", "half-elf", "dwarf", "gnome", "half-orc", "tiefling", "orc", "dragonborn"]);
    if (darkvisionSpecies.has(speciesLower)) {
      senses.push("Darkvision 60 ft.");
    }
  }

  return senses;
}
