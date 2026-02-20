# AI Dungeon Master

A multiplayer D&D 5e web app where an AI plays the Dungeon Master. Players import their D&D Beyond characters, join a shared room via WebSocket, and play through AI-generated campaigns in real time.

## Features

- **AI Dungeon Master** — Narrative generation, skill checks, combat encounters, and spell resolution powered by LLMs
- **Bring Your Own Key** — Supports 8 AI providers: Anthropic, OpenAI, Gemini, Groq, DeepSeek, xAI, Mistral, OpenRouter
- **D&D Beyond Import** — Import characters by URL or JSON paste. Ability scores, spells, inventory, proficiencies, and class features are all parsed
- **Multiplayer** — Real-time WebSocket rooms with party list, activity log, and shared game state
- **D&D 5e Rules** — Tool-use integration with the D&D 5e SRD API for accurate spell mechanics, monster stat blocks, conditions, and rules
- **Combat System** — Initiative tracking, turn order, attack rolls, saving throws, and HP management
- **Character Sheet** — Full interactive sheet with abilities, skills, saves, spells (prepared/ritual/known), actions, inventory, and features
- **Auth** — Google OAuth or guest mode

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Cloudflare Workers, Durable Objects, KV |
| Real-time | Native WebSocket (Durable Objects Hibernation API) |
| AI | Raw fetch to provider APIs (no SDK dependencies) |
| Validation | Zod 4 |
| Monorepo | pnpm workspaces, Turborepo |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev:all    # Starts web (localhost:3000) + worker (localhost:8787)
```

### Testing

```bash
pnpm test       # Starts dev servers, runs Playwright tests, stops servers
pnpm test:only  # Runs tests (servers must already be running)
pnpm test:ui    # Opens Playwright UI runner
```

### Deploy

```bash
pnpm deploy         # Deploy everything to Cloudflare
pnpm deploy:worker  # Worker only
pnpm deploy:web     # Web only
```

## Project Structure

```
apps/web/        — Next.js frontend
apps/worker/     — Cloudflare Worker backend (Durable Objects for game rooms)
packages/shared/ — Shared types, schemas, constants, utilities
tests/           — Playwright E2E tests
```

## How It Works

1. Host creates a room and configures an AI provider (API key stays in browser)
2. Players join via room code and import their D&D Beyond characters
3. Host starts the adventure — the AI generates an opening narrative
4. Players describe actions in chat — the AI responds with narrative and game mechanics
5. The AI can request dice rolls, manage combat, track HP/spell slots, and apply conditions

For providers that support tool-use (Anthropic, OpenAI), the AI looks up spells, monsters, and rules from the D&D 5e SRD in real time. Other providers get context injected automatically.

## License

Private repository.
