import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WSClient } from "../ws-client.js";
import {
  getSpell, getMonster, getCondition, getMagicItem, getFeat,
  getClass, getSpecies, getBackground,
  searchSpells, searchMonsters, searchMagicItems, searchFeats,
  getSpellsByClass, getSpellsByLevel,
  classesArray, spellsArray, speciesArray, backgroundsArray, conditionsArray, monstersArray, magicItemsArray, featsArray,
  type SpellData, type MonsterData, type ConditionData, type MagicItemData, type FeatData,
  type ClassData, type SpeciesData, type BackgroundData,
} from "@aidnd/shared/data";

// ─── Formatting Helpers ─────────────────────────────────────

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatSpell(s: SpellData): string {
  let text = `# ${s.name}\n*${s.level === 0 ? "Cantrip" : `Level ${s.level}`} ${s.school}*`;
  if (s.ritual) text += " (ritual)";
  if (s.concentration) text += " (concentration)";
  text += "\n\n";
  text += `**Casting Time:** ${s.castingTime}\n`;
  text += `**Range:** ${s.range}\n`;
  text += `**Components:** ${s.components}\n`;
  text += `**Duration:** ${s.duration}\n`;
  if (s.classes.length > 0) text += `**Classes:** ${s.classes.join(", ")}\n`;
  if (s.damage) text += `**Damage:** ${s.damage.dice} ${s.damage.type}\n`;
  text += `\n${s.description}`;
  if (s.higherLevels) text += `\n\n**At Higher Levels.** ${s.higherLevels}`;
  if (s.source) text += `\n\n*Source: ${s.source}*`;
  return text;
}

function formatMonster(m: MonsterData): string {
  const speedStr = Object.entries(m.speed).map(([k, v]) => `${k} ${v} ft.`).join(", ");
  let text = `# ${m.name}\n*${m.size} ${m.type}`;
  if (m.alignment) text += `, ${m.alignment}`;
  text += "*\n\n";
  text += `**AC:** ${m.ac}`;
  if (m.acType) text += ` (${m.acType})`;
  text += ` | **HP:** ${m.hp} (${m.hitDice}) | **Speed:** ${speedStr}\n`;

  // Ability scores
  const a = m.abilities;
  text += `**STR** ${a.str} (${abilityMod(a.str)}) **DEX** ${a.dex} (${abilityMod(a.dex)}) **CON** ${a.con} (${abilityMod(a.con)}) **INT** ${a.int} (${abilityMod(a.int)}) **WIS** ${a.wis} (${abilityMod(a.wis)}) **CHA** ${a.cha} (${abilityMod(a.cha)})\n`;

  if (m.savingThrows && Object.keys(m.savingThrows).length > 0) {
    text += `**Saving Throws:** ${Object.entries(m.savingThrows).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} +${v}`).join(", ")}\n`;
  }
  if (m.skills && Object.keys(m.skills).length > 0) {
    text += `**Skills:** ${Object.entries(m.skills).map(([k, v]) => `${k} +${v}`).join(", ")}\n`;
  }
  if (m.vulnerabilities?.length) text += `**Vulnerabilities:** ${m.vulnerabilities.join(", ")}\n`;
  if (m.resistances?.length) text += `**Resistances:** ${m.resistances.join(", ")}\n`;
  if (m.immunities?.length) text += `**Immunities:** ${m.immunities.join(", ")}\n`;
  if (m.conditionImmunities?.length) text += `**Condition Immunities:** ${m.conditionImmunities.join(", ")}\n`;
  if (m.senses.length > 0) text += `**Senses:** ${m.senses.join(", ")}\n`;
  if (m.languages.length > 0) text += `**Languages:** ${m.languages.join(", ")}\n`;
  text += `**CR:** ${m.cr} (${m.xp.toLocaleString()} XP)\n`;

  if (m.traits?.length) {
    text += "\n**Traits:**\n";
    for (const t of m.traits) text += `- **${t.name}.** ${t.description}\n`;
  }
  if (m.actions.length > 0) {
    text += "\n**Actions:**\n";
    for (const a of m.actions) text += `- **${a.name}.** ${a.description}\n`;
  }
  if (m.bonusActions?.length) {
    text += "\n**Bonus Actions:**\n";
    for (const a of m.bonusActions) text += `- **${a.name}.** ${a.description}\n`;
  }
  if (m.reactions?.length) {
    text += "\n**Reactions:**\n";
    for (const r of m.reactions) text += `- **${r.name}.** ${r.description}\n`;
  }
  if (m.legendaryActions?.length) {
    text += "\n**Legendary Actions:**\n";
    for (const l of m.legendaryActions) text += `- **${l.name}.** ${l.description}\n`;
  }
  if (m.lairActions?.length) {
    text += "\n**Lair Actions:**\n";
    for (const l of m.lairActions) text += `- **${l.name}.** ${l.description}\n`;
  }
  if (m.source) text += `\n*Source: ${m.source}*`;
  return text;
}

function formatCondition(c: ConditionData): string {
  let text = `# ${c.name}\n\n${c.description}`;
  if (c.effects) {
    text += "\n\n**Mechanical Effects:**\n";
    if (c.effects.disadvantageOn?.length) text += `- Disadvantage on: ${c.effects.disadvantageOn.join(", ")}\n`;
    if (c.effects.cantDo?.length) text += `- Cannot: ${c.effects.cantDo.join(", ")}\n`;
    if (c.effects.autoFail?.length) text += `- Auto-fail: ${c.effects.autoFail.join(", ")}\n`;
    if (c.effects.speed !== undefined) text += `- Speed: ${c.effects.speed}\n`;
  }
  if (c.source) text += `\n*Source: ${c.source}*`;
  return text;
}

function formatMagicItem(item: MagicItemData): string {
  let text = `# ${item.name}\n*${item.type}, ${item.rarity}`;
  if (item.attunement) {
    text += item.attunementReq ? ` (requires attunement ${item.attunementReq})` : " (requires attunement)";
  }
  text += "*\n\n";
  if (item.acBonus) text += `**AC Bonus:** +${item.acBonus}\n`;
  if (item.attackBonus) text += `**Attack Bonus:** +${item.attackBonus}\n`;
  if (item.damageBonus) text += `**Damage Bonus:** +${item.damageBonus}\n`;
  text += `${item.description}`;
  if (item.source) text += `\n\n*Source: ${item.source}*`;
  return text;
}

function formatFeat(f: FeatData): string {
  let text = `# ${f.name}\n*${f.category} feat*`;
  if (f.prerequisite) text += ` *(Prerequisite: ${f.prerequisite})*`;
  if (f.repeatable) text += " *(Repeatable)*";
  text += "\n\n";
  text += f.description;
  if (f.abilityScoreIncrease?.length) text += `\n\n**Ability Score Increase:** ${f.abilityScoreIncrease.join(", ")}`;
  if (f.advantages?.length) {
    text += "\n\n**Advantages:**\n";
    for (const a of f.advantages) {
      text += `- ${a.type} on ${a.subType}`;
      if (a.restriction) text += ` (${a.restriction})`;
      text += "\n";
    }
  }
  if (f.proficiencies) {
    const parts: string[] = [];
    if (f.proficiencies.armor?.length) parts.push(`Armor: ${f.proficiencies.armor.join(", ")}`);
    if (f.proficiencies.weapons?.length) parts.push(`Weapons: ${f.proficiencies.weapons.join(", ")}`);
    if (f.proficiencies.tools?.length) parts.push(`Tools: ${f.proficiencies.tools.join(", ")}`);
    if (parts.length) text += `\n\n**Proficiencies:** ${parts.join("; ")}`;
  }
  if (f.resistances?.length) text += `\n\n**Resistances:** ${f.resistances.join(", ")}`;
  if (f.speed) text += `\n\n**Speed:** +${f.speed} ft.`;
  if (f.senses && Object.keys(f.senses).length > 0) {
    text += `\n\n**Senses:** ${Object.entries(f.senses).map(([k, v]) => `${k} ${v} ft.`).join(", ")}`;
  }
  if (f.source) text += `\n\n*Source: ${f.source}*`;
  return text;
}

function formatClass(c: ClassData): string {
  let text = `# ${c.name}\n\n`;
  text += `**Hit Die:** d${c.hitDice}\n`;
  text += `**Primary Ability:** ${c.primaryAbility}\n`;
  text += `**Saving Throws:** ${c.savingThrows.join(", ")}\n`;
  if (c.armorProficiencies.length) text += `**Armor Proficiencies:** ${c.armorProficiencies.join(", ")}\n`;
  if (c.weaponProficiencies.length) text += `**Weapon Proficiencies:** ${c.weaponProficiencies.join(", ")}\n`;
  if (c.toolProficiencies.length) text += `**Tool Proficiencies:** ${c.toolProficiencies.join(", ")}\n`;
  text += `**Skill Choices:** Choose ${c.skillChoices.count} from ${c.skillChoices.from.join(", ")}\n`;
  if (c.spellcastingAbility) text += `**Spellcasting Ability:** ${c.spellcastingAbility}\n`;
  if (c.casterType) text += `**Caster Type:** ${c.casterType}\n`;
  if (c.multiclassPrerequisites) text += `**Multiclass Prerequisites:** ${c.multiclassPrerequisites}\n`;

  if (c.resources.length > 0) {
    text += "\n**Class Resources:**\n";
    for (const r of c.resources) {
      const uses = typeof r.uses === "number" ? `${r.uses}` : `${r.uses.abilityMod} modifier (min ${r.uses.minimum ?? 1})`;
      text += `- **${r.name}** (level ${r.levelAvailable}+): ${uses} uses, resets on ${r.resetType} rest\n`;
    }
  }

  if (c.features.length > 0) {
    text += "\n**Features:**\n";
    for (const f of c.features) {
      text += `- **${f.name}** (level ${f.level}): ${f.description.slice(0, 200)}${f.description.length > 200 ? "..." : ""}\n`;
    }
  }

  if (c.subclasses.length > 0) {
    text += `\n**Subclasses:** ${c.subclasses.map(s => s.name).join(", ")}\n`;
  }

  if (c.source) text += `\n*Source: ${c.source}*`;
  return text;
}

function formatSpecies(s: SpeciesData): string {
  let text = `# ${s.name}\n\n`;
  text += `**Size:** ${s.size.join("/")}\n`;
  text += `**Speed:** ${s.speed} ft.\n`;
  if (s.darkvision) text += `**Darkvision:** ${s.darkvision} ft.\n`;
  if (s.resistances?.length) text += `**Resistances:** ${s.resistances.join(", ")}\n`;
  if (s.languages?.length) text += `**Languages:** ${s.languages.join(", ")}\n`;

  if (s.advantages?.length) {
    text += "\n**Advantages:**\n";
    for (const a of s.advantages) {
      text += `- ${a.type} on ${a.subType}`;
      if (a.restriction) text += ` (${a.restriction})`;
      text += "\n";
    }
  }

  if (s.traits.length > 0) {
    text += "\n**Traits:**\n";
    for (const t of s.traits) {
      text += `- **${t.name}.** ${t.description}\n`;
    }
  }

  if (s.source) text += `\n*Source: ${s.source}*`;
  return text;
}

function formatBackground(b: BackgroundData): string {
  let text = `# ${b.name}\n\n`;
  text += b.description + "\n\n";
  text += `**Skill Proficiencies:** ${b.skillProficiencies.join(", ")}\n`;
  if (b.toolProficiency) text += `**Tool Proficiency:** ${b.toolProficiency}\n`;
  text += `**Feat:** ${b.feat}\n`;
  text += `**Ability Scores:** ${b.abilityScores.join(", ")}\n`;
  if (b.equipment.length) text += `**Equipment:** ${b.equipment.join(", ")}\n`;
  if (b.source) text += `\n*Source: ${b.source}*`;
  return text;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Send a visible "[Rules]" system event to the activity log when lookup fails. */
function logLookupFailure(wsClient: WSClient, category: string, name: string): void {
  wsClient.broadcastSystemEvent(
    `[Rules] "${name}" not found in any source — DM is using training knowledge`
  );
  console.error(`[srd-tools] ${category} lookup failed: "${name}"`);
}

function notFoundResult(category: string, name: string) {
  return {
    content: [{
      type: "text" as const,
      text: `"${name}" not found in the D&D 2024 database. Use your training knowledge as fallback.`,
    }],
  };
}

// ─── Tool Registration ──────────────────────────────────────

export function registerSrdTools(
  server: McpServer,
  wsClient: WSClient
): void {
  server.tool(
    "lookup_spell",
    "Look up a spell from the D&D 2024 database. Call this BEFORE resolving any spell cast.",
    {
      spell_name: z.string().describe("Spell name, e.g. 'Fireball', 'Cure Wounds', 'Shield', 'Silvery Barbs'"),
    },
    async ({ spell_name }) => {
      wsClient.sendTypingIndicator(true);

      const spell = getSpell(spell_name);
      if (spell) {
        return { content: [{ type: "text" as const, text: formatSpell(spell) }] };
      }

      logLookupFailure(wsClient, "Spell", spell_name);
      return notFoundResult("Spell", spell_name);
    }
  );

  server.tool(
    "lookup_monster",
    "Look up a monster/creature stat block from the D&D 2024 database. Call this for every enemy type BEFORE combat.",
    {
      monster_name: z.string().describe("Monster name, e.g. 'Goblin', 'Adult Red Dragon', 'Bugbear'"),
    },
    async ({ monster_name }) => {
      wsClient.sendTypingIndicator(true);

      const monster = getMonster(monster_name);
      if (monster) {
        return { content: [{ type: "text" as const, text: formatMonster(monster) }] };
      }

      logLookupFailure(wsClient, "Monster", monster_name);
      return notFoundResult("Monster", monster_name);
    }
  );

  server.tool(
    "lookup_condition",
    "Look up the exact mechanical effects of a D&D condition from the D&D 2024 database. Call this BEFORE applying any condition.",
    {
      condition_name: z.string().describe("Condition name, e.g. 'Grappled', 'Stunned', 'Prone', 'Frightened'"),
    },
    async ({ condition_name }) => {
      wsClient.sendTypingIndicator(true);

      const condition = getCondition(condition_name);
      if (condition) {
        return { content: [{ type: "text" as const, text: formatCondition(condition) }] };
      }

      logLookupFailure(wsClient, "Condition", condition_name);
      return notFoundResult("Condition", condition_name);
    }
  );

  server.tool(
    "lookup_magic_item",
    "Look up a magic item from the D&D 2024 database. Returns rarity, attunement, and full description.",
    {
      item_name: z.string().describe("Magic item name, e.g. 'Bag of Holding', 'Flame Tongue'"),
    },
    async ({ item_name }) => {
      wsClient.sendTypingIndicator(true);

      const item = getMagicItem(item_name);
      if (item) {
        return { content: [{ type: "text" as const, text: formatMagicItem(item) }] };
      }

      logLookupFailure(wsClient, "Magic Item", item_name);
      return notFoundResult("Magic Item", item_name);
    }
  );

  server.tool(
    "lookup_feat",
    "Look up a feat from the D&D 2024 database. Returns prerequisites, description, and mechanical effects.",
    {
      feat_name: z.string().describe("Feat name, e.g. 'Alert', 'Great Weapon Master'"),
    },
    async ({ feat_name }) => {
      wsClient.sendTypingIndicator(true);

      const feat = getFeat(feat_name);
      if (feat) {
        return { content: [{ type: "text" as const, text: formatFeat(feat) }] };
      }

      logLookupFailure(wsClient, "Feat", feat_name);
      return notFoundResult("Feat", feat_name);
    }
  );

  server.tool(
    "lookup_class",
    "Look up a D&D class from the D&D 2024 database. Returns hit die, spellcasting, features, subclasses, and resources.",
    {
      class_name: z.string().describe("Class name, e.g. 'Paladin', 'Rogue', 'Wizard'"),
    },
    async ({ class_name }) => {
      wsClient.sendTypingIndicator(true);

      const cls = getClass(class_name);
      if (cls) {
        return { content: [{ type: "text" as const, text: formatClass(cls) }] };
      }

      logLookupFailure(wsClient, "Class", class_name);
      return notFoundResult("Class", class_name);
    }
  );

  server.tool(
    "lookup_species",
    "Look up a D&D species/race from the D&D 2024 database. Returns size, speed, traits, and abilities.",
    {
      species_name: z.string().describe("Species name, e.g. 'Tiefling', 'Aasimar', 'Goliath', 'Kenku'"),
    },
    async ({ species_name }) => {
      wsClient.sendTypingIndicator(true);

      const sp = getSpecies(species_name);
      if (sp) {
        return { content: [{ type: "text" as const, text: formatSpecies(sp) }] };
      }

      logLookupFailure(wsClient, "Species", species_name);
      return notFoundResult("Species", species_name);
    }
  );

  server.tool(
    "lookup_background",
    "Look up a D&D background from the D&D 2024 database. Returns skill proficiencies, feat, ability scores, and equipment.",
    {
      background_name: z.string().describe("Background name, e.g. 'Noble', 'Criminal', 'Sage', 'Haunted One'"),
    },
    async ({ background_name }) => {
      wsClient.sendTypingIndicator(true);

      const bg = getBackground(background_name);
      if (bg) {
        return { content: [{ type: "text" as const, text: formatBackground(bg) }] };
      }

      logLookupFailure(wsClient, "Background", background_name);
      return notFoundResult("Background", background_name);
    }
  );

  server.tool(
    "search_rules",
    "Search the D&D 2024 database for rules, spells, monsters, items, feats, conditions, classes, species, and backgrounds matching a query. Use for general rules questions or when you don't know the exact name.",
    {
      query: z.string().describe("Search query, e.g. 'opportunity attack', 'fire damage spell', 'flying creature'"),
      limit: z.number().optional().default(5).describe("Max results to return (default 5)"),
    },
    async ({ query, limit }) => {
      wsClient.sendTypingIndicator(true);

      const results: string[] = [];

      // Search across all data types
      const matchedSpells = searchSpells(query).slice(0, limit);
      const matchedMonsters = searchMonsters(query).slice(0, limit);
      const matchedItems = searchMagicItems(query).slice(0, limit);
      const matchedFeats = searchFeats(query).slice(0, limit);

      // Also check conditions, classes, species, backgrounds by name match
      const lowerQuery = query.toLowerCase();

      const matchedConditions = conditionsArray.filter(c =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.description.toLowerCase().includes(lowerQuery)
      ).slice(0, limit);

      const matchedClasses = classesArray.filter(c =>
        c.name.toLowerCase().includes(lowerQuery)
      ).slice(0, limit);

      const matchedSpecies = speciesArray.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.traits.some(t => t.name.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery))
      ).slice(0, limit);

      const matchedBackgrounds = backgroundsArray.filter(b =>
        b.name.toLowerCase().includes(lowerQuery) ||
        b.description.toLowerCase().includes(lowerQuery)
      ).slice(0, limit);

      if (matchedConditions.length > 0) {
        results.push("## Conditions\n" + matchedConditions.map(c => formatCondition(c)).join("\n\n---\n\n"));
      }
      if (matchedClasses.length > 0) {
        results.push("## Classes\n" + matchedClasses.map(c => `- **${c.name}** (d${c.hitDice}, ${c.casterType ?? "non-caster"})`).join("\n"));
      }
      if (matchedSpells.length > 0) {
        results.push("## Spells\n" + matchedSpells.map(s => `- **${s.name}** (${s.level === 0 ? "cantrip" : `level ${s.level}`} ${s.school}): ${s.description.slice(0, 150)}...`).join("\n"));
      }
      if (matchedMonsters.length > 0) {
        results.push("## Monsters\n" + matchedMonsters.map(m => `- **${m.name}** (CR ${m.cr}, ${m.size} ${m.type})`).join("\n"));
      }
      if (matchedItems.length > 0) {
        results.push("## Magic Items\n" + matchedItems.map(i => `- **${i.name}** (${i.rarity}, ${i.type})`).join("\n"));
      }
      if (matchedFeats.length > 0) {
        results.push("## Feats\n" + matchedFeats.map(f => `- **${f.name}** (${f.category}): ${f.description.slice(0, 150)}...`).join("\n"));
      }
      if (matchedSpecies.length > 0) {
        results.push("## Species\n" + matchedSpecies.map(s => `- **${s.name}** (${s.size.join("/")}, speed ${s.speed} ft.)`).join("\n"));
      }
      if (matchedBackgrounds.length > 0) {
        results.push("## Backgrounds\n" + matchedBackgrounds.map(b => `- **${b.name}**: ${b.description.slice(0, 150)}...`).join("\n"));
      }

      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No results found matching "${query}" in the D&D 2024 database. Use your training knowledge as fallback.`,
          }],
        };
      }

      return { content: [{ type: "text" as const, text: results.join("\n\n") }] };
    }
  );
}
