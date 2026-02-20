import {
  lookupSpell,
  lookupCondition,
  formatSpellForAI,
  formatConditionForAI,
} from "./dnd-api";

const DND_CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
];

const CAST_PATTERNS = [
  /\bcast(?:s|ing)?\s+(.+?)(?:\s+(?:at|on|against|toward|towards)\b|[.!?,]|$)/i,
  /\buse(?:s|ing)?\s+(.+?)(?:\s+(?:on|against)\b|[.!?,]|$)/i,
  /\bactivate(?:s|ing)?\s+(.+?)(?:[.!?,]|$)/i,
];

export interface DetectedReferences {
  spellNames: string[];
  conditionNames: string[];
}

/**
 * Detect D&D references in a player message.
 * Uses simple heuristics — no AI calls needed.
 */
export function detectReferences(
  message: string,
  partySpells: string[],
): DetectedReferences {
  const lowerMessage = message.toLowerCase();
  const spellNames = new Set<string>();
  const conditionNames = new Set<string>();

  for (const pattern of CAST_PATTERNS) {
    const match = lowerMessage.match(pattern);
    if (match?.[1]) {
      const spellCandidate = match[1].trim();
      // Only add if it looks like a spell name (2-40 chars, no weird characters)
      if (spellCandidate.length >= 2 && spellCandidate.length <= 40) {
        spellNames.add(spellCandidate);
      }
    }
  }

  for (const spell of partySpells) {
    if (lowerMessage.includes(spell.toLowerCase())) {
      spellNames.add(spell.toLowerCase());
    }
  }

  for (const condition of DND_CONDITIONS) {
    // Word boundary match to avoid false positives
    const regex = new RegExp(`\\b${condition}\\b`, "i");
    if (regex.test(lowerMessage)) {
      conditionNames.add(condition);
    }
  }

  return {
    spellNames: [...spellNames],
    conditionNames: [...conditionNames],
  };
}

/**
 * Fetch and format context for detected references.
 * Returns a text block to inject before the user message, or null if nothing found.
 */
export async function buildInjectedContext(
  refs: DetectedReferences,
  kv: KVNamespace,
): Promise<string | null> {
  const parts: string[] = [];

  const spellResults = await Promise.allSettled(
    refs.spellNames.map(async (name) => {
      const spell = await lookupSpell(name, kv);
      return spell ? formatSpellForAI(spell) : null;
    }),
  );

  for (const result of spellResults) {
    if (result.status === "fulfilled" && result.value) {
      parts.push(result.value);
    }
  }

  const conditionResults = await Promise.allSettled(
    refs.conditionNames.map(async (name) => {
      const condition = await lookupCondition(name, kv);
      return condition ? formatConditionForAI(condition) : null;
    }),
  );

  for (const result of conditionResults) {
    if (result.status === "fulfilled" && result.value) {
      parts.push(result.value);
    }
  }

  if (parts.length === 0) return null;

  return `[System: D&D Reference]\n${parts.join("\n\n")}`;
}
