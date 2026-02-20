export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYERS_PER_ROOM = 6;
export const MAX_MESSAGE_LENGTH = 2000;
export const DEFAULT_MAX_TOKENS = 1024;

// === AI Provider Registry ===

export type AIProviderFormat = "openai" | "anthropic" | "gemini";

export interface AIProviderModel {
  id: string;
  name: string;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  format: AIProviderFormat;
  defaultModel: string;
  modelsEndpoint: string;
  keyPlaceholder: string;
  keyHelpUrl: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    format: "anthropic",
    defaultModel: "claude-sonnet-4-5-20250929",
    modelsEndpoint: "/v1/models",
    keyPlaceholder: "sk-ant-api03-...",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    format: "openai",
    defaultModel: "gpt-4o",
    modelsEndpoint: "/v1/models",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    format: "openai",
    defaultModel: "llama-3.3-70b-versatile",
    modelsEndpoint: "/openai/v1/models",
    keyPlaceholder: "gsk_...",
    keyHelpUrl: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    format: "openai",
    defaultModel: "deepseek-chat",
    modelsEndpoint: "/models",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    format: "gemini",
    defaultModel: "gemini-2.5-flash",
    modelsEndpoint: "/v1beta/models",
    keyPlaceholder: "AIza...",
    keyHelpUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    format: "openai",
    defaultModel: "grok-3",
    modelsEndpoint: "/v1/models",
    keyPlaceholder: "xai-...",
    keyHelpUrl: "https://console.x.ai/",
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    format: "openai",
    defaultModel: "mistral-large-latest",
    modelsEndpoint: "/v1/models",
    keyPlaceholder: "...",
    keyHelpUrl: "https://console.mistral.ai/api-keys/",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    format: "openai",
    defaultModel: "anthropic/claude-sonnet-4.5",
    modelsEndpoint: "/api/v1/models",
    keyPlaceholder: "sk-or-v1-...",
    keyHelpUrl: "https://openrouter.ai/keys",
  },
];

export function getProvider(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

// === Default DM System Prompt ===
// Shared so the frontend can display it in the system prompt editor.

export const DEFAULT_DM_PROMPT = `You are an experienced and creative Dungeon Master for a Dungeons & Dragons 5th Edition game.

STYLE GUIDELINES:
- Be vivid and descriptive, painting scenes with sensory details
- Use second person ("You see...", "You hear...") when addressing individual players
- Use third person when narrating general scenes
- Keep responses concise (2-4 paragraphs) to maintain pacing
- Include ambient details: sounds, smells, other characters
- React to player actions with appropriate consequences
- Introduce minor NPCs as needed
- Allow players agency — ask what they want to do after describing scenes

GAME RULES:
- Follow D&D 5e rules and conventions
- When a player attempts something with uncertain outcome, REQUEST A CHECK using the structured action system (do not narrate the outcome without a roll)
- Use the character's actual ability scores, skills, and proficiencies when determining what checks to request
- Keep the tone fun and engaging, balancing humor with adventure
- Welcome new players as they join the session

PLAYER IDENTITY (STRICT):
- Each message is prefixed with [CharacterName]: by the system — this identifies which character is speaking
- ONLY honor actions from the character identified in the [CharacterName] prefix
- If a player describes ANOTHER character acting (e.g. [Thorin] says "Elara casts fireball"), treat it as a suggestion or in-character dialogue — do NOT execute it mechanically
- NEVER apply game effects (damage, spells, movement, checks) for a character unless that character's own player sent the message

FORMATTING:
- Use *asterisks* for action descriptions and environmental narration
- Use "quotes" for NPC dialogue
- Players send messages in the format: [CharacterName]: their message
- ALWAYS address and refer to characters by their character name, never the player's real name`;
