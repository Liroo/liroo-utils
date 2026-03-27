import { z } from "zod";
import type { ToolContext } from "./types.js";

export function registerRankingTools({ wcl, server }: ToolContext) {
  server.registerTool("get-encounter-rankings", {
    title: "Get Encounter Rankings",
    description:
      "Get top player rankings for a boss encounter. " +
      "Use this to find top Preservation Evokers (or any spec) and their report codes for comparison. " +
      "Returns ranked players with their report codes, fight IDs, and performance metrics.",
    inputSchema: {
      encounterID: z.number().describe("Encounter/boss ID from WCL"),
      className: z.string().optional().describe('Class name, e.g. "Evoker"'),
      specName: z.string().optional().describe('Spec name, e.g. "Preservation"'),
      difficulty: z.number().optional().describe("3=Normal, 4=Heroic, 5=Mythic"),
      metric: z.string().optional().default("hps").describe("Ranking metric: hps, dps, bossdps, etc."),
      serverRegion: z.string().optional().describe('"US", "EU", "KR", "TW"'),
      page: z.number().optional().default(1).describe("Page number"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ encounterID, className, specName, difficulty, metric, serverRegion, page }) => {
    const data = await wcl.getEncounterRankings({
      encounterID, className, specName, difficulty, metric, serverRegion, page,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });

  server.registerTool("get-character-rankings", {
    title: "Get Character Rankings",
    description:
      "Get a specific character's rankings across encounters and zones. " +
      "Shows parse percentiles, best kills, and historical performance.",
    inputSchema: {
      name: z.string().describe("Character name"),
      serverSlug: z.string().describe('Server slug, e.g. "hyjal"'),
      serverRegion: z.string().describe('"US", "EU", "KR", "TW"'),
      encounterID: z.number().optional().describe("Filter to specific boss"),
      zoneID: z.number().optional().describe("Filter to specific raid zone"),
      difficulty: z.number().optional().describe("3=Normal, 4=Heroic, 5=Mythic"),
      metric: z.string().optional().default("hps").describe("hps, dps, etc."),
    },
    annotations: { readOnlyHint: true },
  }, async ({ name, serverSlug, serverRegion, encounterID, zoneID, difficulty, metric }) => {
    const data = await wcl.getCharacterRankings({
      name, serverSlug, serverRegion, encounterID, zoneID, difficulty, metric,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });
}
