// ── Report queries ────────────────────────────────────────────

export const GET_REPORT = `
  query GetReport($code: String!) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        endTime
        fights(killType: Encounters) {
          id
          encounterID
          name
          kill
          startTime
          endTime
          difficulty
          size
        }
        masterData(translate: true) {
          actors(type: "Player") {
            id
            gameID
            name
            server
            subType
          }
          npcActors: actors(type: "NPC") {
            id
            gameID
            name
            subType
          }
        }
      }
    }
    rateLimitData {
      limitPerHour
      pointsSpentThisHour
      pointsResetIn
    }
  }
`;

export const GET_PLAYER_DETAILS = `
  query GetPlayerDetails($code: String!, $fightIDs: [Int]!) {
    reportData {
      report(code: $code) {
        playerDetails(fightIDs: $fightIDs)
      }
    }
  }
`;

// ── Event queries ─────────────────────────────────────────────

export const GET_FIGHT_EVENTS = `
  query GetFightEvents(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $dataType: EventDataType!
    $sourceID: Int
    $targetID: Int
    $abilityID: Float
    $filterExpression: String
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
          targetID: $targetID
          abilityID: $abilityID
          filterExpression: $filterExpression
          limit: $limit
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

export const GET_FIGHT_TABLE = `
  query GetFightTable(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $dataType: TableDataType!
    $sourceID: Int
  ) {
    reportData {
      report(code: $code) {
        table(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: $dataType
          sourceID: $sourceID
        )
      }
    }
  }
`;

// ── Cast timeline queries ─────────────────────────────────────

export const GET_CAST_EVENTS = `
  query GetCastEvents(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $sourceID: Int
    $limit: Int
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
          limit: $limit
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

export const GET_CASTS_TABLE = `
  query GetCastsTable(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $sourceID: Int
  ) {
    reportData {
      report(code: $code) {
        table(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: Casts
          sourceID: $sourceID
        )
      }
    }
  }
`;

export const GET_RAID_HEALTH_EVENTS = `
  query GetRaidHealthEvents(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $limit: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: Healing
          limit: $limit
          includeResources: true
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

export const GET_RAID_DAMAGE_EVENTS = `
  query GetRaidDamageEvents(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $limit: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: DamageTaken
          limit: $limit
          includeResources: true
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

export const GET_BUFF_EVENTS = `
  query GetBuffEvents(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
    $sourceID: Int
    $limit: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: Buffs
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

export const GET_DAMAGE_TAKEN_TABLE = `
  query GetDamageTakenTable(
    $code: String!
    $fightIDs: [Int]!
    $startTime: Float!
    $endTime: Float!
  ) {
    reportData {
      report(code: $code) {
        table(
          fightIDs: $fightIDs
          startTime: $startTime
          endTime: $endTime
          dataType: DamageTaken
          hostilityType: Enemies
        )
      }
    }
  }
`;

// ── Ranking queries ───────────────────────────────────────────

export const GET_ENCOUNTER_RANKINGS = `
  query GetEncounterRankings(
    $encounterID: Int!
    $className: String
    $specName: String
    $difficulty: Int
    $metric: CharacterRankingMetricType
    $serverRegion: String
    $page: Int
  ) {
    worldData {
      encounter(id: $encounterID) {
        name
        characterRankings(
          className: $className
          specName: $specName
          difficulty: $difficulty
          metric: $metric
          serverRegion: $serverRegion
          page: $page
        )
      }
    }
    rateLimitData {
      limitPerHour
      pointsSpentThisHour
      pointsResetIn
    }
  }
`;

export const GET_CHARACTER_RANKINGS = `
  query GetCharacterRankings(
    $name: String!
    $serverSlug: String!
    $serverRegion: String!
    $encounterID: Int
    $zoneID: Int
    $difficulty: Int
    $metric: CharacterRankingMetricType
  ) {
    characterData {
      character(
        name: $name
        serverSlug: $serverSlug
        serverRegion: $serverRegion
      ) {
        id
        name
        classID
        encounterRankings(
          encounterID: $encounterID
          difficulty: $difficulty
          metric: $metric
        )
        zoneRankings(
          zoneID: $zoneID
          difficulty: $difficulty
          metric: $metric
        )
      }
    }
  }
`;

// ── Utility queries ───────────────────────────────────────────

export const GET_RATE_LIMIT = `
  query GetRateLimit {
    rateLimitData {
      limitPerHour
      pointsSpentThisHour
      pointsResetIn
    }
  }
`;
