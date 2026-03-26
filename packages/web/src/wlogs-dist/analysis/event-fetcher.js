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
async function fetchAllEvents(wcl, code, fightID, startTime, endTime, dataType, sourceID) {
    const allEvents = [];
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
        }));
        const events = data.reportData.report.events;
        allEvents.push(...events.data);
        if (!events.nextPageTimestamp)
            break;
        currentStart = events.nextPageTimestamp;
    }
    return allEvents;
}
export async function fetchFightEvents(wcl, code, fightID, startTime, endTime, sourceID) {
    const [casts, buffs, healing] = await Promise.all([
        fetchAllEvents(wcl, code, fightID, startTime, endTime, "Casts", sourceID),
        fetchAllEvents(wcl, code, fightID, startTime, endTime, "Buffs", sourceID),
        fetchAllEvents(wcl, code, fightID, startTime, endTime, "Healing", sourceID),
    ]);
    return { casts, buffs, healing };
}
//# sourceMappingURL=event-fetcher.js.map