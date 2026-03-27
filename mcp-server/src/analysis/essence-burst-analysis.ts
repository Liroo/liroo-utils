import type { FightEvents, WCLEvent } from "../../lib/wlogs/analysis/event-fetcher.js";
import { SPELLS, spellName } from "../../lib/wlogs/constants/spells.js";

export interface EssenceBurstAnalysis {
  totalProcs: number;
  consumed: number;
  wasted: number; // refreshbuff = proc when already at max stacks
  wasteRate: number;
  consumedBy: Record<string, number>; // spell name -> count
  procsPerMinute: number;
  // Timeline: track EB stacks over time
  stackTimeline: EBStackEvent[];
}

interface EBStackEvent {
  timestamp: number;
  type: "gain" | "consume" | "waste";
  stacks: number;
  relatedSpell?: string;
}

export function analyzeEssenceBurst(
  events: FightEvents,
  fightDurationMs: number
): EssenceBurstAnalysis {
  const { casts, buffs } = events;

  const ebEvents = buffs.filter(
    (e) => e.abilityGameID === SPELLS.ESSENCE_BURST
  );

  // Count procs: applybuff + applybuffstack = new proc gained
  const gained = ebEvents.filter(
    (e) => e.type === "applybuff" || e.type === "applybuffstack"
  );
  // Wasted: refreshbuff means proc at max stacks
  const wasted = ebEvents.filter((e) => e.type === "refreshbuff");
  // Consumed: removebuffstack or removebuff
  const consumed = ebEvents.filter(
    (e) => e.type === "removebuffstack" || e.type === "removebuff"
  );

  const totalProcs = gained.length + wasted.length;

  // For each consumption, find what cast consumed it
  const consumedBy: Record<string, number> = {};
  for (const removal of consumed) {
    const cast = findConsumingCast(casts, removal.timestamp);
    if (cast) {
      const name = spellName(cast.abilityGameID);
      consumedBy[name] = (consumedBy[name] || 0) + 1;
    } else {
      consumedBy["Unknown"] = (consumedBy["Unknown"] || 0) + 1;
    }
  }

  // Build stack timeline
  const stackTimeline: EBStackEvent[] = [];
  let currentStacks = 0;

  for (const e of ebEvents) {
    switch (e.type) {
      case "applybuff":
        currentStacks = 1;
        stackTimeline.push({
          timestamp: e.timestamp,
          type: "gain",
          stacks: currentStacks,
        });
        break;
      case "applybuffstack":
        currentStacks++;
        stackTimeline.push({
          timestamp: e.timestamp,
          type: "gain",
          stacks: currentStacks,
        });
        break;
      case "refreshbuff":
        stackTimeline.push({
          timestamp: e.timestamp,
          type: "waste",
          stacks: currentStacks,
        });
        break;
      case "removebuffstack":
        currentStacks = Math.max(0, currentStacks - 1);
        stackTimeline.push({
          timestamp: e.timestamp,
          type: "consume",
          stacks: currentStacks,
        });
        break;
      case "removebuff":
        currentStacks = 0;
        stackTimeline.push({
          timestamp: e.timestamp,
          type: "consume",
          stacks: 0,
        });
        break;
    }
  }

  return {
    totalProcs: totalProcs,
    consumed: consumed.length,
    wasted: wasted.length,
    wasteRate: totalProcs > 0 ? wasted.length / totalProcs : 0,
    consumedBy,
    procsPerMinute: totalProcs / (fightDurationMs / 60000),
    stackTimeline,
  };
}

function findConsumingCast(
  casts: WCLEvent[],
  removalTimestamp: number
): WCLEvent | null {
  // EB-consuming spells: Echo (free), Emerald Blossom (free), Disintegrate
  const EB_CONSUMERS = new Set<number>([
    SPELLS.ECHO,
    SPELLS.EMERALD_BLOSSOM,
    SPELLS.DISINTEGRATE,
  ]);

  const BUFFER = 500;
  let closest: WCLEvent | null = null;
  let closestDist = Infinity;

  for (const cast of casts) {
    if (cast.type !== "cast") continue;
    if (!EB_CONSUMERS.has(cast.abilityGameID)) continue;

    const dist = Math.abs(cast.timestamp - removalTimestamp);
    if (dist <= BUFFER && dist < closestDist) {
      closest = cast;
      closestDist = dist;
    }
  }

  return closest;
}

export function formatEssenceBurstAnalysis(
  analysis: EssenceBurstAnalysis,
  fightStart: number
): string {
  const lines: string[] = [];

  lines.push("## Essence Burst Analysis");
  lines.push("");
  lines.push(`- **Total procs:** ${analysis.totalProcs}`);
  lines.push(`- **Consumed:** ${analysis.consumed}`);
  lines.push(`- **Wasted (overcapped):** ${analysis.wasted}`);
  lines.push(
    `- **Waste rate:** ${(analysis.wasteRate * 100).toFixed(1)}%`
  );
  lines.push(`- **Procs per minute:** ${analysis.procsPerMinute.toFixed(1)}`);
  lines.push("");

  lines.push("### Consumed By");
  const sorted = Object.entries(analysis.consumedBy).sort(
    ([, a], [, b]) => b - a
  );
  for (const [spell, count] of sorted) {
    lines.push(`  - ${spell}: ${count}`);
  }

  // Find longest streak without consuming
  const wasteStreaks: number[] = [];
  let currentStreak = 0;
  for (const event of analysis.stackTimeline) {
    if (event.type === "waste") {
      currentStreak++;
    } else {
      if (currentStreak > 0) wasteStreaks.push(currentStreak);
      currentStreak = 0;
    }
  }
  if (currentStreak > 0) wasteStreaks.push(currentStreak);

  if (wasteStreaks.length > 0) {
    lines.push("");
    lines.push(
      `### Waste Streaks: ${wasteStreaks.length} sequences of consecutive wastes (max: ${Math.max(...wasteStreaks)})`
    );
  }

  return lines.join("\n");
}
