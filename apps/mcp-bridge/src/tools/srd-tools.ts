import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SrdLookup } from "../services/srd-lookup.js";
import type { WSClient } from "../ws-client.js";

/** Send a visible "[Rules]" system event to the activity log when a lookup fails. */
function logLookupFailure(wsClient: WSClient, category: string, name: string): void {
  wsClient.broadcastSystemEvent(
    `[Rules] "${name}" not found in SRD 5.2 — DM is using training knowledge`
  );
  console.error(`[srd-tools] ${category} lookup failed: "${name}"`);
}

export function registerSrdTools(server: McpServer, srd: SrdLookup, wsClient: WSClient): void {
  server.tool(
    "lookup_spell",
    "Look up a spell from 2024 D&D rules (SRD 5.2). Returns full spell details including casting time, range, components, duration, damage, and higher-level effects. Call this BEFORE resolving any spell cast.",
    {
      spell_name: z.string().describe("Spell name, e.g. 'Fireball', 'Cure Wounds', 'Shield'"),
    },
    async ({ spell_name }) => {
      wsClient.sendTypingIndicator(true);
      const content = srd.lookupSpell(spell_name);
      if (!content) {
        logLookupFailure(wsClient, "Spell", spell_name);
        return {
          content: [{
            type: "text" as const,
            text: `⚠️ "${spell_name}" not found in SRD 5.2. It may be from a published sourcebook not in the SRD. Use your training knowledge as fallback.`,
          }],
        };
      }
      return { content: [{ type: "text" as const, text: content }] };
    }
  );

  server.tool(
    "lookup_monster",
    "Look up a monster/creature stat block from 2024 D&D rules (SRD 5.2). Returns full stat block with AC, HP, speed, abilities, actions, and CR. Call this for every enemy type BEFORE combat.",
    {
      monster_name: z.string().describe("Monster name, e.g. 'Goblin', 'Adult Red Dragon', 'Beholder'"),
    },
    async ({ monster_name }) => {
      wsClient.sendTypingIndicator(true);
      const content = srd.lookupMonster(monster_name);
      if (!content) {
        logLookupFailure(wsClient, "Monster", monster_name);
        return {
          content: [{
            type: "text" as const,
            text: `⚠️ "${monster_name}" not found in SRD 5.2. Use your training knowledge for this creature's stats.`,
          }],
        };
      }
      return { content: [{ type: "text" as const, text: content }] };
    }
  );

  server.tool(
    "lookup_condition",
    "Look up the exact mechanical effects of a D&D 2024 condition from the SRD 5.2. Call this BEFORE applying any condition.",
    {
      condition_name: z.string().describe("Condition name, e.g. 'Grappled', 'Stunned', 'Prone', 'Frightened'"),
    },
    async ({ condition_name }) => {
      wsClient.sendTypingIndicator(true);
      const content = srd.lookupCondition(condition_name);
      if (!content) {
        // Try glossary as fallback (some conditions may not have the tag)
        const glossary = srd.lookupGlossary(condition_name);
        if (glossary) {
          return { content: [{ type: "text" as const, text: glossary }] };
        }
        logLookupFailure(wsClient, "Condition", condition_name);
        return {
          content: [{
            type: "text" as const,
            text: `⚠️ Condition "${condition_name}" not found in SRD 5.2.`,
          }],
        };
      }
      return { content: [{ type: "text" as const, text: content }] };
    }
  );

  server.tool(
    "lookup_magic_item",
    "Look up a magic item from 2024 D&D rules (SRD 5.2). Returns rarity, attunement, and full description.",
    {
      item_name: z.string().describe("Magic item name, e.g. 'Bag of Holding', 'Flame Tongue'"),
    },
    async ({ item_name }) => {
      wsClient.sendTypingIndicator(true);
      const content = srd.lookupMagicItem(item_name);
      if (!content) {
        logLookupFailure(wsClient, "Magic Item", item_name);
        return {
          content: [{
            type: "text" as const,
            text: `⚠️ Magic item "${item_name}" not found in SRD 5.2. Use your training knowledge as fallback.`,
          }],
        };
      }
      return { content: [{ type: "text" as const, text: content }] };
    }
  );

  server.tool(
    "lookup_feat",
    "Look up a feat from 2024 D&D rules (SRD 5.2). Returns prerequisites, description, and mechanical effects.",
    {
      feat_name: z.string().describe("Feat name, e.g. 'Alert', 'Great Weapon Master'"),
    },
    async ({ feat_name }) => {
      wsClient.sendTypingIndicator(true);
      const content = srd.lookupFeat(feat_name);
      if (!content) {
        logLookupFailure(wsClient, "Feat", feat_name);
        return {
          content: [{
            type: "text" as const,
            text: `⚠️ Feat "${feat_name}" not found in SRD 5.2. Use your training knowledge as fallback.`,
          }],
        };
      }
      return { content: [{ type: "text" as const, text: content }] };
    }
  );

  server.tool(
    "search_rules",
    "Search all 2024 D&D rules (SRD 5.2) for any topic: combat mechanics, class features, equipment, gameplay rules, etc. Returns the most relevant rule sections matching your query.",
    {
      query: z.string().describe("Search query, e.g. 'opportunity attack', 'two-weapon fighting', 'death saving throw'"),
      limit: z.number().optional().default(3).describe("Max results to return (default 3)"),
    },
    async ({ query, limit }) => {
      wsClient.sendTypingIndicator(true);
      const results = srd.searchRules(query, limit);
      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No rules found matching "${query}" in SRD 5.2. Use your training knowledge as fallback.`,
          }],
        };
      }

      const text = results
        .map((r, i) => `--- Result ${i + 1}: ${r.name} (${r.source}) ---\n${r.content}`)
        .join("\n\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
