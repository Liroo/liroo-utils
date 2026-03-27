import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WCLClient } from "../../lib/wlogs/client/wcl-client.js";
import { registerQueryTool } from "./tools/query.js";
import { registerReportTools } from "./tools/report.js";
import { registerEventTools } from "./tools/events.js";
import { registerRankingTools } from "./tools/rankings.js";
import { registerUtilTools } from "./tools/utils.js";
import { registerAnalyzeTools } from "./tools/analyze.js";

const clientId = process.env.WCL_CLIENT_ID;
const clientSecret = process.env.WCL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing WCL_CLIENT_ID or WCL_CLIENT_SECRET environment variables");
  process.exit(1);
}

const wcl = new WCLClient(clientId, clientSecret);

const server = new McpServer({
  name: "wcl-mcp-server",
  version: "0.1.0",
});

const ctx = { wcl, server };

// Register all tool modules
registerQueryTool(ctx);
registerReportTools(ctx);
registerEventTools(ctx);
registerRankingTools(ctx);
registerUtilTools(ctx);
registerAnalyzeTools(ctx);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WCL MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
