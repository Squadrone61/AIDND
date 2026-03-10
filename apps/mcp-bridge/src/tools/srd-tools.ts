import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SrdLookup } from "../services/srd-lookup.js";
import type { DndDataLookup } from "../services/dnd-data-lookup.js";
import type { WSClient } from "../ws-client.js";

type SourceFilter = "2024" | "official" | "all";

const sourceFilterSchema = z
  .enum(["2024", "official", "all"])
  .optional()
  .default("official")
  .describe("Source filter: '2024' = 2024 rules only, 'official' = all WotC books (default), 'all' = include third-party");

/** Send a visible "[Rules]" system event to the activity log when all sources fail. */
function logLookupFailure(wsClient: WSClient, category: string, name: string): void {
  wsClient.broadcastSystemEvent(
    `[Rules] "${name}" not found in any source — DM is using training knowledge`
  );
  console.error(`[srd-tools] ${category} lookup failed in all sources: "${name}"`);
}

const EXTENDED_PREFIX = "📚 [Extended Database] Not in SRD 5.2 — sourced from published D&D content:\n\n";
const SRD51_PREFIX = "⚠️ Using 2014 SRD 5.1 stats (not in 2024 SRD 5.2 or extended database):\n\n";

export function registerSrdTools(
  server: McpServer,
  srd52: SrdLookup,
  srd51: SrdLookup,
  dndData: DndDataLookup,
  wsClient: WSClient
): void {
  server.tool(
    "lookup_spell",
    "Look up a spell from D&D rules. Checks 2024 SRD 5.2 first, then extended database (5,849 spells from 177+ sourcebooks), then 2014 SRD 5.1. Call this BEFORE resolving any spell cast.",
    {
      spell_name: z.string().describe("Spell name, e.g. 'Fireball', 'Cure Wounds', 'Shield', 'Silvery Barbs'"),
      source: sourceFilterSchema,
    },
    async ({ spell_name, source }) => {
      wsClient.sendTypingIndicator(true);

      // SRD 5.2 (best quality, curated markdown)
      const content = srd52.lookupSpell(spell_name);
      if (content) {
        return { content: [{ type: "text" as const, text: content }] };
      }

      // Extended database (5,849 spells from 177+ sourcebooks)
      const extended = dndData.lookupSpell(spell_name, source as SourceFilter);
      if (extended) {
        return { content: [{ type: "text" as const, text: EXTENDED_PREFIX + extended }] };
      }

      // SRD 5.1 last resort
      const fallback = srd51.lookupSpell(spell_name);
      if (fallback) {
        return { content: [{ type: "text" as const, text: SRD51_PREFIX + fallback }] };
      }

      logLookupFailure(wsClient, "Spell", spell_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ "${spell_name}" not found in any source. Use your training knowledge as fallback.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_monster",
    "Look up a monster/creature stat block from D&D rules. Checks 2024 SRD 5.2 first, then extended database (11,463 monsters from 177+ sourcebooks), then 2014 SRD 5.1. Call this for every enemy type BEFORE combat.",
    {
      monster_name: z.string().describe("Monster name, e.g. 'Goblin', 'Adult Red Dragon', 'Bugbear'"),
      source: sourceFilterSchema,
    },
    async ({ monster_name, source }) => {
      wsClient.sendTypingIndicator(true);

      const content = srd52.lookupMonster(monster_name);
      if (content) {
        return { content: [{ type: "text" as const, text: content }] };
      }

      const extended = dndData.lookupMonster(monster_name, source as SourceFilter);
      if (extended) {
        return { content: [{ type: "text" as const, text: EXTENDED_PREFIX + extended }] };
      }

      const fallback = srd51.lookupMonster(monster_name);
      if (fallback) {
        return { content: [{ type: "text" as const, text: SRD51_PREFIX + fallback }] };
      }

      logLookupFailure(wsClient, "Monster", monster_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ "${monster_name}" not found in any source. Use your training knowledge for this creature's stats.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_condition",
    "Look up the exact mechanical effects of a D&D condition. Checks 2024 SRD 5.2 first, falls back to 2014 SRD 5.1. Call this BEFORE applying any condition.",
    {
      condition_name: z.string().describe("Condition name, e.g. 'Grappled', 'Stunned', 'Prone', 'Frightened'"),
    },
    async ({ condition_name }) => {
      wsClient.sendTypingIndicator(true);
      const content = srd52.lookupCondition(condition_name);
      if (content) {
        return { content: [{ type: "text" as const, text: content }] };
      }

      // 5.2: also try glossary as fallback (some conditions may not have the tag)
      const glossary = srd52.lookupGlossary(condition_name);
      if (glossary) {
        return { content: [{ type: "text" as const, text: glossary }] };
      }

      // Fall back to 5.1
      const fallback = srd51.lookupCondition(condition_name);
      if (fallback) {
        return { content: [{ type: "text" as const, text: SRD51_PREFIX + fallback }] };
      }

      logLookupFailure(wsClient, "Condition", condition_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ Condition "${condition_name}" not found in either SRD.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_magic_item",
    "Look up a magic item from D&D rules. Checks 2024 SRD 5.2 first, then extended database (15,749 items), then 2014 SRD 5.1. Returns rarity, attunement, and full description.",
    {
      item_name: z.string().describe("Magic item name, e.g. 'Bag of Holding', 'Flame Tongue'"),
      source: sourceFilterSchema,
    },
    async ({ item_name, source }) => {
      wsClient.sendTypingIndicator(true);

      const content = srd52.lookupMagicItem(item_name);
      if (content) {
        return { content: [{ type: "text" as const, text: content }] };
      }

      const extended = dndData.lookupItem(item_name, source as SourceFilter);
      if (extended) {
        return { content: [{ type: "text" as const, text: EXTENDED_PREFIX + extended }] };
      }

      const fallback = srd51.lookupMagicItem(item_name);
      if (fallback) {
        return { content: [{ type: "text" as const, text: SRD51_PREFIX + fallback }] };
      }

      logLookupFailure(wsClient, "Magic Item", item_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ Magic item "${item_name}" not found in any source. Use your training knowledge as fallback.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_feat",
    "Look up a feat from D&D rules. Checks 2024 SRD 5.2 first, then 2014 SRD 5.1. Returns prerequisites, description, and mechanical effects.",
    {
      feat_name: z.string().describe("Feat name, e.g. 'Alert', 'Great Weapon Master'"),
      source: sourceFilterSchema,
    },
    async ({ feat_name, source }) => {
      wsClient.sendTypingIndicator(true);

      const content = srd52.lookupFeat(feat_name);
      if (content) {
        return { content: [{ type: "text" as const, text: content }] };
      }

      const fallback = srd51.lookupFeat(feat_name);
      if (fallback) {
        return { content: [{ type: "text" as const, text: SRD51_PREFIX + fallback }] };
      }

      // No feat-specific category in dnd-data, but items might cover some feat-adjacent content
      logLookupFailure(wsClient, "Feat", feat_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ Feat "${feat_name}" not found in any source. Use your training knowledge as fallback.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_class",
    "Look up a D&D class or subclass from the extended database (134 classes/subclasses from 177+ sourcebooks). Returns hit die, spellcasting, and class description.",
    {
      class_name: z.string().describe("Class or subclass name, e.g. 'Paladin', 'Arcane Trickster', 'Echo Knight'"),
      source: sourceFilterSchema,
    },
    async ({ class_name, source }) => {
      wsClient.sendTypingIndicator(true);

      const extended = dndData.lookupClass(class_name, source as SourceFilter);
      if (extended) {
        return { content: [{ type: "text" as const, text: extended }] };
      }

      logLookupFailure(wsClient, "Class", class_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ Class "${class_name}" not found. Use your training knowledge as fallback.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_species",
    "Look up a D&D species/race from the extended database (383 species from 177+ sourcebooks). Returns size, speed, traits, and lore.",
    {
      species_name: z.string().describe("Species name, e.g. 'Tiefling', 'Aasimar', 'Goliath', 'Kenku'"),
      source: sourceFilterSchema,
    },
    async ({ species_name, source }) => {
      wsClient.sendTypingIndicator(true);

      const extended = dndData.lookupSpecies(species_name, source as SourceFilter);
      if (extended) {
        return { content: [{ type: "text" as const, text: extended }] };
      }

      logLookupFailure(wsClient, "Species", species_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ Species "${species_name}" not found. Use your training knowledge as fallback.`,
        }],
      };
    }
  );

  server.tool(
    "lookup_background",
    "Look up a D&D background from the extended database (405 backgrounds from 177+ sourcebooks). Returns features, personality traits, ideals, bonds, and flaws.",
    {
      background_name: z.string().describe("Background name, e.g. 'Noble', 'Criminal', 'Sage', 'Haunted One'"),
      source: sourceFilterSchema,
    },
    async ({ background_name, source }) => {
      wsClient.sendTypingIndicator(true);

      const extended = dndData.lookupBackground(background_name, source as SourceFilter);
      if (extended) {
        return { content: [{ type: "text" as const, text: extended }] };
      }

      logLookupFailure(wsClient, "Background", background_name);
      return {
        content: [{
          type: "text" as const,
          text: `⚠️ Background "${background_name}" not found. Use your training knowledge as fallback.`,
        }],
      };
    }
  );

  server.tool(
    "search_rules",
    "Search all D&D rules (2024 SRD 5.2 + 2014 SRD 5.1) for any topic: combat mechanics, class features, equipment, gameplay rules, etc. Returns the most relevant rule sections, preferring 2024 rules when available.",
    {
      query: z.string().describe("Search query, e.g. 'opportunity attack', 'two-weapon fighting', 'death saving throw'"),
      limit: z.number().optional().default(3).describe("Max results to return (default 3)"),
    },
    async ({ query, limit }) => {
      wsClient.sendTypingIndicator(true);

      // Search both SRDs, merge results with 5.2 ranked higher
      const results52 = srd52.searchRules(query, limit);
      const results51 = srd51.searchRules(query, limit);

      // Tag 5.1 results and merge
      const tagged51 = results51.map(r => ({
        ...r,
        source: `${r.source} [2014 SRD 5.1]`,
      }));

      // Interleave: all 5.2 results first, then 5.1 results (deduped by name)
      const seen = new Set(results52.map(r => r.name.toLowerCase()));
      const merged = [
        ...results52,
        ...tagged51.filter(r => !seen.has(r.name.toLowerCase())),
      ].slice(0, limit);

      if (merged.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No rules found matching "${query}" in either SRD. Use your training knowledge as fallback.`,
          }],
        };
      }

      const text = merged
        .map((r, i) => `--- Result ${i + 1}: ${r.name} (${r.source}) ---\n${r.content}`)
        .join("\n\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
