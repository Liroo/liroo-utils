import type { WCLClient } from "../../client/wcl-client.js";
import { SPELLS, spellName } from "../../constants/spells.js";

export interface EssenceTimelinePoint {
  /** Timestamp relative to fight start (ms) */
  time: number;
  /** Essence amount BEFORE this event (0-5) */
  essence: number;
  /** Essence max (usually 5) */
  essenceMax: number;
  /** Whether Essence Burst buff is active at this moment */
  essenceBurstActive: boolean;
  /** Essence Burst stacks (0, 1, or 2) */
  essenceBurstStacks: number;
  /** What triggered this data point */
  event: "cast" | "regen" | "eb_gain" | "eb_consume" | "eb_expire";
  /** Spell cast (if event=cast) */
  spell?: string;
  spellId?: number;
  /** Essence cost of the cast (0 if free via EB) */
  essenceCost: number;
  /** Was this cast free (Essence Burst consumed)? */
  freecast: boolean;
  /** Target name if applicable */
  target?: string;
  /** Was essence overcapped at this point? (at max and regen ticking) */
  overcapped: boolean;
}

export interface EssenceTimelineResult {
  playerName: string;
  fightDurationMs: number;
  timeline: EssenceTimelinePoint[];
  summary: {
    totalEssenceSpent: number;
    totalEssenceWasted: number;
    timeAtMaxEssence: number; // ms spent at 5/5
    timeAtMaxEssencePercent: number;
    freeCastsFromEB: number;
    totalCastsWithEssenceCost: number;
    essenceBurstUptime: number; // ms
    essenceBurstUptimePercent: number;
  };
}

const CASTS_WITH_RESOURCES_QUERY = `
  query GetCastsWithResources(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $sourceID: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: Casts
          sourceID: $sourceID
          includeResources: true
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

const BUFFS_QUERY = `
  query GetBuffs(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $sourceID: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: Buffs
          sourceID: $sourceID
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

interface RawEvent {
  timestamp: number;
  type: string;
  sourceID: number;
  targetID: number;
  abilityGameID: number;
  fight: number;
  empowermentLevel?: number;
  classResources?: Array<{
    amount: number;
    max: number;
    type: number;
    cost?: number;
  }>;
  stack?: number;
}

async function fetchAllPaginated(
  wcl: WCLClient,
  query: string,
  variables: Record<string, unknown>
): Promise<RawEvent[]> {
  const allEvents: RawEvent[] = [];
  let currentStart = variables.startTime as number;
  const endTime = variables.endTime as number;

  while (true) {
    const data = (await wcl.query(query, {
      ...variables,
      startTime: currentStart,
    })) as {
      reportData: {
        report: {
          events: { data: RawEvent[]; nextPageTimestamp: number | null };
        };
      };
    };

    const events = data.reportData.report.events;
    allEvents.push(...events.data);

    if (!events.nextPageTimestamp || events.nextPageTimestamp >= endTime) break;
    currentStart = events.nextPageTimestamp;
  }

  return allEvents;
}

export async function buildEssenceTimeline(
  wcl: WCLClient,
  code: string,
  fightID: number,
  startTime: number,
  endTime: number,
  sourceID: number,
  playerName: string
): Promise<EssenceTimelineResult> {
  const fightDuration = endTime - startTime;

  // Fetch casts with resources and buffs in parallel
  const [casts, buffs] = await Promise.all([
    fetchAllPaginated(wcl, CASTS_WITH_RESOURCES_QUERY, {
      code,
      fightIDs: [fightID],
      startTime,
      endTime,
      sourceID,
    }),
    fetchAllPaginated(wcl, BUFFS_QUERY, {
      code,
      fightIDs: [fightID],
      startTime,
      endTime,
      sourceID,
    }),
  ]);

  // Build Essence Burst state timeline from buff events
  const ebEvents = buffs.filter(
    (e) => e.abilityGameID === SPELLS.ESSENCE_BURST
  );

  // Track EB stacks over time
  interface EBState {
    timestamp: number;
    stacks: number;
  }
  const ebStates: EBState[] = [{ timestamp: startTime, stacks: 0 }];
  let currentEBStacks = 0;

  for (const e of ebEvents) {
    switch (e.type) {
      case "applybuff":
        currentEBStacks = 1;
        break;
      case "applybuffstack":
        currentEBStacks = Math.min(currentEBStacks + 1, 2);
        break;
      case "removebuffstack":
        currentEBStacks = Math.max(currentEBStacks - 1, 0);
        break;
      case "removebuff":
        currentEBStacks = 0;
        break;
      case "refreshbuff":
        // Wasted proc - stacks stay the same (already at max)
        break;
    }
    ebStates.push({ timestamp: e.timestamp, stacks: currentEBStacks });
  }

  function getEBStacksAt(timestamp: number): number {
    let stacks = 0;
    for (const state of ebStates) {
      if (state.timestamp > timestamp) break;
      stacks = state.stacks;
    }
    return stacks;
  }

  // Build the timeline from cast events
  const timeline: EssenceTimelinePoint[] = [];
  let lastEssence = 5; // Start at max (assumed)
  let lastEssenceTimestamp = startTime;
  let totalEssenceSpent = 0;
  let totalEssenceWasted = 0;
  let freeCasts = 0;
  let essenceCostCasts = 0;
  let timeAtMax = 0;

  // Also add EB buff change events to timeline
  for (const e of ebEvents) {
    const ebStacks = getEBStacksAt(e.timestamp);
    let eventType: EssenceTimelinePoint["event"];
    switch (e.type) {
      case "applybuff":
      case "applybuffstack":
      case "refreshbuff":
        eventType = "eb_gain";
        break;
      case "removebuffstack":
      case "removebuff":
        eventType = "eb_consume";
        break;
      default:
        eventType = "eb_expire";
    }

    timeline.push({
      time: e.timestamp - startTime,
      essence: lastEssence,
      essenceMax: 5,
      essenceBurstActive: ebStacks > 0,
      essenceBurstStacks: ebStacks,
      event: eventType,
      essenceCost: 0,
      freecast: false,
      overcapped: lastEssence >= 5,
    });
  }

  // Process casts - extract essence from classResources
  for (const cast of casts) {
    if (cast.type !== "cast" && cast.type !== "empowerend") continue;

    const essenceResource = cast.classResources?.find((r) => r.type === 19);
    const ebStacks = getEBStacksAt(cast.timestamp);

    if (essenceResource) {
      // We have essence data for this cast
      const essenceBefore = essenceResource.amount;
      const essenceCost = essenceResource.cost ?? 0;
      const isFree = essenceCost === 0 && ebStacks > 0;

      // Check overcap: if we were at max since last cast, regen was wasted
      if (lastEssence >= essenceResource.max) {
        const timeSinceLast = cast.timestamp - lastEssenceTimestamp;
        timeAtMax += timeSinceLast;
      }

      if (isFree) freeCasts++;
      if (essenceCost > 0) {
        essenceCostCasts++;
        totalEssenceSpent += essenceCost;
      }

      timeline.push({
        time: cast.timestamp - startTime,
        essence: essenceBefore,
        essenceMax: essenceResource.max,
        essenceBurstActive: ebStacks > 0,
        essenceBurstStacks: ebStacks,
        event: "cast",
        spell: spellName(cast.abilityGameID),
        spellId: cast.abilityGameID,
        essenceCost,
        freecast: isFree,
        target: cast.targetID > 0 ? String(cast.targetID) : undefined,
        overcapped: essenceBefore >= essenceResource.max,
      });

      lastEssence = essenceBefore - essenceCost;
      lastEssenceTimestamp = cast.timestamp;
    } else {
      // No essence resource data (spell doesn't interact with essence)
      // Still add to timeline for completeness
      timeline.push({
        time: cast.timestamp - startTime,
        essence: lastEssence,
        essenceMax: 5,
        essenceBurstActive: ebStacks > 0,
        essenceBurstStacks: ebStacks,
        event: "cast",
        spell: spellName(cast.abilityGameID),
        spellId: cast.abilityGameID,
        essenceCost: 0,
        freecast: false,
        overcapped: lastEssence >= 5,
      });
    }
  }

  // Sort timeline by time
  timeline.sort((a, b) => a.time - b.time);

  // Calculate time at max more precisely
  // Walk through timeline and sum up time spent at max essence
  let precisTimeAtMax = 0;
  let prevTime = 0;
  let prevEssence = 5;
  for (const point of timeline) {
    if (prevEssence >= 5) {
      precisTimeAtMax += point.time - prevTime;
    }
    if (point.event === "cast" && point.essenceCost > 0) {
      prevEssence = point.essence - point.essenceCost;
    } else if (point.event === "cast" && point.essenceCost === 0) {
      // No change to essence from this cast
    } else {
      prevEssence = point.essence;
    }
    prevTime = point.time;
  }

  // Estimate wasted essence from time at max
  // Base regen: 1 essence per 5s (before haste)
  const REGEN_RATE_MS = 5000;
  totalEssenceWasted = Math.floor(precisTimeAtMax / REGEN_RATE_MS);

  // EB uptime
  let ebUptime = 0;
  let lastEBChange = 0;
  let lastEBActive = false;
  for (const state of ebStates) {
    if (lastEBActive) {
      ebUptime += state.timestamp - lastEBChange;
    }
    lastEBActive = state.stacks > 0;
    lastEBChange = state.timestamp;
  }
  if (lastEBActive) {
    ebUptime += endTime - lastEBChange;
  }

  return {
    playerName,
    fightDurationMs: fightDuration,
    timeline,
    summary: {
      totalEssenceSpent,
      totalEssenceWasted,
      timeAtMaxEssence: precisTimeAtMax,
      timeAtMaxEssencePercent: (precisTimeAtMax / fightDuration) * 100,
      freeCastsFromEB: freeCasts,
      totalCastsWithEssenceCost: essenceCostCasts,
      essenceBurstUptime: ebUptime,
      essenceBurstUptimePercent: (ebUptime / fightDuration) * 100,
    },
  };
}
