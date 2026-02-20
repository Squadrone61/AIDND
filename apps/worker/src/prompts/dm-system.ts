import type {
  CampaignJournal,
  CharacterData,
  CombatState,
  PacingProfile,
  EncounterLength,
} from "@aidnd/shared/types";
import { buildCharacterContextBlock } from "@aidnd/shared/utils";
import { DEFAULT_DM_PROMPT } from "@aidnd/shared";

const CHARACTER_RULES = `

CHARACTER RULES:
- Address characters by their character name (not the player's real name) during narration
- Reference character abilities, class features, and equipment when relevant to the story
- When a character attempts an action, consider their ability scores and proficiencies
- Note when a spell or ability would be appropriate for the situation
- If a character's HP is low, describe them as visibly wounded or exhausted
- If a character has a WARNING in their sheet (low HP, no spell slots), respect it — do NOT allow actions that require depleted resources
- Use character backgrounds, traits, and bonds to enrich interactions`;

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

## STRUCTURED GAME ACTIONS

CRITICAL: When game-mechanical events occur, you MUST include a JSON action block alongside your narrative. Embed actions in a fenced code block tagged \`json:actions\`:

\`\`\`json:actions
{ "actions": [ ... ] }
\`\`\`

### Available Action Types:

**Checks (ALWAYS use when outcome is uncertain):**
\`\`\`
{ "type": "check_request", "check": {
    "type": "skill" | "ability" | "saving_throw" | "attack" | "custom",
    "skill": "perception",       // for skill checks
    "ability": "strength",        // for ability checks / saving throws
    "dc": 15,                     // difficulty class
    "targetCharacter": "Thorin",  // character name
    "advantage": false,
    "disadvantage": false,
    "reason": "Searching the room for hidden doors"
  }}
\`\`\`

**Damage & Healing:**
\`\`\`
{ "type": "damage", "target": "Thorin", "amount": 8, "damageType": "slashing" }
{ "type": "healing", "target": "Elara", "amount": 10 }
{ "type": "set_hp", "target": "Thorin", "value": 25 }
{ "type": "set_temp_hp", "target": "Elara", "value": 5 }
\`\`\`

**Conditions:**
\`\`\`
{ "type": "condition_add", "target": "Thorin", "condition": "poisoned" }
{ "type": "condition_remove", "target": "Thorin", "condition": "poisoned" }
\`\`\`

**Spell Slots:**
\`\`\`
{ "type": "spell_slot_use", "target": "Elara", "level": 2 }
{ "type": "spell_slot_restore", "target": "Elara", "level": 2 }
\`\`\`

**Combat:**
\`\`\`
{ "type": "combat_start", "enemies": [
    { "name": "Goblin", "maxHP": 7, "armorClass": 15, "initiativeModifier": 2, "speed": 30 },
    { "name": "Goblin Boss", "maxHP": 21, "armorClass": 17, "initiativeModifier": 1, "speed": 30, "size": "small" }
  ],
  "description": "Goblins ambush the party!"
}
{ "type": "combat_end" }
{ "type": "turn_end" }
\`\`\`

**Other:**
\`\`\`
{ "type": "xp_award", "targets": ["Thorin", "Elara"], "amount": 100 }
{ "type": "death_save", "target": "Thorin" }
{ "type": "short_rest" }
{ "type": "long_rest" }
\`\`\`

**Story Journal (emit after significant story beats — new quests, NPCs, locations, quest completions):**
\`\`\`
{ "type": "journal_update", "storySummary": "The party cleared the goblin caves and rescued the merchant.", "activeQuest": "Return to Oakfield with the rescued merchant", "addNPC": { "name": "Eldon", "role": "merchant", "disposition": "grateful", "lastSeen": "Goblin Caves" }, "addLocation": "Goblin Caves" }
\`\`\`

### Rules for Actions:
1. ALWAYS request checks before narrating uncertain outcomes. Do NOT decide success/failure — the server rolls dice.
2. After requesting a check, STOP and wait. The system will tell you the result, then you narrate the outcome.
3. You can include MULTIPLE actions in one block: \`{ "actions": [action1, action2, ...] }\`
4. Place the JSON block at the END of your narrative, after the story text.
5. Use exact character names as they appear in the party roster.
6. For attack rolls, use \`"type": "attack"\` in the check.
7. During combat, end enemy/NPC turns with \`turn_end\` after their actions.
8. Do NOT include damage in the same response as an attack check_request — wait for the roll result first.
9. When a leveled spell is cast, ALWAYS include \`spell_slot_use\` in the same action block.
10. ALL damage MUST include a \`damage\` action. ALL healing MUST include a \`healing\` action. Narrating damage/healing without the action does NOTHING to the character's HP.
11. This includes self-healing abilities like Lay on Hands, Second Wind, potions, etc. — you MUST emit a \`healing\` action with the calculated amount. Look at the character's current HP and max HP to determine how much to heal.
12. If a player says they want to heal "to full" or "as much as needed", calculate the difference (maxHP - currentHP) and emit that amount. NEVER just narrate healing without the action.`;

const FEW_SHOT_EXAMPLES = `

## EXAMPLES OF CORRECT ACTION OUTPUT

**Player attacks in combat:**
> [Player1]: I swing my battleaxe at the goblin!

*Thorin raises his battleaxe high and brings it crashing down toward the snarling goblin!*

\`\`\`json:actions
{ "actions": [{ "type": "check_request", "check": { "type": "attack", "ability": "strength", "dc": 15, "targetCharacter": "Thorin", "reason": "Battleaxe melee attack vs Goblin (AC 15)" } }] }
\`\`\`

**After a successful attack (system said "Thorin rolled 18 — Success"):**

*The battleaxe cleaves into the goblin with a sickening crunch, splitting its crude shield in two!*

\`\`\`json:actions
{ "actions": [{ "type": "damage", "target": "Goblin", "amount": 9, "damageType": "slashing" }, { "type": "turn_end" }] }
\`\`\`

**Casting a leveled spell:**

*Elara raises her staff, channeling arcane energy. A bolt of fire streaks toward the goblin boss!*

\`\`\`json:actions
{ "actions": [{ "type": "spell_slot_use", "target": "Elara", "level": 1 }, { "type": "check_request", "check": { "type": "attack", "ability": "intelligence", "dc": 17, "targetCharacter": "Elara", "reason": "Chromatic Orb ranged spell attack vs Goblin Boss (AC 17)" } }] }
\`\`\`

**Player uses a healing ability (Thorin has 122/159 HP):**
> [Thorin]: I use Lay on Hands to heal myself to full.

*Thorin places his hands over his wounds, channeling divine energy. Golden light flows through his fingers as his wounds knit shut, restoring him to full fighting strength.*

\`\`\`json:actions
{ "actions": [{ "type": "healing", "target": "Thorin", "amount": 37 }] }
\`\`\`

**WRONG — never do this:**
*The goblin slashes Thorin for 6 damage!*
(MISSING the damage action — Thorin's HP will NOT change! Always include the JSON action block.)

**ALSO WRONG — never do this:**
*Thorin channels divine energy, healing his wounds completely.*
(MISSING the healing action — Thorin's HP will NOT change! You MUST include \`{ "type": "healing", ... }\` for ANY healing to take effect.)`;

const COMBAT_RULES = `

## COMBAT RULES (STRICT — follow exactly during combat)

TURN STRUCTURE:
- Each combatant gets ONE turn per round: Movement + Action + Bonus Action + free object interaction
- You MUST emit \`turn_end\` after resolving each NPC/enemy turn
- NEVER skip a combatant's turn — process them in initiative order
- Only resolve the ACTIVE combatant's turn (marked with << ACTIVE TURN)

ATTACKS:
- Melee/ranged attacks ALWAYS require \`check_request\` with type "attack" — NEVER narrate hit/miss without a roll
- Set the DC equal to the target's AC
- After a SUCCESSFUL attack roll result, emit \`damage\` in your NEXT response with the appropriate damage amount and type
- After a FAILED attack roll result, narrate the miss — no damage action
- NEVER emit damage and attack check_request in the same response — always wait for the roll result

SPELLS:
- When ANY leveled spell is cast (level 1+), ALWAYS emit \`spell_slot_use\` with the spell's level
- Check the character's spell slot availability — if they have NO slots of that level, the spell CANNOT be cast
- Cantrips (level 0) do NOT consume spell slots
- Spell attacks use \`check_request\` with type "attack"; spell saves use \`check_request\` with type "saving_throw"

HP TRACKING:
- ALL damage MUST be emitted as a \`damage\` action — narrating damage without the action changes NOTHING
- ALL healing MUST be emitted as a \`healing\` action
- Track NPC/enemy HP: when their HP reaches 0, narrate their defeat
- Apply conditions (poisoned, prone, stunned, restrained, etc.) via \`condition_add\`; remove when they expire

DEATH & UNCONSCIOUSNESS:
- At 0 HP, a creature is unconscious (not dead, unless massive damage)
- Player characters at 0 HP must make death saving throws — emit \`death_save\` on their turn
- 3 successes = stabilized, 3 failures = death`;

const PACING_INSTRUCTIONS: Record<PacingProfile, string> = {
  "story-heavy": `

PACING (Story-Heavy):
- Prioritize roleplay, exploration, and narrative depth
- Use checks sparingly — only when failure would be interesting
- Encourage player creativity and reward clever solutions without dice
- Combat should be rare and meaningful, not routine encounters
- Spend more time on NPC interactions, world-building, and character moments`,

  balanced: `

PACING (Balanced):
- Mix roleplay, exploration, and combat evenly
- Request checks when outcomes are genuinely uncertain
- Introduce combat when it fits the narrative naturally
- Balance NPC interactions with action sequences
- Let players drive the pacing — follow their energy`,

  "combat-heavy": `

PACING (Combat-Heavy):
- Lean into action and tactical encounters
- Introduce combat opportunities frequently
- Use checks to build tension before fights
- Keep roleplay scenes shorter and more focused
- Make environments interesting tactically (cover, elevation, hazards)`,
};

const TOOL_USE_INSTRUCTIONS = `

## D&D RULES REFERENCE TOOLS

You have tools to look up official D&D 5e rules from the SRD. You are a RULES-DRIVEN DM.
ALWAYS verify rules BEFORE narrating outcomes or emitting game actions.

**MANDATORY tool use — do these EVERY TIME:**
- ANY spell is cast → lookup_spell FIRST to get exact damage dice, save type, range, duration, conditions applied
- ANY combat starts → lookup_monster for EVERY enemy type to get accurate HP, AC, speed, abilities, actions
- ANY condition is applied or referenced → lookup_condition to verify exact mechanical effects
- ANY attack/ability/spell involves a rule you could verify → lookup_rule to ensure correct mechanics
- ANY damage, healing, or status effect → verify the source spell/ability mechanics BEFORE emitting the action

**Process for EVERY mechanical event:**
1. Look up the relevant spell/monster/condition/rule
2. Calculate all side effects (damage amounts, conditions applied, area of effect targets, duration, concentration)
3. THEN emit the correct game actions (damage, healing, condition_add, spell_slot_use, etc.)
4. THEN narrate the outcome

**When NOT to use tools:**
- For data already provided in [DM Prep] blocks or character sheets
- For homebrew/non-SRD content (use training knowledge)
- If you already looked up the same spell/monster earlier in THIS response's tool calls`;

const ENCOUNTER_LENGTH_NOTES: Record<EncounterLength, string> = {
  quick: "\n- Keep encounters SHORT: 2-3 rounds of combat, quick resolutions.",
  standard: "\n- Standard encounter length: 3-5 rounds of combat.",
  epic: "\n- EPIC encounters: multi-phase battles, legendary actions, environmental hazards, 5+ rounds.",
};

function buildJournalContext(journal: CampaignJournal): string {
  const lines: string[] = ["\n## CAMPAIGN JOURNAL"];

  lines.push(`**Story so far:** ${journal.storySummary}`);

  if (journal.activeQuest) {
    lines.push(`**Current quest:** ${journal.activeQuest}`);
  }

  if (journal.completedQuests.length > 0) {
    lines.push(`**Completed:** ${journal.completedQuests.join(", ")}`);
  }

  if (journal.npcs.length > 0) {
    const npcStrs = journal.npcs.map((n) => {
      const loc = n.lastSeen ? `, ${n.lastSeen}` : "";
      return `${n.name} (${n.role}, ${n.disposition}${loc})`;
    });
    lines.push(`**Key NPCs:** ${npcStrs.join("; ")}`);
  }

  if (journal.locations.length > 0) {
    lines.push(`**Visited locations:** ${journal.locations.join(", ")}`);
  }

  if (journal.notableItems.length > 0) {
    lines.push(`**Notable loot:** ${journal.notableItems.join(", ")}`);
  }

  return lines.join("\n");
}

function buildCombatContext(combat: CombatState): string {
  const lines: string[] = ["\n## CURRENT COMBAT STATE"];

  lines.push(`**Round:** ${combat.round} | **Phase:** ${combat.phase}`);

  const turnLines = combat.turnOrder.map((id, idx) => {
    const c = combat.combatants[id];
    if (!c) return `  ${idx + 1}. (unknown)`;

    const active = idx === combat.turnIndex ? " << ACTIVE TURN" : "";
    const hp =
      c.type === "player"
        ? ""
        : ` [HP: ${c.currentHP ?? "?"}/${c.maxHP ?? "?"}]`;
    const conditions =
      c.conditions && c.conditions.length > 0
        ? ` (${c.conditions.join(", ")})`
        : "";
    return `  ${idx + 1}. **${c.name}** (${c.type})${hp}${conditions}${active}`;
  });

  lines.push("**Turn Order:**");
  lines.push(...turnLines);

  if (combat.pendingCheck) {
    lines.push(
      `\n**Pending Check:** ${combat.pendingCheck.reason} (waiting for ${combat.pendingCheck.targetCharacter})`
    );
  }

  return lines.join("\n");
}

export interface BuildDMPromptOptions {
  characters: Record<string, CharacterData>;
  customPrompt?: string;
  pacingProfile?: PacingProfile;
  encounterLength?: EncounterLength;
  combatState?: CombatState;
  journal?: CampaignJournal;
  /** Pre-built DM prep summary (party capabilities, pre-fetched spells) */
  dmPrepSummary?: string;
  /** Whether the current provider supports native tool-use */
  hasToolAccess?: boolean;
}

/**
 * Build a dynamic DM system prompt that includes character data,
 * structured output instructions, pacing profile, combat rules, and combat context.
 */
export function buildDMSystemPrompt(options: BuildDMPromptOptions): string {
  const {
    characters,
    customPrompt,
    pacingProfile = "balanced",
    encounterLength = "standard",
    combatState,
    journal,
    dmPrepSummary,
    hasToolAccess,
  } = options;

  const entries = Object.entries(characters);

  // 1. Base prompt (or custom override)
  let prompt = customPrompt || DEFAULT_DM_PROMPT;

  // 2. Character rules + character blocks
  if (entries.length > 0) {
    prompt += CHARACTER_RULES;

    const characterBlocks = entries
      .map(([playerName, char]) => buildCharacterContextBlock(playerName, char))
      .join("\n\n");

    prompt += `\n\n## THE ADVENTURING PARTY\n\n${characterBlocks}`;
  }

  // 3. DM Prep summary (party capabilities, pre-fetched spells)
  if (dmPrepSummary) {
    prompt += `\n\n${dmPrepSummary}`;
  }

  // 4. Campaign journal (if exists)
  if (journal) {
    prompt += buildJournalContext(journal);
  }

  // 5. Structured output instructions (always included)
  prompt += STRUCTURED_OUTPUT_INSTRUCTIONS;

  // 6. Few-shot examples (always included)
  prompt += FEW_SHOT_EXAMPLES;

  // 7. Tool-use instructions (only for tool-capable providers)
  if (hasToolAccess) {
    prompt += TOOL_USE_INSTRUCTIONS;
  }

  // 8. Pacing
  prompt += PACING_INSTRUCTIONS[pacingProfile];
  prompt += ENCOUNTER_LENGTH_NOTES[encounterLength];

  // 9. Combat rules (only during active combat)
  if (combatState && combatState.phase === "active") {
    prompt += COMBAT_RULES;
  }

  // 10. Combat state context (only during active combat)
  if (combatState && combatState.phase === "active") {
    prompt += buildCombatContext(combatState);
  }

  return prompt;
}
