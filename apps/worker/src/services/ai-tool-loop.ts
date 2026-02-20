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

  const tools =
    format === "anthropic"
      ? toAnthropicTools(DND_TOOLS)
      : toOpenAITools(DND_TOOLS);

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

    if (result.text) {
      textAccumulator += result.text;
    }

    if (result.stopReason === "text" || result.toolCalls.length === 0) {
      return { text: textAccumulator || result.text || "" };
    }

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

    for (const tr of toolResults) {
      console.log(
        `[tool-loop] ${tr.name}: ${tr.isError ? "ERROR" : "OK"} (${tr.content.length} chars)`,
      );
    }

    tempMessages.push(result.rawAssistantMessage);

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
      const toolResultMsgs = buildOpenAIToolResults(
        toolResults.map((r) => ({
          toolCallId: r.id,
          content: r.content,
        })),
      );
      tempMessages.push(...toolResultMsgs);
    }
  }

  // Exhausted tool rounds — force a text completion without tools
  console.warn(
    `[tool-loop] Exhausted ${MAX_TOOL_ROUNDS} tool rounds, forcing text completion`,
  );

  const finalResult = await callAIRaw({
    aiConfig: params.aiConfig,
    systemPrompt: params.systemPrompt,
    messages: tempMessages,
    maxTokens: params.maxTokens,
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
