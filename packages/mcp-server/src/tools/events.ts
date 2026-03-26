import { z } from "zod";
import type { ToolContext } from "./types.js";

const EVENT_DATA_TYPES = [
  "All", "Casts", "Healing", "DamageDone", "DamageTaken",
  "Buffs", "Debuffs", "Deaths", "Resources", "Dispels",
  "Interrupts", "Summons", "CombatantInfo",
] as const;

const TABLE_DATA_TYPES = [
  "Buffs", "Casts", "DamageDone", "DamageTaken", "Deaths",
  "Debuffs", "Dispels", "Healing", "Interrupts", "Resources",
  "Summons", "Survivability", "Threat",
] as const;

export function registerEventTools({ wcl, server }: ToolContext) {
  server.registerTool("get-fight-events", {
    title: "Get Fight Events",
    description:
      "Get detailed events for a specific fight. Supports all event types: Casts, Healing, Buffs, etc. " +
      "Automatically paginates to retrieve all events. Use sourceID to filter to a specific player " +
      "(get actor IDs from get-report). You can also use filterExpression for advanced WCL filters " +
      "(same syntax as the website, e.g. 'ability.id = 12345').",
    inputSchema: {
      code: z.string().describe("Report code"),
      fightID: z.number().describe("Fight ID (from get-report)"),
      startTime: z.number().describe("Start time in ms (relative to report start)"),
      endTime: z.number().describe("End time in ms (relative to report start)"),
      dataType: z.enum(EVENT_DATA_TYPES).describe("Type of events to retrieve"),
      sourceID: z.number().optional().describe("Filter to source player (actor ID)"),
      targetID: z.number().optional().describe("Filter to target (actor ID)"),
      abilityID: z.number().optional().describe("Filter to specific ability ID"),
      filterExpression: z.string().optional().describe("WCL filter expression"),
      limit: z.number().optional().default(10000).describe("Max events per page"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ code, fightID, startTime, endTime, dataType, sourceID, targetID, abilityID, filterExpression, limit }) => {
    const data = await wcl.getFightEvents({
      code, fightID, startTime, endTime, dataType, sourceID, targetID, abilityID, filterExpression, limit,
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      }],
    };
  });

  server.registerTool("get-fight-table", {
    title: "Get Fight Table",
    description:
      "Get aggregated table data for a fight (like the tables on the WCL website). " +
      "Great for quick summaries: total healing done, damage done, cast counts, buff uptimes, etc.",
    inputSchema: {
      code: z.string().describe("Report code"),
      fightID: z.number().describe("Fight ID"),
      startTime: z.number().describe("Start time in ms"),
      endTime: z.number().describe("End time in ms"),
      dataType: z.enum(TABLE_DATA_TYPES).describe("Type of table data"),
      sourceID: z.number().optional().describe("Filter to specific player (actor ID)"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ code, fightID, startTime, endTime, dataType, sourceID }) => {
    const data = await wcl.getFightTable({
      code, fightID, startTime, endTime, dataType, sourceID,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });
}
