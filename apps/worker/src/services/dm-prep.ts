// === DM Prep Phase ===
// Runs once on story start. Pre-fetches party spell details from dnd5eapi.co
// and builds a concise prep summary for the system prompt.

import type { CharacterData } from "@aidnd/shared/types";
import { lookupSpell, formatSpellForAI } from "./dnd-api";

export interface PrepResult {
  prepSummary: string;
}

const MAX_SPELLS_TO_FETCH = 30;
const MAX_SUMMARY_LENGTH = 3000;

/**
 * Run the DM Prep phase: fetch spell details for all party spells
 * and build a concise summary of party capabilities.
 *
 * This is intentionally non-fatal — if API calls fail, we return
 * a minimal summary using available character data.
 */
export async function runDMPrep(
  characters: Record<string, CharacterData>,
  kv: KVNamespace,
): Promise<PrepResult> {
  const entries = Object.entries(characters);
  if (entries.length === 0) {
    return { prepSummary: "" };
  }

  // 1. Collect unique spell names from all characters
  const uniqueSpells = new Map<string, { name: string; level: number; casters: string[] }>();

  for (const [, char] of entries) {
    const charName = char.static.name;
    for (const spell of char.static.spells) {
      if (!spell.prepared && !spell.alwaysPrepared) continue; // Skip unprepared spells
      const key = spell.name.toLowerCase();
      const existing = uniqueSpells.get(key);
      if (existing) {
        if (!existing.casters.includes(charName)) {
          existing.casters.push(charName);
        }
      } else {
        uniqueSpells.set(key, {
          name: spell.name,
          level: spell.level,
          casters: [charName],
        });
      }
    }
  }

  // 2. Fetch spell details (up to MAX_SPELLS_TO_FETCH, prioritize leveled spells)
  const spellsToFetch = [...uniqueSpells.values()]
    .sort((a, b) => b.level - a.level) // Higher level spells first
    .slice(0, MAX_SPELLS_TO_FETCH);

  const spellSummaries: string[] = [];

  const results = await Promise.allSettled(
    spellsToFetch.map(async (s) => {
      const data = await lookupSpell(s.name, kv);
      if (data) {
        return {
          name: s.name,
          level: s.level,
          casters: s.casters,
          formatted: formatSpellForAI(data),
        };
      }
      return null;
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const r = result.value;
      // Compact: just the key details, not the full formatted block
      const casterStr = r.casters.join(", ");
      spellSummaries.push(`[${r.name} (Lvl ${r.level}) - used by: ${casterStr}]`);
    }
  }

  // 3. Build the prep summary
  const lines: string[] = [];
  lines.push("## DM PREP — Party Capabilities Reference");
  lines.push("");

  // Party composition
  for (const [playerName, char] of entries) {
    const s = char.static;
    const classes = s.classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`).join(" / ");
    const spellCount = s.spells.filter((sp) => sp.prepared || sp.alwaysPrepared).length;
    const spellInfo = spellCount > 0
      ? ` | ${spellCount} prepared spells, Spell Save DC ${s.spellSaveDC ?? "?"}`
      : "";
    lines.push(`**${s.name}** (played by ${playerName}): ${s.race} ${classes} | AC ${s.armorClass} | HP ${char.dynamic.currentHP}/${s.maxHP}${spellInfo}`);
  }

  if (spellSummaries.length > 0) {
    lines.push("");
    lines.push("**Party spells pre-fetched (use these for accurate mechanics):**");
    lines.push(spellSummaries.join(", "));
    lines.push("_When any of these spells are cast, you already have their details cached. Use lookup_spell to retrieve the full mechanics._");
  }

  let summary = lines.join("\n");

  // Truncate if too long
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.slice(0, MAX_SUMMARY_LENGTH) + "\n...(truncated)";
  }

  return { prepSummary: summary };
}
