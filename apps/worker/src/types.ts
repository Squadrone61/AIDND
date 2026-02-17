import type { GameRoom } from "./durable-objects/game-room";

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ENVIRONMENT: string;

  // Auth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

export type { GameRoom };
