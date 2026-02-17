import type {
  AbilityScores,
  CharacterClass,
  CharacterData,
  CharacterDynamicData,
  CharacterStaticData,
  SpellSlotLevel,
} from "../types/character";

/**
 * Get total character level across all classes.
 */
export function getTotalLevel(classes: CharacterClass[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

/**
 * Calculate ability modifier from ability score.
 * e.g. 10 → 0, 14 → +2, 8 → -1
 */
export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format modifier as string with sign.
 * e.g. 14 → "+2", 8 → "-1", 10 → "+0"
 */
export function formatModifier(score: number): string {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Get proficiency bonus from total level.
 */
export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Format classes as a readable string.
 * e.g. [{ name: "Fighter", level: 5 }, { name: "Wizard", level: 3 }] → "Fighter 5 / Wizard 3"
 */
export function formatClassString(classes: CharacterClass[]): string {
  return classes
    .map((c) => {
      const sub = c.subclass ? ` (${c.subclass})` : "";
      return `${c.name}${sub} ${c.level}`;
    })
    .join(" / ");
}

/**
 * Build a text block describing a character for the AI system prompt.
 */
export function buildCharacterContextBlock(
  playerName: string,
  char: CharacterData
): string {
  const s = char.static;
  const d = char.dynamic;
  const totalLevel = getTotalLevel(s.classes);
  const classStr = formatClassString(s.classes);

  const lines: string[] = [
    `### ${playerName} plays ${s.name}`,
    `**Race:** ${s.race} | **Class:** ${classStr} | **Level:** ${totalLevel}`,
    `**HP:** ${d.currentHP}/${s.maxHP}${d.tempHP > 0 ? ` (+${d.tempHP} temp)` : ""} | **AC:** ${s.armorClass} | **Speed:** ${s.speed} ft`,
    `**Abilities:** STR ${formatModifier(s.abilities.strength)}, DEX ${formatModifier(s.abilities.dexterity)}, CON ${formatModifier(s.abilities.constitution)}, INT ${formatModifier(s.abilities.intelligence)}, WIS ${formatModifier(s.abilities.wisdom)}, CHA ${formatModifier(s.abilities.charisma)}`,
  ];

  if (d.conditions.length > 0) {
    lines.push(`**Conditions:** ${d.conditions.join(", ")}`);
  }

  const preparedSpells = s.spells.filter((sp) => sp.prepared);
  if (preparedSpells.length > 0) {
    const cantrips = preparedSpells
      .filter((sp) => sp.level === 0)
      .map((sp) => sp.name);
    const spells = preparedSpells
      .filter((sp) => sp.level > 0)
      .map((sp) => `${sp.name} (Lvl ${sp.level})`);
    if (cantrips.length > 0) {
      lines.push(`**Cantrips:** ${cantrips.join(", ")}`);
    }
    if (spells.length > 0) {
      lines.push(`**Prepared Spells:** ${spells.join(", ")}`);
    }
  }

  if (s.features.length > 0) {
    lines.push(`**Features:** ${s.features.join(", ")}`);
  }

  const equippedItems = d.inventory.filter((item) => item.equipped);
  if (equippedItems.length > 0) {
    lines.push(
      `**Equipped:** ${equippedItems.map((i) => i.name).join(", ")}`
    );
  }

  return lines.join("\n");
}

/**
 * Create initial dynamic data from static import data.
 */
export function createInitialDynamicData(
  staticData: CharacterStaticData
): CharacterDynamicData {
  // Build spell slot levels from class data
  const spellSlotsUsed: SpellSlotLevel[] = [];
  // We'll let the DDB parser compute actual spell slots; default to empty
  return {
    currentHP: staticData.maxHP,
    tempHP: 0,
    spellSlotsUsed,
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    xp: 0,
  };
}

/**
 * Merge a re-import: replace static data, preserve dynamic state.
 * Updates maxHP-relative currentHP if maxHP changed.
 */
export function mergeReimport(
  existing: CharacterData,
  newStaticData: CharacterStaticData,
  newDynamic: CharacterDynamicData
): CharacterData {
  const oldMax = existing.static.maxHP;
  const newMax = newStaticData.maxHP;
  const dynamic = { ...existing.dynamic };

  // If maxHP changed, scale current HP proportionally
  if (oldMax !== newMax && oldMax > 0) {
    const ratio = dynamic.currentHP / oldMax;
    dynamic.currentHP = Math.max(1, Math.round(ratio * newMax));
  }

  // Update inventory and currency from new import (these are part of the character sheet)
  dynamic.inventory = newDynamic.inventory;
  dynamic.currency = newDynamic.currency;

  // Update spell slots structure (totals may change), but preserve used counts where possible
  const oldSlotMap = new Map(
    dynamic.spellSlotsUsed.map((s) => [s.level, s.used])
  );
  dynamic.spellSlotsUsed = newDynamic.spellSlotsUsed.map((slot) => ({
    ...slot,
    used: Math.min(oldSlotMap.get(slot.level) ?? 0, slot.total),
  }));

  return {
    static: newStaticData,
    dynamic,
  };
}

/**
 * Mapping of ability score keys to display names.
 */
export const ABILITY_NAMES: Record<keyof AbilityScores, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};
