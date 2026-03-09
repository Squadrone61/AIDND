import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { MessageQueue } from "./message-queue.js";
import type { WSClient } from "./ws-client.js";
import type { CampaignManager } from "./services/campaign-manager.js";
import { SrdLookup } from "./services/srd-lookup.js";
import { registerGameTools } from "./tools/game-tools.js";
import { registerDndTools } from "./tools/dnd-tools.js";
import { registerSrdTools } from "./tools/srd-tools.js";
import { registerCampaignTools } from "./tools/campaign-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createMcpServer(
  messageQueue: MessageQueue,
  wsClient: WSClient,
  campaignManager: CampaignManager
): McpServer {
  const server = new McpServer({
    name: "aidnd-dm",
    version: "1.0.0",
  });

  // SRD 5.2 data lives at repo_root/data/srd-5.2/
  const srdDataDir = resolve(__dirname, "../../../data/srd-5.2");
  const srdLookup = new SrdLookup(srdDataDir);

  registerGameTools(server, messageQueue, wsClient);
  registerDndTools(server, wsClient);
  registerSrdTools(server, srdLookup, wsClient);
  registerCampaignTools(server, campaignManager, wsClient);

  return server;
}
