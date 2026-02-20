// === Tool-Use Loop ===
// Orchestrates the multi-turn tool-use conversation for tool-capable providers.
// Calls callAIRaw() in a loop, executing tool calls until the AI produces a text response.
// Tool-use intermediary messages are ephemeral — only the final text is returned.

import type { AIConfig } from "@aidnd/shared/types";
import { getProvider } from "@aidnd/shared";
import {
  callAIRaw,
  toNativeMessages,
  buildAnthropicToolResults,
  buildOpenAIToolResults,
  type ConversationMessage,
  type RawMessage,
} from "./ai-service";
import {
  DND_TOOLS,
  toAnthropicTools,
  toOpenAITools,
  executeToolCall,
} from "./dnd-tools";

const MAX_TOOL_ROUNDS = 3;

export interface CallAIWithToolsParams {
  aiConfig: AIConfig;
  systemPrompt: string;
  messages: ConversationMessage[];
  maxTokens?: number;
  kvCache: KVNamespace;
}

export interface CallAIWithToolsResult {
  text: string;
}

/**
 * Call an AI provider with D&D 5e tool-use support.
 * Handles the tool-use loop internally:
 *   1. Send messages + tool definitions
 *   2. If AI wants to use tools, execute them and send results back
 *   3. Repeat up to MAX_TOOL_ROUNDS times
 *   4. Return the final text response
 *
 * Tool-use messages are ephemeral and NOT returned to the caller.
 * The caller should only store the returned `text` in conversation history.
 */
export async function callAIWithTools(
  params: CallAIWithToolsParams,
): Promise<CallAIWithToolsResult> {
  const provider = getProvider(params.aiConfig.provider);
  if (!provider) {
    throw new Error(`Unknown AI provider: ${params.aiConfig.provider}`);
  }

  const format = provider.format;

  // Convert tools to provider-specific format
  const tools =
    format === "anthropic"
      ? toAnthropicTools(DND_TOOLS)
      : toOpenAITools(DND_TOOLS);

  // Build temporary message array (starts from conversation history)
  // This array gets tool-use messages appended but is never persisted
  const tempMessages: RawMessage[] = toNativeMessages(params.messages, format);

  let textAccumulator = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await callAIRaw({
      aiConfig: params.aiConfig,
      systemPrompt: params.systemPrompt,
      messages: tempMessages,
      maxTokens: params.maxTokens,
      tools,
    });

    // Accumulate any text the AI produced alongside tool calls
    if (result.text) {
      textAccumulator += result.text;
    }

    // If no tool calls, we're done
    if (result.stopReason === "text" || result.toolCalls.length === 0) {
      return { text: textAccumulator || result.text || "" };
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      result.toolCalls.map(async (tc) => {
        const execResult = await executeToolCall(
          tc.name,
          tc.arguments,
          params.kvCache,
        );
        return {
          id: tc.id,
          name: tc.name,
          content: execResult.content,
          isError: execResult.isError,
        };
      }),
    );

    // Log tool calls for debugging
    for (const tr of toolResults) {
      console.log(
        `[tool-loop] ${tr.name}: ${tr.isError ? "ERROR" : "OK"} (${tr.content.length} chars)`,
      );
    }

    // Append the assistant's tool-use message to the temp conversation
    tempMessages.push(result.rawAssistantMessage);

    // Append tool results in the provider's format
    if (format === "anthropic") {
      const toolResultMsg = buildAnthropicToolResults(
        toolResults.map((r) => ({
          toolUseId: r.id,
          content: r.content,
          isError: r.isError,
        })),
      );
      tempMessages.push(toolResultMsg);
    } else {
      // OpenAI format: each tool result is a separate message
      const toolResultMsgs = buildOpenAIToolResults(
        toolResults.map((r) => ({
          toolCallId: r.id,
          content: r.content,
        })),
      );
      tempMessages.push(...toolResultMsgs);
    }
  }

  // If we exhausted all rounds without a text response,
  // make one final call WITHOUT tools to force a text completion
  console.warn(
    `[tool-loop] Exhausted ${MAX_TOOL_ROUNDS} tool rounds, forcing text completion`,
  );

  const finalResult = await callAIRaw({
    aiConfig: params.aiConfig,
    systemPrompt: params.systemPrompt,
    messages: tempMessages,
    maxTokens: params.maxTokens,
    // No tools — force text response
  });

  return {
    text: textAccumulator + (finalResult.text || ""),
  };
}

/**
 * Check if a provider supports native tool-use.
 * Currently: Anthropic (always) and OpenAI (only the actual OpenAI API, not third-party compatible providers).
 */
export function providerSupportsTools(providerId: string): boolean {
  const provider = getProvider(providerId);
  if (!provider) return false;

  if (provider.format === "anthropic") return true;
  if (provider.format === "openai" && provider.id === "openai") return true;

  return false;
}
