import { z } from "zod";
import type { ToolContext } from "./types.js";

export function registerReportTools({ wcl, server }: ToolContext) {
  server.registerTool("get-report", {
    title: "Get WCL Report",
    description:
      "Get a Warcraft Logs report with fights list and player roster. " +
      "Returns encounter fights, player actors (with their IDs for use in other tools), and report metadata.",
    inputSchema: {
      code: z.string().describe("The report code (from URL: warcraftlogs.com/reports/<code>)"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ code }) => {
    const data = await wcl.getReport(code);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });

  server.registerTool("get-player-details", {
    title: "Get Player Details",
    description:
      "Get detailed player info for fights: specs, talents, gear, stats. " +
      "Useful to understand a player's build and compare talent choices.",
    inputSchema: {
      code: z.string().describe("Report code"),
      fightIDs: z.array(z.number()).describe("Fight IDs to get player details for"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ code, fightIDs }) => {
    const data = await wcl.getPlayerDetails(code, fightIDs);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });
}
