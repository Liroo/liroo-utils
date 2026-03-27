import type { ToolContext } from "./types.js";

export function registerUtilTools({ wcl, server }: ToolContext) {
  server.registerTool("get-rate-limit", {
    title: "Get Rate Limit Status",
    description: "Check current WCL API rate limit: points spent, limit per hour, and reset time.",
    annotations: { readOnlyHint: true },
  }, async () => {
    const data = await wcl.getRateLimit();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });
}
