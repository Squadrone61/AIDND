/**
 * Server-side dice rolling service.
 *
 * All randomness uses crypto.getRandomValues() for true randomness.
 * Dice are NEVER rolled by the AI — only by the server.
 */

import type { DieSize, DieRoll, RollResult } from "@aidnd/shared/types";

/** Roll a single die. */
export function rollDie(sides: DieSize): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % sides) + 1;
}

/** Roll multiple dice of the same size. */
export function rollDice(count: number, sides: DieSize): DieRoll[] {
  return Array.from({ length: count }, () => ({
    die: sides,
    result: rollDie(sides),
  }));
}

/** Roll a d20 check with modifier and optional advantage/disadvantage. */
export function rollCheck(params: {
  modifier: number;
  advantage?: boolean;
  disadvantage?: boolean;
  label: string;
}): RollResult {
  const { modifier, advantage, disadvantage, label } = params;

  // Advantage and disadvantage cancel each other out
  const hasAdvantage = advantage && !disadvantage;
  const hasDisadvantage = disadvantage && !advantage;

  let rolls: DieRoll[];
  let chosenRoll: number;

  if (hasAdvantage || hasDisadvantage) {
    // Roll 2d20
    rolls = rollDice(2, 20);
    chosenRoll = hasAdvantage
      ? Math.max(rolls[0].result, rolls[1].result)
      : Math.min(rolls[0].result, rolls[1].result);
  } else {
    // Roll 1d20
    rolls = rollDice(1, 20);
    chosenRoll = rolls[0].result;
  }

  const total = chosenRoll + modifier;

  return {
    id: crypto.randomUUID(),
    rolls,
    modifier,
    total,
    advantage: hasAdvantage || undefined,
    disadvantage: hasDisadvantage || undefined,
    criticalHit: chosenRoll === 20 || undefined,
    criticalFail: chosenRoll === 1 || undefined,
    label,
  };
}

/** Roll initiative (1d20 + modifier). */
export function rollInitiative(modifier: number): number {
  return rollDie(20) + modifier;
}

/**
 * Parse a dice string like "2d6", "1d8+3", "4d6-1" and roll it.
 * Returns a RollResult with individual dice and total.
 */
export function rollDamage(diceStr: string, extraModifier = 0): RollResult {
  // Parse "NdS" or "NdS+M" or "NdS-M"
  const match = diceStr.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i);
  if (!match) {
    // Fallback: treat as flat damage
    return {
      id: crypto.randomUUID(),
      rolls: [],
      modifier: extraModifier,
      total: extraModifier,
      label: diceStr,
    };
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10) as DieSize;
  const sign = match[3] === "-" ? -1 : 1;
  const diceModifier = match[4] ? parseInt(match[4], 10) * sign : 0;

  const totalModifier = diceModifier + extraModifier;
  const rolls = rollDice(count, sides);
  const rollTotal = rolls.reduce((sum, r) => sum + r.result, 0);

  return {
    id: crypto.randomUUID(),
    rolls,
    modifier: totalModifier,
    total: rollTotal + totalModifier,
    label: diceStr,
  };
}
