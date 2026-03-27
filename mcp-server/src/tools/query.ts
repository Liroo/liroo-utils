import { z } from "zod";
import type { ToolContext } from "./types.js";

export function registerQueryTool({ wcl, server }: ToolContext) {
  server.registerTool("wcl-query", {
    title: "WCL GraphQL Query",
    description:
      "Execute any arbitrary GraphQL query against the Warcraft Logs v2 API. " +
      "Use this for custom/dynamic queries not covered by other tools. " +
      "The endpoint is https://www.warcraftlogs.com/api/v2/client. " +
      "Authentication is handled automatically.",
    inputSchema: {
      query: z
        .string()
        .describe("The GraphQL query string"),
      variables: z
        .string()
        .optional()
        .describe("JSON-encoded variables for the query"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  }, async ({ query, variables }) => {
    const vars = variables ? JSON.parse(variables) : undefined;
    const data = await wcl.query(query, vars);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });
}
