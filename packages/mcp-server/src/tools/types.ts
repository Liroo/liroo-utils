import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WCLClient } from "@liroo/wlogs/client";

export type RegisterToolFn = McpServer["registerTool"];

export interface ToolContext {
  wcl: WCLClient;
  server: McpServer;
}
