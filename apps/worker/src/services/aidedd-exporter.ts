/**
 * AideDD XML exporter.
 * Converts CharacterData → AideDD-compatible XML for import into
 * aidedd.org/dnd-creator/.
 *
 * AideDD XML uses custom elements under a <creator> root.
 * Format discovered from aidedd.org's fonctions21.js readFile() function.
 *
 * If the character was originally imported from AideDD (has aideddRawData as raw XML),
 * the export is lossless — we update only dynamic fields (currency, XP) in the raw XML.
 * For DDB-imported characters, we do best-effort mapping.
 */

import type { CharacterData, AbilityScores } from "@aidnd/shared/types";

// ─── Reverse Mapping Tables ───

/** Class name → AideDD class ID */
const CLASS_ID_MAP: Record<string, string> = {
  barbarian: "1",
  bard: "2",
  cleric: "3",
  druid: "4",
  fighter: "5",
  monk: "6",
  paladin: "7",
  ranger: "8",
  rogue: "9",
  sorcerer: "10",
  warlock: "11",
  wizard: "12",
};

/** Species name → AideDD species ID */
const SPECIES_ID_MAP: Record<string, string> = {
  human: "1",
  dwarf: "2",
  elf: "5",
  halfling: "4",
  gnome: "3",
  "half-elf": "6",
  "half-orc": "7",
  tiefling: "8",
  dragonborn: "9",
  orc: "10",
  goliath: "11",
  aasimar: "12",
};

/** Skill slug → AideDD skill ID */
const SKILL_ID_MAP: Record<string, number> = {
  acrobatics: 0,
  "animal-handling": 1,
  arcana: 2,
  athletics: 3,
  deception: 4,
  history: 5,
  insight: 6,
  intimidation: 7,
  investigation: 8,
  medicine: 9,
  nature: 10,
  perception: 11,
  performance: 12,
  persuasion: 13,
  religion: 14,
  "sleight-of-hand": 15,
  stealth: 16,
  survival: 17,
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function xmlEl(tag: string, value: string): string {
  return `  <${tag}>${escapeXml(value)}</${tag}>`;
}

export function exportToAideDDXml(character: CharacterData): {
  xml: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const s = character.static;
  const d = character.dynamic;

  // If we have preserved raw XML, use lossless path
  if (s.aideddRawData && typeof s.aideddRawData === "string" && s.aideddRawData.includes("<creator>")) {
    return exportFromRawXml(character);
  }

  // Best-effort export from CharacterStaticData (DDB or unknown source)
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<creator>");

  // Version
  lines.push(xmlEl("version", "0.7"));

  // Name
  lines.push(xmlEl("name", s.name));

  // Class
  const primaryClass = s.classes[0];
  const classId = CLASS_ID_MAP[primaryClass?.name.toLowerCase() ?? ""] ?? "0";
  lines.push(xmlEl("class1", classId));
  lines.push(xmlEl("level1", String(primaryClass?.level ?? 1)));
  lines.push(xmlEl("voie1", "0"));

  // Multiclass
  if (s.classes.length > 1) {
    const c2 = s.classes[1];
    const c2Id = CLASS_ID_MAP[c2.name.toLowerCase()] ?? "0";
    lines.push(xmlEl("class2", c2Id));
    lines.push(xmlEl("level2", String(c2.level)));
    lines.push(xmlEl("voie2", "0"));
  } else {
    lines.push(xmlEl("class2", "1"));
    lines.push(xmlEl("level2", "0"));
    lines.push(xmlEl("voie2", "0"));
  }

  // Display names
  lines.push(xmlEl("className", primaryClass?.name ?? ""));
  lines.push(xmlEl("subClassName", primaryClass?.subclass ?? ""));

  // XP
  lines.push(xmlEl("XP", String(d.xp)));

  // Species
  const speciesId = SPECIES_ID_MAP[s.race.toLowerCase()] ?? "0";
  lines.push(xmlEl("species", speciesId));
  lines.push(xmlEl("speciesName", s.race));
  lines.push(xmlEl("lineage", "0"));
  if (speciesId === "0") {
    warnings.push(`Species "${s.race}" could not be mapped to an AideDD ID. Import may require manual selection.`);
  }

  // Background
  lines.push(xmlEl("back", "0"));
  lines.push(xmlEl("backName", ""));

  // Languages
  const langNames = [
    "common", "dwarvish", "elvish", "giant", "gnomish",
    "goblin", "halfling", "orc", "abyssal", "celestial",
    "deep speech", "draconic", "infernal", "primordial",
    "sylvan", "undercommon",
  ];
  const langFlags = langNames.map((ln) =>
    s.languages.some((l) => l.toLowerCase() === ln) ? "1" : "0"
  );
  lines.push(xmlEl("lang", langFlags.join(",")));

  lines.push(xmlEl("align", "0"));
  lines.push(xmlEl("size", "Medium"));

  // Ability scores — store as base (no bonuses)
  const abilityTags: [keyof AbilityScores, string, string][] = [
    ["strength", "str", "bstr"],
    ["dexterity", "dex", "bdex"],
    ["constitution", "con", "bcon"],
    ["intelligence", "int", "bint"],
    ["wisdom", "wis", "bwis"],
    ["charisma", "cha", "bcha"],
  ];
  for (const [key, tag, btag] of abilityTags) {
    lines.push(xmlEl(tag, String(s.abilities[key])));
    lines.push(xmlEl(btag, "")); // No separate bonuses for DDB exports
  }

  // Feats
  const featNames = s.features.filter((f) => f.source === "feat").map((f) => f.name);
  lines.push(xmlEl("feats", featNames.join(",")));

  // Invocations (Warlock)
  const invocNames = s.features
    .filter((f) => f.source === "class" && f.description === "Eldritch Invocation")
    .map((f) => f.name);
  lines.push(xmlEl("invoc", invocNames.join(",")));

  // AideDD-required fields (their JS crashes with innerHTML errors if these are missing)
  lines.push(xmlEl("manoeuv", ""));
  lines.push(xmlEl("choice", ""));
  for (let i = 0; i <= 6; i++) lines.push(xmlEl(`option${i}`, ""));
  lines.push(xmlEl("ritual", ""));
  lines.push(xmlEl("custom", ""));
  lines.push(xmlEl("confLang", ""));

  // Skills
  const classSkills: number[] = [];
  const expertiseSkills: number[] = [];
  for (const skill of s.skills) {
    const id = SKILL_ID_MAP[skill.name];
    if (id === undefined) continue;
    if (skill.expertise) {
      expertiseSkills.push(id);
      classSkills.push(id);
    } else if (skill.proficient) {
      classSkills.push(id);
    }
  }
  lines.push(xmlEl("skillE", expertiseSkills.length > 0 ? expertiseSkills.join(",") : "0"));
  lines.push(xmlEl("skillC", classSkills.join(",")));
  lines.push(xmlEl("skillB", ""));

  // Armor
  const armorItems = d.inventory.filter((i) => i.type === "Armor" || i.type === "Shield");
  const bodyArmor = armorItems.find((i) => i.type === "Armor")?.name ?? "";
  const shield = armorItems.find((i) => i.type === "Shield")?.name ?? "";
  lines.push(xmlEl("armor", [bodyArmor, shield].join(",")));

  // Weapons
  const weapons = d.inventory.filter((i) => i.type === "Weapon");
  const weaponNames = weapons.slice(0, 6).map((w) => w.name);
  while (weaponNames.length < 6) weaponNames.push("-");
  lines.push(xmlEl("weapons", weaponNames.join(",")));

  // Tools
  lines.push(xmlEl("tool", s.proficiencies.tools.join(",")));

  // HP — reconstruct per-level array (approximate)
  const conMod = Math.floor((s.abilities.constitution - 10) / 2);
  const totalLevel = s.classes.reduce((sum, c) => sum + c.level, 0);
  const hitDice = getHitDice(primaryClass?.name ?? "fighter");
  const hpArray = ["0", String(hitDice)]; // mode=0, level 1 = max
  const avgHP = Math.ceil(hitDice / 2) + 1;
  for (let i = 2; i <= totalLevel; i++) {
    hpArray.push(String(avgHP));
  }
  lines.push(xmlEl("hp", hpArray.join(",")));

  // Equipment text
  const gearItems = d.inventory.filter((i) => i.type !== "Armor" && i.type !== "Shield" && i.type !== "Weapon");
  const equipText = gearItems
    .map((i) => (i.quantity > 1 ? `${i.name} (${i.quantity})` : i.name))
    .join(", ");
  lines.push(xmlEl("equipment", equipText));

  // Appearance & Backstory (always emit — aidedd.org crashes if missing)
  lines.push(xmlEl("appearance", s.appearance?.gender ?? ""));
  lines.push(xmlEl("backstory", s.traits.personalityTraits ?? ""));

  // Attunement
  const attunedItems = d.inventory.filter((i) => i.isAttuned);
  for (let i = 0; i < 3; i++) {
    lines.push(xmlEl(`attun${i + 1}`, attunedItems[i]?.name ?? ""));
  }

  // Currency
  lines.push(xmlEl("cp", String(d.currency.cp)));
  lines.push(xmlEl("sp", String(d.currency.sp)));
  lines.push(xmlEl("ep", String(d.currency.ep)));
  lines.push(xmlEl("gp", String(d.currency.gp)));
  lines.push(xmlEl("pp", String(d.currency.pp)));

  // Spells by level (class 1)
  for (let level = 0; level <= 9; level++) {
    const spellsAtLevel = s.spells
      .filter((sp) => sp.level === level && sp.sourceClass === (primaryClass?.name ?? ""))
      .map((sp) => sp.name);
    lines.push(xmlEl(`spells${level}`, spellsAtLevel.join(",")));
  }

  // Spells by level (class 2) — always emit spells10-19 (aidedd.org crashes if missing)
  const c2Name = s.classes.length > 1 ? s.classes[1].name : "";
  for (let level = 0; level <= 9; level++) {
    const spellsAtLevel = c2Name
      ? s.spells.filter((sp) => sp.level === level && sp.sourceClass === c2Name).map((sp) => sp.name)
      : [];
    lines.push(xmlEl(`spells${10 + level}`, spellsAtLevel.join(",")));
  }

  // Cantrip attack entries (cantrips4-6 store weapon-like cantrip data: name|bonus|damage|note)
  for (let i = 4; i <= 6; i++) lines.push(xmlEl(`cantrips${i}`, ""));

  // Spell notes (aidedd.org reads spellNote0 through spellNote74)
  for (let i = 0; i < 75; i++) lines.push(xmlEl(`spellNote${i}`, ""));

  lines.push("</creator>");

  // Preserve full inventory data (including AI-granted item descriptions) as a comment
  // after </creator> so aidedd.org's parser ignores it completely.
  const itemsWithData = d.inventory.filter((i) => i.description || i.isMagicItem || i.rarity);
  if (itemsWithData.length > 0) {
    const encoded = btoa(encodeURIComponent(JSON.stringify(itemsWithData)));
    lines.push(`<!-- AIDND_INVENTORY:${encoded} -->`);
  }

  if (!s.source || s.source === "ddb") {
    warnings.push("Character was imported from D&D Beyond. Some AideDD-specific fields (subclass IDs, background ID) may not map correctly.");
  }

  return { xml: lines.join("\n"), warnings };
}

/**
 * Export using preserved raw AideDD XML — lossless roundtrip.
 * Updates only the fields that could have changed during gameplay (currency, XP).
 */
function exportFromRawXml(character: CharacterData): {
  xml: string;
  warnings: string[];
} {
  let xml = character.static.aideddRawData!;
  const d = character.dynamic;

  // Update dynamic fields in the raw XML
  xml = updateXmlElement(xml, "cp", String(d.currency.cp));
  xml = updateXmlElement(xml, "sp", String(d.currency.sp));
  xml = updateXmlElement(xml, "ep", String(d.currency.ep));
  xml = updateXmlElement(xml, "gp", String(d.currency.gp));
  xml = updateXmlElement(xml, "pp", String(d.currency.pp));
  xml = updateXmlElement(xml, "XP", String(d.xp));

  // Preserve full inventory data as a comment after </creator>
  const itemsWithData = d.inventory.filter((i) => i.description || i.isMagicItem || i.rarity);
  if (itemsWithData.length > 0) {
    const encoded = btoa(encodeURIComponent(JSON.stringify(itemsWithData)));
    // Remove old comment if present, then append new one
    xml = xml.replace(/\n?<!-- AIDND_INVENTORY:[\s\S]*? -->/, "");
    // Also remove old <aidnd_inventory> element if upgrading from previous format
    xml = xml.replace(/<aidnd_inventory>[\s\S]*?<\/aidnd_inventory>\n?/, "");
    xml = xml.trimEnd() + `\n<!-- AIDND_INVENTORY:${encoded} -->`;
  }

  return { xml, warnings: [] };
}

/** Replace the content of an XML element in a string, or append it before </creator> */
function updateXmlElement(xml: string, tag: string, value: string): string {
  const regex = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "i");
  const replacement = `<${tag}>${escapeXml(value)}</${tag}>`;
  if (regex.test(xml)) {
    return xml.replace(regex, replacement);
  }
  // If element doesn't exist, insert before </creator>
  return xml.replace("</creator>", `  ${replacement}\n</creator>`);
}

function getHitDice(className: string): number {
  const hitDice: Record<string, number> = {
    barbarian: 12, bard: 8, cleric: 8, druid: 8, fighter: 10,
    monk: 8, paladin: 10, ranger: 10, rogue: 8, sorcerer: 6,
    warlock: 8, wizard: 6,
  };
  return hitDice[className.toLowerCase()] ?? 8;
}
