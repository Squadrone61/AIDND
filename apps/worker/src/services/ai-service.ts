import type { AIConfig } from "@aidnd/shared/types";
import { getProvider, DEFAULT_MAX_TOKENS } from "@aidnd/shared";
import type { AIProvider, AIProviderFormat } from "@aidnd/shared";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface CallAIParams {
  aiConfig: AIConfig;
  systemPrompt: string;
  messages: ConversationMessage[];
  maxTokens?: number;
}

interface CallAIResult {
  text: string;
}

export async function callAI(params: CallAIParams): Promise<CallAIResult> {
  const provider = getProvider(params.aiConfig.provider);
  if (!provider) {
    throw new Error(`Unknown AI provider: ${params.aiConfig.provider}`);
  }

  const model = params.aiConfig.model || provider.defaultModel;
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;

  switch (provider.format) {
    case "openai":
      return callOpenAICompatible(provider, params.aiConfig.apiKey, model, params.systemPrompt, params.messages, maxTokens);
    case "anthropic":
      return callAnthropic(provider, params.aiConfig.apiKey, model, params.systemPrompt, params.messages, maxTokens);
    case "gemini":
      return callGemini(provider, params.aiConfig.apiKey, model, params.systemPrompt, params.messages, maxTokens);
    default:
      throw new Error(`Unsupported provider format: ${provider.format}`);
  }
}

async function callOpenAICompatible(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ConversationMessage[],
  maxTokens: number,
): Promise<CallAIResult> {
  const url = `${provider.baseUrl}/chat/completions`;

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, provider.name);
    throw new Error(errorText);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  return { text };
}

async function callAnthropic(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ConversationMessage[],
  maxTokens: number,
): Promise<CallAIResult> {
  const url = `${provider.baseUrl}/v1/messages`;

  const body = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, provider.name);
    throw new Error(errorText);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text =
    data.content?.find((block) => block.type === "text")?.text ?? "";
  return { text };
}

async function callGemini(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ConversationMessage[],
  maxTokens: number,
): Promise<CallAIResult> {
  const url = `${provider.baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, provider.name);
    throw new Error(errorText);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text };
}

async function parseErrorResponse(
  response: Response,
  providerName: string,
): Promise<string> {
  try {
    const body = await response.text();
    let errorMessage: string | undefined;

    try {
      const json = JSON.parse(body);
      // All providers use { error: { message: "..." } }
      errorMessage =
        json?.error?.message ??
        json?.message ??
        json?.error?.status ??
        undefined;
    } catch {
      // Not JSON, use raw body
      errorMessage = body.slice(0, 200);
    }

    return `${providerName} API error (${response.status}): ${errorMessage || response.statusText}`;
  } catch {
    return `${providerName} API error (${response.status}): ${response.statusText}`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawMessage = Record<string, any>;

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CallAIRawParams {
  aiConfig: AIConfig;
  systemPrompt: string;
  messages: RawMessage[];
  maxTokens?: number;
  tools?: unknown;
}

export interface CallAIRawResult {
  text: string | null;
  toolCalls: ToolCallInfo[];
  stopReason: "text" | "tool_use";
  rawAssistantMessage: RawMessage;
}

/**
 * Low-level AI call that supports native tool-use.
 * Returns the raw response including any tool calls.
 * Only supports Anthropic and OpenAI formats (tool-capable providers).
 */
export async function callAIRaw(
  params: CallAIRawParams,
): Promise<CallAIRawResult> {
  const provider = getProvider(params.aiConfig.provider);
  if (!provider) {
    throw new Error(`Unknown AI provider: ${params.aiConfig.provider}`);
  }

  const model = params.aiConfig.model || provider.defaultModel;
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;

  switch (provider.format) {
    case "anthropic":
      return callAnthropicRaw(provider, params.aiConfig.apiKey, model, params.systemPrompt, params.messages, maxTokens, params.tools);
    case "openai":
      return callOpenAIRaw(provider, params.aiConfig.apiKey, model, params.systemPrompt, params.messages, maxTokens, params.tools);
    default:
      throw new Error(`callAIRaw does not support format: ${provider.format}. Use callAI() instead.`);
  }
}

async function callAnthropicRaw(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: RawMessage[],
  maxTokens: number,
  tools: unknown,
): Promise<CallAIRawResult> {
  const url = `${provider.baseUrl}/v1/messages`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  };
  if (tools) {
    body.tools = tools;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, provider.name);
    throw new Error(errorText);
  }

  const data = (await response.json()) as {
    content: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    stop_reason: string;
  };

  const textBlocks = data.content.filter((b) => b.type === "text");
  const text = textBlocks.map((b) => b.text || "").join("") || null;

  const toolUseBlocks = data.content.filter((b) => b.type === "tool_use");
  const toolCalls: ToolCallInfo[] = toolUseBlocks.map((b) => ({
    id: b.id!,
    name: b.name!,
    arguments: b.input || {},
  }));

  const stopReason = data.stop_reason === "tool_use" ? "tool_use" : "text";

  const rawAssistantMessage: RawMessage = {
    role: "assistant",
    content: data.content,
  };

  return { text, toolCalls, stopReason, rawAssistantMessage };
}

async function callOpenAIRaw(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: RawMessage[],
  maxTokens: number,
  tools: unknown,
): Promise<CallAIRawResult> {
  const url = `${provider.baseUrl}/chat/completions`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  };
  if (tools) {
    body.tools = tools;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, provider.name);
    throw new Error(errorText);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason: string;
    }>;
  };

  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error(`${provider.name}: empty response`);
  }

  const text = choice.message.content || null;

  const toolCalls: ToolCallInfo[] = (choice.message.tool_calls || []).map(
    (tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseJSON(tc.function.arguments),
    }),
  );

  const stopReason =
    choice.finish_reason === "tool_calls" ? "tool_use" : "text";

  const rawAssistantMessage: RawMessage = {
    role: "assistant",
    content: choice.message.content,
    ...(choice.message.tool_calls
      ? { tool_calls: choice.message.tool_calls }
      : {}),
  };

  return { text, toolCalls, stopReason, rawAssistantMessage };
}

function safeParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

export function buildAnthropicToolResults(
  results: Array<{ toolUseId: string; content: string; isError: boolean }>,
): RawMessage {
  return {
    role: "user",
    content: results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.toolUseId,
      content: r.content,
      is_error: r.isError,
    })),
  };
}

export function buildOpenAIToolResults(
  results: Array<{ toolCallId: string; content: string }>,
): RawMessage[] {
  return results.map((r) => ({
    role: "tool",
    tool_call_id: r.toolCallId,
    content: r.content,
  }));
}

/**
 * Convert simple ConversationMessage[] to the native message format
 * for a given provider format.
 */
export function toNativeMessages(
  messages: ConversationMessage[],
  format: AIProviderFormat,
): RawMessage[] {
  switch (format) {
    case "anthropic":
      return messages.map((m) => ({ role: m.role, content: m.content }));
    case "openai":
      return messages.map((m) => ({ role: m.role, content: m.content }));
    default:
      return messages.map((m) => ({ role: m.role, content: m.content }));
  }
}
