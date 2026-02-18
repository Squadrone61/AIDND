/**
 * AI Response Parser
 *
 * Extracts structured game actions from AI responses.
 * The AI embeds actions in fenced JSON blocks (```json:actions ... ```)
 * within its narrative text. This parser extracts and validates them.
 */

import { aiActionBlockSchema } from "@aidnd/shared/schemas";
import type { AIAction } from "@aidnd/shared/types";

export interface ParsedAIResponse {
  /** Narrative text with JSON blocks stripped */
  narrative: string;
  /** Validated actions extracted from JSON blocks */
  actions: AIAction[];
  /** Any parse/validation errors encountered (non-fatal) */
  parseErrors: string[];
}

/**
 * Extract fenced JSON blocks from AI response text and validate them.
 *
 * Supports two formats:
 *   ```json:actions\n{...}\n```
 *   ```json\n{...}\n```
 *
 * If no JSON block is found or parsing fails, falls back to narrative-only.
 */
export function parseAIResponse(raw: string): ParsedAIResponse {
  const actions: AIAction[] = [];
  const parseErrors: string[] = [];

  // Match fenced code blocks: ```json:actions or ```json
  const blockRegex = /```(?:json:actions|json)\s*\n([\s\S]*?)```/g;

  let narrative = raw;
  let match: RegExpExecArray | null;

  // Process all JSON blocks
  while ((match = blockRegex.exec(raw)) !== null) {
    const jsonStr = match[1].trim();

    // Remove the entire fenced block from narrative
    narrative = narrative.replace(match[0], "").trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const result = aiActionBlockSchema.safeParse(parsed);

      if (result.success) {
        actions.push(...result.data.actions);
      } else {
        // Zod validation failed — collect errors but continue
        const issues = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        parseErrors.push(`Action validation failed: ${issues}`);
      }
    } catch (err) {
      parseErrors.push(
        `JSON parse error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Clean up extra whitespace from block removal
  narrative = narrative.replace(/\n{3,}/g, "\n\n").trim();

  return { narrative, actions, parseErrors };
}
