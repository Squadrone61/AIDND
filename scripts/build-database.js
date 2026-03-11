#!/usr/bin/env node

/**
 * Build D&D 2024 Database from 5etools structured JSON
 *
 * Fetches from 5etools GitHub mirror, transforms to our schema,
 * writes JSON files to packages/shared/src/data/
 *
 * Usage: node scripts/build-database.js
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "packages", "shared", "src", "data");

const BASE_URL =
  "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data";

// Sources we want (2024 books primarily)
const WANTED_SOURCES = new Set([
  "XPHB", // PHB 2024
  "XDMG", // DMG 2024
  "XMM",  // MM 2024
  "PHB",  // PHB 2014 (fallback)
  "MM",   // MM 2014 (fallback)
  "DMG",  // DMG 2014 (fallback)
  "XGE",  // Xanathar's
  "TCE",  // Tasha's
]);

// Prefer 2024 sources over older
const SOURCE_PRIORITY = { XPHB: 0, XDMG: 1, XMM: 2, TCE: 3, XGE: 4, PHB: 5, DMG: 6, MM: 7 };

function sourcePriority(src) {
  return SOURCE_PRIORITY[src] ?? 99;
}

// ─── Fetch helpers ──────────────────────────────────────

async function fetchJSON(url) {
  console.log(`  Fetching ${url.replace(BASE_URL, "5etools:")}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

// 5etools entries[] → flat description string
function entriesToString(entries, depth = 0) {
  if (!entries) return "";
  return entries
    .map((e) => {
      if (typeof e === "string") return e;
      if (e.type === "entries" || e.type === "section") {
        const header = e.name ? `**${e.name}.** ` : "";
        return header + entriesToString(e.entries, depth + 1);
      }
      if (e.type === "list") {
        return (e.items || [])
          .map((i) => `• ${typeof i === "string" ? i : entriesToString([i], depth + 1)}`)
          .join("\n");
      }
      if (e.type === "table") {
        const rows = (e.rows || []).map((r) =>
          r.map((c) => (typeof c === "string" ? c : c?.entry || c?.text || JSON.stringify(c))).join(" | ")
        );
        const header = (e.colLabels || []).join(" | ");
        return [header, ...rows].filter(Boolean).join("\n");
      }
      if (e.type === "item") {
        return `**${e.name || ""}.** ${entriesToString(e.entries || [e.entry], depth + 1)}`;
      }
      if (e.type === "inset" || e.type === "insetReadaloud") {
        return entriesToString(e.entries, depth + 1);
      }
      if (e.type === "quote") {
        return `"${entriesToString(e.entries, depth + 1)}"`;
      }
      if (e.type === "cell") {
        return e.entry ? entriesToString([e.entry], depth + 1) : "";
      }
      if (e.type === "abilityDc" || e.type === "abilityAttackMod") {
        return e.name || "";
      }
      if (typeof e === "object" && e.entry) {
        return entriesToString([e.entry], depth + 1);
      }
      if (typeof e === "object") return "";
      return String(e);
    })
    .filter(Boolean)
    .join("\n");
}

// Strip 5etools tag syntax: {@spell fireball} → fireball, {@damage 8d6} → 8d6, etc.
function stripTags(text) {
  if (!text) return "";
  return text.replace(/{@\w+\s+([^|}]+?)(?:\|[^}]*)?}/g, "$1");
}

// Detect activation type from description text
function detectActivationType(text) {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (/\breaction\b/.test(lower)) return "reaction";
  if (/\bbonus action\b/.test(lower)) return "bonus action";
  if (/\baction\b/.test(lower) && !/\bbonus action\b/.test(lower)) return "action";
  return undefined;
}

function mapSource(src) {
  const map = {
    XPHB: "PHB 2024", PHB: "PHB 2014",
    XDMG: "DMG 2024", DMG: "DMG 2014",
    XMM: "MM 2024", MM: "MM 2014",
    XGE: "Xanathar's", TCE: "Tasha's",
  };
  return map[src] || src;
}

// ─── Classes ────────────────────────────────────────────

const CLASS_NAMES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter",
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer",
  "Warlock", "Wizard",
];

// Manual class metadata that 5etools stores in complex structures
const CLASS_META = {
  Barbarian: {
    hitDice: 12, primaryAbility: "Strength", savingThrows: ["strength", "constitution"],
    armorProficiencies: ["Light Armor", "Medium Armor", "Shields"],
    weaponProficiencies: ["Simple Weapons", "Martial Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"] },
    resources: [
      { name: "Rage", levelAvailable: 1, resetType: "long", uses: 2, usesTable: { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6, 20: 999 } },
    ],
  },
  Bard: {
    hitDice: 8, primaryAbility: "Charisma", savingThrows: ["dexterity", "charisma"],
    armorProficiencies: ["Light Armor"],
    weaponProficiencies: ["Simple Weapons"],
    toolProficiencies: ["Three Musical Instruments"],
    skillChoices: { count: 3, from: ["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival"] },
    spellcastingAbility: "charisma", casterType: "full",
    resources: [
      { name: "Bardic Inspiration", levelAvailable: 1, resetType: "short", uses: { abilityMod: "charisma", minimum: 1 } },
    ],
  },
  Cleric: {
    hitDice: 8, primaryAbility: "Wisdom", savingThrows: ["wisdom", "charisma"],
    armorProficiencies: ["Light Armor", "Medium Armor", "Shields"],
    weaponProficiencies: ["Simple Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["history", "insight", "medicine", "persuasion", "religion"] },
    spellcastingAbility: "wisdom", casterType: "full",
    resources: [
      { name: "Channel Divinity", levelAvailable: 2, resetType: "short", uses: 1, usesTable: { 2: 1, 6: 2, 18: 3 } },
    ],
  },
  Druid: {
    hitDice: 8, primaryAbility: "Wisdom", savingThrows: ["intelligence", "wisdom"],
    armorProficiencies: ["Light Armor", "Shields"],
    weaponProficiencies: ["Simple Weapons"],
    toolProficiencies: ["Herbalism Kit"],
    skillChoices: { count: 2, from: ["animal-handling", "arcana", "insight", "medicine", "nature", "perception", "religion", "survival"] },
    spellcastingAbility: "wisdom", casterType: "full",
    resources: [
      { name: "Wild Shape", levelAvailable: 2, resetType: "short", uses: 2, usesTable: { 2: 2 } },
    ],
  },
  Fighter: {
    hitDice: 10, primaryAbility: "Strength or Dexterity", savingThrows: ["strength", "constitution"],
    armorProficiencies: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"],
    weaponProficiencies: ["Simple Weapons", "Martial Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "survival"] },
    resources: [
      { name: "Second Wind", levelAvailable: 1, resetType: "short", uses: 1, usesTable: { 1: 1 } },
      { name: "Action Surge", levelAvailable: 2, resetType: "short", uses: 1, usesTable: { 2: 1, 17: 2 } },
      { name: "Indomitable", levelAvailable: 9, resetType: "long", uses: 1, usesTable: { 9: 1, 13: 2, 17: 3 } },
    ],
  },
  Monk: {
    hitDice: 8, primaryAbility: "Dexterity and Wisdom", savingThrows: ["strength", "dexterity"],
    armorProficiencies: [],
    weaponProficiencies: ["Simple Weapons", "Martial Weapons (that have the Light property)"],
    toolProficiencies: ["One Artisan's Tools or Musical Instrument"],
    skillChoices: { count: 2, from: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"] },
    resources: [
      { name: "Focus Points", levelAvailable: 2, resetType: "short", uses: 2, usesTable: { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20 } },
    ],
  },
  Paladin: {
    hitDice: 10, primaryAbility: "Strength and Charisma", savingThrows: ["wisdom", "charisma"],
    armorProficiencies: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"],
    weaponProficiencies: ["Simple Weapons", "Martial Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"] },
    spellcastingAbility: "charisma", casterType: "half",
    resources: [
      { name: "Lay on Hands", levelAvailable: 1, resetType: "long", uses: 5, usesTable: { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40, 9: 45, 10: 50, 11: 55, 12: 60, 13: 65, 14: 70, 15: 75, 16: 80, 17: 85, 18: 90, 19: 95, 20: 100 } },
      { name: "Channel Divinity", levelAvailable: 3, resetType: "short", uses: 1, usesTable: { 3: 1, 11: 2, 15: 3 } },
    ],
  },
  Ranger: {
    hitDice: 10, primaryAbility: "Dexterity and Wisdom", savingThrows: ["strength", "dexterity"],
    armorProficiencies: ["Light Armor", "Medium Armor", "Shields"],
    weaponProficiencies: ["Simple Weapons", "Martial Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 3, from: ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"] },
    spellcastingAbility: "wisdom", casterType: "half",
    resources: [],
  },
  Rogue: {
    hitDice: 8, primaryAbility: "Dexterity", savingThrows: ["dexterity", "intelligence"],
    armorProficiencies: ["Light Armor"],
    weaponProficiencies: ["Simple Weapons", "Martial Weapons (that have the Finesse or Light property)"],
    toolProficiencies: ["Thieves' Tools"],
    skillChoices: { count: 4, from: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight-of-hand", "stealth"] },
    resources: [],
  },
  Sorcerer: {
    hitDice: 6, primaryAbility: "Charisma", savingThrows: ["constitution", "charisma"],
    armorProficiencies: [],
    weaponProficiencies: ["Simple Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"] },
    spellcastingAbility: "charisma", casterType: "full",
    resources: [
      { name: "Sorcery Points", levelAvailable: 2, resetType: "long", uses: 2, usesTable: { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20 } },
    ],
  },
  Warlock: {
    hitDice: 8, primaryAbility: "Charisma", savingThrows: ["wisdom", "charisma"],
    armorProficiencies: ["Light Armor"],
    weaponProficiencies: ["Simple Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"] },
    spellcastingAbility: "charisma", casterType: "pact",
    pactSlotTable: [
      { level: 1, slots: 1, slotLevel: 1 },
      { level: 2, slots: 2, slotLevel: 1 },
      { level: 3, slots: 2, slotLevel: 2 },
      { level: 4, slots: 2, slotLevel: 2 },
      { level: 5, slots: 2, slotLevel: 3 },
      { level: 6, slots: 2, slotLevel: 3 },
      { level: 7, slots: 2, slotLevel: 4 },
      { level: 8, slots: 2, slotLevel: 4 },
      { level: 9, slots: 2, slotLevel: 5 },
      { level: 10, slots: 2, slotLevel: 5 },
      { level: 11, slots: 3, slotLevel: 5 },
      { level: 12, slots: 3, slotLevel: 5 },
      { level: 13, slots: 3, slotLevel: 5 },
      { level: 14, slots: 3, slotLevel: 5 },
      { level: 15, slots: 3, slotLevel: 5 },
      { level: 16, slots: 3, slotLevel: 5 },
      { level: 17, slots: 4, slotLevel: 5 },
      { level: 18, slots: 4, slotLevel: 5 },
      { level: 19, slots: 4, slotLevel: 5 },
      { level: 20, slots: 4, slotLevel: 5 },
    ],
    resources: [],
  },
  Wizard: {
    hitDice: 6, primaryAbility: "Intelligence", savingThrows: ["intelligence", "wisdom"],
    armorProficiencies: [],
    weaponProficiencies: ["Simple Weapons"],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ["arcana", "history", "insight", "investigation", "medicine", "religion"] },
    spellcastingAbility: "intelligence", casterType: "full",
    resources: [],
  },
};

// Full caster spell slot table (levels 1-20, slots for levels 1-9)
const FULL_CASTER_SLOTS = [
  [2,0,0,0,0,0,0,0,0], // 1
  [3,0,0,0,0,0,0,0,0], // 2
  [4,2,0,0,0,0,0,0,0], // 3
  [4,3,0,0,0,0,0,0,0], // 4
  [4,3,2,0,0,0,0,0,0], // 5
  [4,3,3,0,0,0,0,0,0], // 6
  [4,3,3,1,0,0,0,0,0], // 7
  [4,3,3,2,0,0,0,0,0], // 8
  [4,3,3,3,1,0,0,0,0], // 9
  [4,3,3,3,2,0,0,0,0], // 10
  [4,3,3,3,2,1,0,0,0], // 11
  [4,3,3,3,2,1,0,0,0], // 12
  [4,3,3,3,2,1,1,0,0], // 13
  [4,3,3,3,2,1,1,0,0], // 14
  [4,3,3,3,2,1,1,1,0], // 15
  [4,3,3,3,2,1,1,1,0], // 16
  [4,3,3,3,2,1,1,1,1], // 17
  [4,3,3,3,3,1,1,1,1], // 18
  [4,3,3,3,3,2,1,1,1], // 19
  [4,3,3,3,3,2,2,1,1], // 20
];

const HALF_CASTER_SLOTS = [
  [0,0,0,0,0,0,0,0,0], // 1
  [2,0,0,0,0,0,0,0,0], // 2
  [3,0,0,0,0,0,0,0,0], // 3
  [3,0,0,0,0,0,0,0,0], // 4
  [4,2,0,0,0,0,0,0,0], // 5
  [4,2,0,0,0,0,0,0,0], // 6
  [4,3,0,0,0,0,0,0,0], // 7
  [4,3,0,0,0,0,0,0,0], // 8
  [4,3,2,0,0,0,0,0,0], // 9
  [4,3,2,0,0,0,0,0,0], // 10
  [4,3,3,0,0,0,0,0,0], // 11
  [4,3,3,0,0,0,0,0,0], // 12
  [4,3,3,1,0,0,0,0,0], // 13
  [4,3,3,1,0,0,0,0,0], // 14
  [4,3,3,2,0,0,0,0,0], // 15
  [4,3,3,2,0,0,0,0,0], // 16
  [4,3,3,3,1,0,0,0,0], // 17
  [4,3,3,3,1,0,0,0,0], // 18
  [4,3,3,3,2,0,0,0,0], // 19
  [4,3,3,3,2,0,0,0,0], // 20
];

const MULTICLASS_PROFS = {
  Barbarian: { armor: [], weapons: ["Simple Weapons", "Martial Weapons"], tools: [], skills: { count: 0, from: [] } },
  Bard: { armor: ["Light Armor"], weapons: [], tools: ["One Musical Instrument"], skills: { count: 1, from: ["any"] } },
  Cleric: { armor: ["Light Armor", "Medium Armor", "Shields"], weapons: [], tools: [], skills: { count: 0, from: [] } },
  Druid: { armor: ["Light Armor", "Shields"], weapons: [], tools: [], skills: { count: 0, from: [] } },
  Fighter: { armor: ["Light Armor", "Medium Armor", "Shields"], weapons: ["Simple Weapons", "Martial Weapons"], tools: [], skills: { count: 0, from: [] } },
  Monk: { armor: [], weapons: ["Simple Weapons"], tools: [], skills: { count: 0, from: [] } },
  Paladin: { armor: ["Light Armor", "Medium Armor", "Shields"], weapons: ["Simple Weapons", "Martial Weapons"], tools: [], skills: { count: 0, from: [] } },
  Ranger: { armor: ["Light Armor", "Medium Armor", "Shields"], weapons: ["Simple Weapons", "Martial Weapons"], tools: [], skills: { count: 1, from: ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"] } },
  Rogue: { armor: ["Light Armor"], weapons: [], tools: ["Thieves' Tools"], skills: { count: 1, from: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight-of-hand", "stealth"] } },
  Sorcerer: { armor: [], weapons: [], tools: [], skills: { count: 0, from: [] } },
  Warlock: { armor: ["Light Armor"], weapons: ["Simple Weapons"], tools: [], skills: { count: 0, from: [] } },
  Wizard: { armor: [], weapons: [], tools: [], skills: { count: 0, from: [] } },
};

const MULTICLASS_PREREQS = {
  Barbarian: "Strength 13",
  Bard: "Charisma 13",
  Cleric: "Wisdom 13",
  Druid: "Wisdom 13",
  Fighter: "Strength 13 or Dexterity 13",
  Monk: "Dexterity 13 and Wisdom 13",
  Paladin: "Strength 13 and Charisma 13",
  Ranger: "Dexterity 13 and Wisdom 13",
  Rogue: "Dexterity 13",
  Sorcerer: "Charisma 13",
  Warlock: "Charisma 13",
  Wizard: "Intelligence 13",
};

async function buildClasses() {
  console.log("\n📖 Building classes...");
  const classes = [];

  for (const name of CLASS_NAMES) {
    const slug = name.toLowerCase();
    let data;
    try {
      data = await fetchJSON(`${BASE_URL}/class/class-${slug}.json`);
    } catch (e) {
      console.warn(`  ⚠ Could not fetch class ${name}: ${e.message}`);
      continue;
    }

    // Find the XPHB class entry, fallback to PHB
    const allClasses = data.class || [];
    let classEntry = allClasses.find((c) => c.name === name && c.source === "XPHB");
    if (!classEntry) classEntry = allClasses.find((c) => c.name === name && c.source === "PHB");
    if (!classEntry) classEntry = allClasses.find((c) => c.name === name);
    if (!classEntry) {
      console.warn(`  ⚠ No class entry found for ${name}`);
      continue;
    }

    const meta = CLASS_META[name];
    const source = mapSource(classEntry.source || "XPHB");

    // Extract features from classFeature array
    const allFeatures = data.classFeature || [];
    const features = allFeatures
      .filter((f) => f.className === name && (f.source === "XPHB" || f.source === "PHB"))
      .map((f) => {
        const desc = stripTags(entriesToString(f.entries));
        return {
          name: f.name,
          level: f.level,
          description: desc,
          activationType: detectActivationType(desc),
        };
      })
      .filter((f) => f.description.length > 0);

    // Deduplicate features by name+level (prefer XPHB)
    const featureMap = new Map();
    for (const f of features) {
      const key = `${f.name}:${f.level}`;
      if (!featureMap.has(key)) featureMap.set(key, f);
    }

    // Extract subclasses
    const allSubclasses = data.subclass || [];
    const subclassFeatures = data.subclassFeature || [];
    const subclasses = allSubclasses
      .filter((sc) => sc.className === name && (sc.source === "XPHB" || sc.source === "PHB"))
      .map((sc) => {
        const scFeatures = subclassFeatures
          .filter(
            (f) =>
              f.className === name &&
              f.subclassShortName === sc.shortName &&
              (f.source === "XPHB" || f.source === "PHB")
          )
          .map((f) => {
            const desc = stripTags(entriesToString(f.entries));
            return {
              name: f.name,
              level: f.level,
              description: desc,
              activationType: detectActivationType(desc),
            };
          })
          .filter((f) => f.description.length > 0);

        return {
          name: sc.name,
          features: scFeatures,
          source: mapSource(sc.source || "XPHB"),
        };
      });

    // Spell slot table
    let spellSlotTable;
    if (meta.casterType === "full") {
      spellSlotTable = FULL_CASTER_SLOTS;
    } else if (meta.casterType === "half") {
      spellSlotTable = HALF_CASTER_SLOTS;
    }

    const classData = {
      name,
      hitDice: meta.hitDice,
      primaryAbility: meta.primaryAbility,
      savingThrows: meta.savingThrows,
      armorProficiencies: meta.armorProficiencies,
      weaponProficiencies: meta.weaponProficiencies,
      toolProficiencies: meta.toolProficiencies,
      skillChoices: meta.skillChoices,
      ...(meta.spellcastingAbility && { spellcastingAbility: meta.spellcastingAbility }),
      ...(meta.casterType && { casterType: meta.casterType }),
      ...(spellSlotTable && { spellSlotTable }),
      ...(meta.pactSlotTable && { pactSlotTable: meta.pactSlotTable }),
      features: [...featureMap.values()],
      subclasses,
      resources: meta.resources,
      multiclassPrerequisites: MULTICLASS_PREREQS[name],
      multiclassProficiencies: MULTICLASS_PROFS[name],
      source,
    };

    classes.push(classData);
    console.log(
      `  ✓ ${name}: ${classData.features.length} features, ${subclasses.length} subclasses`
    );
  }

  return classes;
}

// ─── Feats ──────────────────────────────────────────────

async function buildFeats() {
  console.log("\n🎯 Building feats...");
  const data = await fetchJSON(`${BASE_URL}/feats.json`);
  const allFeats = data.feat || [];

  const feats = allFeats
    .filter((f) => WANTED_SOURCES.has(f.source))
    .map((f) => {
      const desc = stripTags(entriesToString(f.entries));
      let category = "general";
      if (f.category === "O") category = "origin";
      else if (f.category === "FS") category = "fighting-style";
      else if (f.category === "EB") category = "epic-boon";

      let prerequisite;
      if (f.prerequisite) {
        const parts = [];
        for (const p of f.prerequisite) {
          if (p.level) parts.push(`Level ${p.level.level || p.level}+`);
          if (p.spellcasting) parts.push("Spellcasting or Pact Magic");
          if (p.ability) {
            const abs = Object.entries(p.ability[0] || p.ability)
              .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}+`)
              .join(" or ");
            parts.push(abs);
          }
          if (p.feat) parts.push(Array.isArray(p.feat) ? p.feat.join(", ") : p.feat);
          if (p.other) parts.push(p.other);
        }
        prerequisite = parts.filter(Boolean).join(", ") || undefined;
      }

      let abilityScoreIncrease;
      if (f.ability) {
        const abilities = new Set();
        for (const ab of Array.isArray(f.ability) ? f.ability : [f.ability]) {
          if (ab.choose) {
            for (const a of ab.choose.from || []) abilities.add(a);
          }
          for (const [k] of Object.entries(ab).filter(([k]) => k !== "choose")) {
            abilities.add(k);
          }
        }
        if (abilities.size > 0) abilityScoreIncrease = [...abilities];
      }

      return {
        name: f.name,
        category,
        ...(prerequisite && { prerequisite }),
        repeatable: f.repeatable === true || f.repeatable?.max > 1 || false,
        description: desc,
        activationType: detectActivationType(desc),
        ...(abilityScoreIncrease && { abilityScoreIncrease }),
        source: mapSource(f.source),
      };
    })
    // Deduplicate by name, prefer 2024
    .reduce((acc, f) => {
      const existing = acc.find((e) => e.name === f.name);
      if (!existing) acc.push(f);
      else if (f.source === "PHB 2024" && existing.source !== "PHB 2024") {
        acc[acc.indexOf(existing)] = f;
      }
      return acc;
    }, []);

  console.log(`  ✓ ${feats.length} feats`);
  return feats;
}

// ─── Spells ─────────────────────────────────────────────

/** Extract class names from a spell lookup entry (handles both `class` and `classVariant` keys). */
function extractClassesFromLookupEntry(entry, classes) {
  // `class` has { XPHB: { Sorcerer: true, Wizard: true } }
  // `classVariant` has { PHB: { Sorcerer: { definedInSources: [...] }, ... } }
  for (const key of ["class", "classVariant"]) {
    const mapping = entry[key];
    if (!mapping) continue;
    for (const [, classMap] of Object.entries(mapping)) {
      for (const className of Object.keys(classMap)) {
        if (!classes.includes(className)) classes.push(className);
      }
    }
  }
}

async function buildSpells() {
  console.log("\n✨ Building spells...");

  // Fetch spell-class lookup (5etools stores class lists separately)
  let spellClassLookup = {};
  try {
    const lookupData = await fetchJSON(`${BASE_URL}/generated/gendata-spell-source-lookup.json`);
    spellClassLookup = lookupData;
  } catch (e) {
    console.warn("  ⚠️ Could not fetch spell-class lookup, classes will be empty:", e.message);
  }

  // Fetch XPHB spells (2024)
  const xphbData = await fetchJSON(`${BASE_URL}/spells/spells-xphb.json`);
  const allSpells = xphbData.spell || [];

  // Also fetch PHB spells for gap-fill
  let phbSpells = [];
  try {
    const phbData = await fetchJSON(`${BASE_URL}/spells/spells-phb.json`);
    phbSpells = phbData.spell || [];
  } catch { /* ok */ }

  // Also XGE and TCE
  let xgeSpells = [], tceSpells = [];
  try {
    const xgeData = await fetchJSON(`${BASE_URL}/spells/spells-xge.json`);
    xgeSpells = xgeData.spell || [];
  } catch { /* ok */ }
  try {
    const tceData = await fetchJSON(`${BASE_URL}/spells/spells-tce.json`);
    tceSpells = tceData.spell || [];
  } catch { /* ok */ }

  const combined = [...allSpells, ...phbSpells, ...xgeSpells, ...tceSpells];

  const spellMap = new Map();
  for (const s of combined) {
    if (!WANTED_SOURCES.has(s.source)) continue;
    const existing = spellMap.get(s.name);
    if (existing && sourcePriority(existing._source) <= sourcePriority(s.source)) continue;

    const desc = stripTags(entriesToString(s.entries));
    const higherLevels = s.entriesHigherLevel
      ? stripTags(entriesToString(s.entriesHigherLevel))
      : undefined;

    // Casting time
    let castingTime = "1 Action";
    if (s.time && s.time[0]) {
      const t = s.time[0];
      const num = t.number || 1;
      const unit = t.unit || "action";
      if (unit === "bonus") castingTime = "1 Bonus Action";
      else if (unit === "reaction") castingTime = `1 Reaction${t.condition ? `, ${stripTags(t.condition)}` : ""}`;
      else if (unit === "minute") castingTime = `${num} Minute${num > 1 ? "s" : ""}`;
      else if (unit === "hour") castingTime = `${num} Hour${num > 1 ? "s" : ""}`;
      else castingTime = `${num} Action${num > 1 ? "s" : ""}`;
    }

    // Range
    let range = "Self";
    if (s.range) {
      if (s.range.type === "point") {
        const d = s.range.distance;
        if (d.type === "self") range = "Self";
        else if (d.type === "touch") range = "Touch";
        else if (d.type === "sight") range = "Sight";
        else if (d.type === "unlimited") range = "Unlimited";
        else range = `${d.amount} ${d.type}`;
      } else if (s.range.type === "special") range = "Special";
      else if (s.range.type === "line" || s.range.type === "cone" || s.range.type === "cube" || s.range.type === "sphere" || s.range.type === "hemisphere" || s.range.type === "cylinder" || s.range.type === "radius") {
        const d = s.range.distance;
        range = `Self (${d.amount}-${d.type} ${s.range.type})`;
      }
    }

    // Components
    let components = "";
    if (s.components) {
      const parts = [];
      if (s.components.v) parts.push("V");
      if (s.components.s) parts.push("S");
      if (s.components.m) {
        const mat = typeof s.components.m === "string" ? s.components.m : s.components.m?.text || "";
        parts.push(mat ? `M (${stripTags(mat)})` : "M");
      }
      components = parts.join(", ");
    }

    // Duration
    let duration = "Instantaneous";
    let concentration = false;
    if (s.duration && s.duration[0]) {
      const d = s.duration[0];
      concentration = d.concentration === true;
      if (d.type === "instant") duration = "Instantaneous";
      else if (d.type === "permanent") duration = "Until Dispelled";
      else if (d.type === "special") duration = "Special";
      else if (d.type === "timed") {
        const amt = d.duration?.amount || 1;
        const unit = d.duration?.type || "minute";
        const unitStr = amt === 1 ? unit : unit + "s";
        duration = concentration
          ? `Concentration, up to ${amt} ${unitStr}`
          : `${amt} ${unitStr.charAt(0).toUpperCase() + unitStr.slice(1)}`;
      }
    }

    // Classes — 5etools XPHB spells don't inline class lists; use the lookup file
    const classes = [];
    if (s.classes?.fromClassList) {
      for (const c of s.classes.fromClassList) {
        if (!classes.includes(c.name)) classes.push(c.name);
      }
    }
    // If inline classes are empty, check the generated lookup
    if (classes.length === 0) {
      const spellNameLower = s.name.toLowerCase();
      // Try the spell's own source first, then XPHB, PHB as fallbacks
      const sourcesToCheck = [s.source?.toLowerCase(), "xphb", "phb"];
      for (const src of sourcesToCheck) {
        if (!src) continue;
        const srcLookup = spellClassLookup[src];
        if (!srcLookup) continue;
        const spellEntry = srcLookup[spellNameLower];
        if (spellEntry) {
          extractClassesFromLookupEntry(spellEntry, classes);
          if (classes.length > 0) break;
        }
      }
      // If still empty, scan ALL sources in the lookup for this spell
      if (classes.length === 0) {
        for (const [, srcLookup] of Object.entries(spellClassLookup)) {
          if (typeof srcLookup !== "object" || srcLookup === null) continue;
          const spellEntry = srcLookup[spellNameLower];
          if (spellEntry) {
            extractClassesFromLookupEntry(spellEntry, classes);
            if (classes.length > 0) break;
          }
        }
      }
    }

    // Damage
    let damage;
    if (s.damageInflict && s.damageInflict.length > 0) {
      // Try to extract dice from description
      const diceMatch = desc.match(/(\d+d\d+)/);
      if (diceMatch) {
        damage = { dice: diceMatch[1], type: s.damageInflict[0] };
      }
    }

    const school = s.school
      ? { A: "Abjuration", C: "Conjuration", D: "Divination", E: "Enchantment",
          V: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation" }[s.school] || s.school
      : "Unknown";

    spellMap.set(s.name, {
      name: s.name,
      level: s.level || 0,
      school,
      castingTime,
      range,
      components,
      duration,
      concentration,
      ritual: s.meta?.ritual === true,
      description: desc,
      ...(higherLevels && { higherLevels }),
      classes,
      ...(damage && { damage }),
      source: mapSource(s.source),
      _source: s.source,
    });
  }

  // Remove internal _source field
  const spells = [...spellMap.values()].map(({ _source, ...rest }) => rest);
  console.log(`  ✓ ${spells.length} spells`);
  return spells;
}

// ─── Species ────────────────────────────────────────────

async function buildSpecies() {
  console.log("\n🧬 Building species...");
  const data = await fetchJSON(`${BASE_URL}/races.json`);
  const allRaces = data.race || [];

  const speciesMap = new Map();
  for (const r of allRaces) {
    if (!WANTED_SOURCES.has(r.source)) continue;
    const existing = speciesMap.get(r.name);
    if (existing && sourcePriority(existing._source) <= sourcePriority(r.source)) continue;

    const traits = (r.entries || [])
      .filter((e) => typeof e === "object" && e.type === "entries" && e.name)
      .map((e) => {
        const desc = stripTags(entriesToString(e.entries));
        return {
          name: e.name,
          description: desc,
          activationType: detectActivationType(desc),
        };
      })
      .filter((t) => t.description.length > 0);

    // Speed
    let speed = 30;
    if (r.speed) {
      if (typeof r.speed === "number") speed = r.speed;
      else if (r.speed.walk) speed = r.speed.walk;
    }

    // Darkvision
    let darkvision;
    if (r.darkvision) darkvision = r.darkvision;

    // Size
    let size = ["Medium"];
    if (r.size) {
      const sizeMap = { S: "Small", M: "Medium", L: "Large", T: "Tiny", H: "Huge" };
      size = r.size.map((s) => sizeMap[s] || s);
    }

    // Resistances
    let resistances;
    if (r.resist) resistances = r.resist.filter((r) => typeof r === "string");

    // Languages
    let languages;
    if (r.languageProficiencies && r.languageProficiencies[0]) {
      const lp = r.languageProficiencies[0];
      languages = Object.keys(lp)
        .filter((k) => k !== "anyStandard" && lp[k] === true)
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
    }

    speciesMap.set(r.name, {
      name: r.name,
      size,
      speed,
      ...(darkvision && { darkvision }),
      traits,
      ...(resistances?.length && { resistances }),
      ...(languages?.length && { languages }),
      source: mapSource(r.source),
      _source: r.source,
    });
  }

  const species = [...speciesMap.values()].map(({ _source, ...rest }) => rest);
  console.log(`  ✓ ${species.length} species`);
  return species;
}

// ─── Backgrounds ────────────────────────────────────────

async function buildBackgrounds() {
  console.log("\n📜 Building backgrounds...");
  const data = await fetchJSON(`${BASE_URL}/backgrounds.json`);
  const allBgs = data.background || [];

  const backgrounds = allBgs
    .filter((b) => WANTED_SOURCES.has(b.source))
    .map((b) => {
      const desc = stripTags(entriesToString(b.entries));

      let skillProficiencies = [];
      if (b.skillProficiencies && b.skillProficiencies[0]) {
        skillProficiencies = Object.keys(b.skillProficiencies[0]).filter(
          (k) => k !== "choose" && b.skillProficiencies[0][k] === true
        );
      }

      let toolProficiency;
      if (b.toolProficiencies && b.toolProficiencies[0]) {
        const tp = b.toolProficiencies[0];
        toolProficiency = Object.keys(tp).filter((k) => k !== "choose")[0];
      }

      let feat = "";
      if (b.feats && b.feats[0]) {
        feat = Object.keys(b.feats[0])[0] || "";
      }

      let abilityScores = [];
      if (b.ability && b.ability[0]) {
        const ab = b.ability[0];
        if (ab.choose) abilityScores = ab.choose.from || [];
        else abilityScores = Object.keys(ab);
      }

      let equipment = [];
      if (b.startingEquipment) {
        // Parse starting equipment into readable strings
        for (const entry of b.startingEquipment) {
          if (entry._ && Array.isArray(entry._)) {
            for (const item of entry._) {
              if (typeof item === "string") equipment.push(stripTags(item));
              else if (item.item) equipment.push(stripTags(item.item));
              else if (item.special) equipment.push(stripTags(item.special));
            }
          }
        }
      }

      return {
        name: b.name,
        description: desc,
        skillProficiencies,
        ...(toolProficiency && { toolProficiency }),
        feat,
        abilityScores,
        equipment,
        source: mapSource(b.source),
      };
    })
    .reduce((acc, b) => {
      const existing = acc.find((e) => e.name === b.name);
      if (!existing) acc.push(b);
      return acc;
    }, []);

  console.log(`  ✓ ${backgrounds.length} backgrounds`);
  return backgrounds;
}

// ─── Conditions ─────────────────────────────────────────

async function buildConditions() {
  console.log("\n💀 Building conditions...");
  const data = await fetchJSON(`${BASE_URL}/conditionsdiseases.json`);
  const allConditions = data.condition || [];

  const CONDITION_EFFECTS = {
    Blinded: { disadvantageOn: ["attack-rolls"], cantDo: ["see"] },
    Charmed: { cantDo: ["attack-charmer"] },
    Deafened: { cantDo: ["hear"] },
    Exhaustion: {},
    Frightened: { disadvantageOn: ["ability-checks", "attack-rolls"] },
    Grappled: { speed: 0 },
    Incapacitated: { cantDo: ["take-actions", "take-reactions"] },
    Invisible: { disadvantageOn: [] },
    Paralyzed: { cantDo: ["move", "speak"], autoFail: ["strength-saving-throws", "dexterity-saving-throws"], speed: 0 },
    Petrified: { cantDo: ["move", "speak"], autoFail: ["strength-saving-throws", "dexterity-saving-throws"], speed: 0 },
    Poisoned: { disadvantageOn: ["attack-rolls", "ability-checks"] },
    Prone: { disadvantageOn: ["attack-rolls"] },
    Restrained: { disadvantageOn: ["attack-rolls", "dexterity-saving-throws"], speed: 0 },
    Stunned: { cantDo: ["move", "take-actions"], autoFail: ["strength-saving-throws", "dexterity-saving-throws"] },
    Unconscious: { cantDo: ["move", "speak", "take-actions"], autoFail: ["strength-saving-throws", "dexterity-saving-throws"], speed: 0 },
  };

  const conditions = allConditions
    .filter((c) => WANTED_SOURCES.has(c.source))
    .map((c) => {
      const desc = stripTags(entriesToString(c.entries));
      const effects = CONDITION_EFFECTS[c.name];
      return {
        name: c.name,
        description: desc,
        ...(effects && Object.keys(effects).length > 0 && { effects }),
        source: mapSource(c.source),
      };
    })
    .reduce((acc, c) => {
      const existing = acc.find((e) => e.name === c.name);
      if (!existing) acc.push(c);
      else if (c.source.includes("2024")) acc[acc.indexOf(existing)] = c;
      return acc;
    }, []);

  console.log(`  ✓ ${conditions.length} conditions`);
  return conditions;
}

// ─── Equipment ──────────────────────────────────────────

async function buildEquipment() {
  console.log("\n⚔️ Building equipment...");
  const data = await fetchJSON(`${BASE_URL}/items-base.json`);
  const allItems = data.baseitem || data.item || [];

  const weapons = [];
  const armor = [];
  const gear = [];
  const tools = [];

  for (const item of allItems) {
    if (!WANTED_SOURCES.has(item.source)) continue;

    const name = item.name;
    const cost = item.value ? formatCost(item.value) : "—";
    const weight = item.weight || 0;

    // Weapons
    if (item.weaponCategory) {
      const category = item.weaponCategory === "simple" ? "simple" : "martial";
      const type = item.type === "R" ? "ranged" : "melee";
      const damage = item.dmg1 || "—";
      const damageType = item.dmgType
        ? { B: "bludgeoning", P: "piercing", S: "slashing" }[item.dmgType] || item.dmgType
        : "—";

      const properties = [];
      if (item.property) {
        const propMap = {
          F: "Finesse", H: "Heavy", L: "Light", R: "Reach",
          T: "Thrown", "2H": "Two-Handed", V: "Versatile",
          A: "Ammunition", LD: "Loading", S: "Special",
        };
        for (const p of item.property) {
          if (propMap[p]) properties.push(propMap[p]);
          else properties.push(p);
        }
      }

      // Versatile damage
      if (item.dmg2 && properties.some((p) => p.startsWith("Versatile"))) {
        const idx = properties.findIndex((p) => p === "Versatile");
        if (idx >= 0) properties[idx] = `Versatile (${item.dmg2})`;
      }

      const weapon = {
        name, category, type, damage, damageType, weight, cost, properties,
      };
      if (item.mastery) weapon.mastery = Array.isArray(item.mastery) ? item.mastery[0] : item.mastery;
      if (item.range) weapon.range = item.range;
      weapons.push(weapon);
    }
    // Armor
    else if (item.type === "LA" || item.type === "MA" || item.type === "HA" || item.type === "S") {
      const catMap = { LA: "light", MA: "medium", HA: "heavy", S: "shield" };
      const armorEntry = {
        name,
        category: catMap[item.type],
        ac: item.ac || 0,
        stealthDisadvantage: item.stealth === true,
        weight,
        cost,
      };
      if (item.type === "MA") armorEntry.dexCap = 2;
      else if (item.type === "HA") armorEntry.dexCap = 0;
      if (item.strength) armorEntry.strengthReq = item.strength;
      armor.push(armorEntry);
    }
    // Tools
    else if (item.type === "T" || item.type === "AT" || item.type === "GS" || item.type === "INS") {
      tools.push({
        name, cost, weight,
        ...(item.entries && { description: stripTags(entriesToString(item.entries)) }),
      });
    }
    // Gear (adventuring gear, ammunition, etc.)
    else if (item.type === "G" || item.type === "A" || item.type === "SCF" || !item.type) {
      if (name && cost !== "—") {
        gear.push({
          name, cost, weight,
          ...(item.entries && { description: stripTags(entriesToString(item.entries)) }),
        });
      }
    }
  }

  console.log(`  ✓ ${weapons.length} weapons, ${armor.length} armor, ${tools.length} tools, ${gear.length} gear`);
  return { weapons, armor, gear, tools };
}

function formatCost(copperValue) {
  if (copperValue >= 100) return `${copperValue / 100} gp`;
  if (copperValue >= 10) return `${copperValue / 10} sp`;
  return `${copperValue} cp`;
}

// ─── Magic Items ────────────────────────────────────────

async function buildMagicItems() {
  console.log("\n💎 Building magic items...");
  const data = await fetchJSON(`${BASE_URL}/items.json`);
  const allItems = data.item || [];

  const magicItems = [];
  const seen = new Set();

  for (const item of allItems) {
    if (!WANTED_SOURCES.has(item.source)) continue;
    // Only magic/wondrous items, not mundane
    if (!item.rarity || item.rarity === "none") continue;
    if (seen.has(item.name)) continue;
    seen.add(item.name);

    const desc = stripTags(entriesToString(item.entries));

    const typeMap = {
      WD: "Wand", RD: "Rod", RG: "Ring", P: "Potion", SC: "Scroll",
      WS: "Weapon", AS: "Armor", ST: "Staff", W: "Wondrous Item",
      A: "Ammunition", AT: "Artisan Tool",
    };

    const miType = item.wondrous ? "Wondrous Item" : typeMap[item.type] || item.type || "Wondrous Item";

    const magicItem = {
      name: item.name,
      type: miType,
      rarity: item.rarity || "unknown",
      attunement: item.reqAttune === true || typeof item.reqAttune === "string",
      description: desc,
      source: mapSource(item.source),
    };

    if (typeof item.reqAttune === "string") magicItem.attunementReq = item.reqAttune;
    if (item.bonusAc) magicItem.acBonus = parseInt(item.bonusAc) || undefined;
    if (item.bonusWeapon) {
      magicItem.attackBonus = parseInt(item.bonusWeapon) || undefined;
      magicItem.damageBonus = parseInt(item.bonusWeapon) || undefined;
    }

    magicItems.push(magicItem);
  }

  console.log(`  ✓ ${magicItems.length} magic items`);
  return magicItems;
}

// ─── Monsters ───────────────────────────────────────────

// CR to XP lookup
const CR_XP = {
  "0": 0, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000,
  "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

async function buildMonsters() {
  console.log("\n🐉 Building monsters...");

  // Fetch MM 2024 and MM 2014
  let monsters2024 = [];
  let monsters2014 = [];

  // Try XMM (2024 Monster Manual)
  try {
    const data = await fetchJSON(`${BASE_URL}/bestiary/bestiary-xmm.json`);
    monsters2024 = data.monster || [];
  } catch {
    console.log("  ⚠ No bestiary-xmm.json found");
  }

  // MM 2014
  try {
    const data = await fetchJSON(`${BASE_URL}/bestiary/bestiary-mm.json`);
    monsters2014 = data.monster || [];
  } catch {
    console.log("  ⚠ No bestiary-mm.json found");
  }

  const combined = [...monsters2024, ...monsters2014];
  const monsterMap = new Map();

  for (const m of combined) {
    if (!WANTED_SOURCES.has(m.source)) continue;
    const existing = monsterMap.get(m.name);
    if (existing && sourcePriority(existing._source) <= sourcePriority(m.source)) continue;

    // AC
    let ac = 10;
    let acType;
    if (m.ac) {
      if (typeof m.ac[0] === "number") ac = m.ac[0];
      else if (m.ac[0]?.ac) {
        ac = m.ac[0].ac;
        if (m.ac[0].from) acType = m.ac[0].from.map((s) => stripTags(s)).join(", ");
      }
    }

    // HP
    let hp = 0;
    let hitDice = "";
    if (m.hp) {
      hp = m.hp.average || 0;
      hitDice = m.hp.formula || "";
    }

    // Speed
    const speed = {};
    if (m.speed) {
      if (typeof m.speed.walk === "number") speed.walk = m.speed.walk;
      else if (typeof m.speed.walk === "object") speed.walk = m.speed.walk.number || 30;
      else speed.walk = 30;
      for (const [k, v] of Object.entries(m.speed)) {
        if (k === "walk" || k === "canHover") continue;
        if (typeof v === "number") speed[k] = v;
        else if (typeof v === "object") speed[k] = v.number || 0;
      }
    }

    // CR
    let cr = "0";
    if (m.cr) {
      cr = typeof m.cr === "object" ? m.cr.cr || "0" : String(m.cr);
    }

    // Size
    const sizeMap = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
    const size = m.size ? sizeMap[m.size[0]] || m.size[0] : "Medium";

    // Type
    let type = "Unknown";
    if (typeof m.type === "string") type = m.type;
    else if (m.type?.type) type = typeof m.type.type === "string" ? m.type.type : "Unknown";

    // Parse action blocks
    function parseActions(arr) {
      if (!arr) return undefined;
      return arr.map((a) => ({
        name: a.name || "Unknown",
        description: stripTags(entriesToString(a.entries)),
      })).filter((a) => a.description.length > 0);
    }

    // Skills
    let skills;
    if (m.skill) {
      skills = {};
      for (const [k, v] of Object.entries(m.skill)) {
        skills[k] = parseInt(v) || 0;
      }
    }

    // Saving throws
    let savingThrows;
    if (m.save) {
      savingThrows = {};
      for (const [k, v] of Object.entries(m.save)) {
        savingThrows[k] = parseInt(v) || 0;
      }
    }

    // Senses
    let senses = [];
    if (m.senses) senses = m.senses.map((s) => stripTags(s));
    if (m.passive) senses.push(`Passive Perception ${m.passive}`);

    // Languages
    let languages = [];
    if (m.languages) languages = m.languages.map((l) => stripTags(l));

    const monster = {
      name: m.name,
      size,
      type: type.charAt(0).toUpperCase() + type.slice(1),
      ac,
      ...(acType && { acType }),
      hp,
      hitDice: stripTags(hitDice),
      speed,
      abilities: {
        str: m.str || 10, dex: m.dex || 10, con: m.con || 10,
        int: m.int || 10, wis: m.wis || 10, cha: m.cha || 10,
      },
      ...(savingThrows && { savingThrows }),
      ...(skills && { skills }),
      ...(m.resist?.length && { resistances: m.resist.filter((r) => typeof r === "string") }),
      ...(m.immune?.length && { immunities: m.immune.filter((i) => typeof i === "string") }),
      ...(m.vulnerable?.length && { vulnerabilities: m.vulnerable.filter((v) => typeof v === "string") }),
      ...(m.conditionImmune?.length && { conditionImmunities: m.conditionImmune.filter((c) => typeof c === "string") }),
      senses,
      languages,
      cr,
      xp: CR_XP[cr] || 0,
      ...(parseActions(m.trait)?.length && { traits: parseActions(m.trait) }),
      actions: parseActions(m.action) || [],
      ...(parseActions(m.bonus)?.length && { bonusActions: parseActions(m.bonus) }),
      ...(parseActions(m.reaction)?.length && { reactions: parseActions(m.reaction) }),
      ...(parseActions(m.legendary)?.length && { legendaryActions: parseActions(m.legendary) }),
      ...(parseActions(m.lair)?.length && { lairActions: parseActions(m.lair) }),
      ...(m.alignment?.length && { alignment: m.alignment.map((a) => {
        const alMap = { L: "Lawful", N: "Neutral", C: "Chaotic", G: "Good", E: "Evil" };
        return alMap[a] || a;
      }).join(" ") }),
      source: mapSource(m.source),
      _source: m.source,
    };

    monsterMap.set(m.name, monster);
  }

  const monsters = [...monsterMap.values()].map(({ _source, ...rest }) => rest);
  console.log(`  ✓ ${monsters.length} monsters`);
  return monsters;
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log("🏗️  Building D&D 2024 Database...\n");
  console.log(`Output directory: ${DATA_DIR}`);
  mkdirSync(DATA_DIR, { recursive: true });

  // Fetch and build all data in parallel where possible
  const [classes, feats, spells, species, backgrounds, conditions, equipment, magicItems, monsters] =
    await Promise.all([
      buildClasses(),
      buildFeats(),
      buildSpells(),
      buildSpecies(),
      buildBackgrounds(),
      buildConditions(),
      buildEquipment(),
      buildMagicItems(),
      buildMonsters(),
    ]);

  // Write all JSON files
  const files = {
    "classes.json": classes,
    "feats.json": feats,
    "spells.json": spells,
    "species.json": species,
    "backgrounds.json": backgrounds,
    "conditions.json": conditions,
    "equipment.json": equipment,
    "magic-items.json": magicItems,
    "monsters.json": monsters,
  };

  console.log("\n📁 Writing files...");
  for (const [filename, data] of Object.entries(files)) {
    const path = join(DATA_DIR, filename);
    const json = JSON.stringify(data, null, 2);
    writeFileSync(path, json, "utf-8");
    const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
    const count = Array.isArray(data) ? data.length : Object.values(data).flat().length;
    console.log(`  ✓ ${filename} — ${count} entries (${sizeMB} MB)`);
  }

  // Summary
  console.log("\n✅ Database build complete!");
  console.log(`   Classes:     ${classes.length}`);
  console.log(`   Feats:       ${feats.length}`);
  console.log(`   Spells:      ${spells.length}`);
  console.log(`   Species:     ${species.length}`);
  console.log(`   Backgrounds: ${backgrounds.length}`);
  console.log(`   Conditions:  ${conditions.length}`);
  console.log(`   Weapons:     ${equipment.weapons.length}`);
  console.log(`   Armor:       ${equipment.armor.length}`);
  console.log(`   Tools:       ${equipment.tools.length}`);
  console.log(`   Gear:        ${equipment.gear.length}`);
  console.log(`   Magic Items: ${magicItems.length}`);
  console.log(`   Monsters:    ${monsters.length}`);
}

main().catch((e) => {
  console.error("❌ Build failed:", e);
  process.exit(1);
});
