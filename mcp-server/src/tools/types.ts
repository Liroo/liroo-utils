import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WCLClient } from "../../lib/wlogs/client/wcl-client.js";

export interface ToolContext {
  wcl: WCLClient;
  server: McpServer;
}
