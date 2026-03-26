import type { WCLClient } from "../client/wcl-client.js";

export interface WCLEvent {
  timestamp: number;
  type: string;
  sourceID: number;
  targetID: number;
  abilityGameID: number;
  fight: number;
  empowermentLevel?: number;
  stack?: number;
  hitPoints?: number;
  maxHitPoints?: number;
  // healing events
  amount?: number;
  overheal?: number;
  absorbed?: number;
}

export interface FightEvents {
  casts: WCLEvent[];
  buffs: WCLEvent[];
  healing: WCLEvent[];
}

const EVENTS_QUERY = `
  query GetEvents(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $dataType: EventDataType!
    $sourceID: Int
    $limit: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: $dataType
          sourceID: $sourceID
          limit: $limit
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

async function fetchAllEvents(
  wcl: WCLClient,
  code: string,
  fightID: number,
  startTime: number,
  endTime: number,
  dataType: string,
  sourceID: number
): Promise<WCLEvent[]> {
  const allEvents: WCLEvent[] = [];
  let currentStart = startTime;

  while (true) {
    const data = (await wcl.query(EVENTS_QUERY, {
      code,
      fightIDs: [fightID],
      startTime: currentStart,
      endTime,
      dataType,
      sourceID,
      limit: 10000,
    })) as {
      reportData: {
        report: {
          events: { data: WCLEvent[]; nextPageTimestamp: number | null };
        };
      };
    };

    const events = data.reportData.report.events;
    allEvents.push(...events.data);

    if (!events.nextPageTimestamp) break;
    currentStart = events.nextPageTimestamp;
  }

  return allEvents;
}

export async function fetchFightEvents(
  wcl: WCLClient,
  code: string,
  fightID: number,
  startTime: number,
  endTime: number,
  sourceID: number
): Promise<FightEvents> {
  const [casts, buffs, healing] = await Promise.all([
    fetchAllEvents(wcl, code, fightID, startTime, endTime, "Casts", sourceID),
    fetchAllEvents(wcl, code, fightID, startTime, endTime, "Buffs", sourceID),
    fetchAllEvents(wcl, code, fightID, startTime, endTime, "Healing", sourceID),
  ]);

  return { casts, buffs, healing };
}
