// ── Report types ──────────────────────────────────────────────

export interface WCLFight {
  id: number;
  encounterID: number;
  name: string;
  kill: boolean;
  startTime: number;
  endTime: number;
  difficulty: number;
  size: number;
}

export interface WCLActor {
  id: number;
  gameID: number;
  name: string;
  server: string;
  subType: string;
}

export interface WCLRateLimitData {
  limitPerHour: number;
  pointsSpentThisHour: number;
  pointsResetIn: number;
}

export interface GetReportResponse {
  reportData: {
    report: {
      code: string;
      title: string;
      startTime: number;
      endTime: number;
      fights: WCLFight[];
      masterData: {
        actors: WCLActor[];
      };
    };
  };
  rateLimitData: WCLRateLimitData;
}

export interface GetPlayerDetailsResponse {
  reportData: {
    report: {
      playerDetails: unknown;
    };
  };
}

// ── Event types ───────────────────────────────────────────────

export interface GetFightEventsResponse {
  reportData: {
    report: {
      events: {
        data: unknown[];
        nextPageTimestamp: number | null;
      };
    };
  };
}

export interface GetFightTableResponse {
  reportData: {
    report: {
      table: unknown;
    };
  };
}

// ── Ranking types ─────────────────────────────────────────────

export interface GetEncounterRankingsResponse {
  worldData: {
    encounter: {
      name: string;
      characterRankings: unknown;
    };
  };
  rateLimitData: WCLRateLimitData;
}

export interface GetCharacterRankingsResponse {
  characterData: {
    character: {
      id: number;
      name: string;
      classID: number;
      encounterRankings: unknown;
      zoneRankings: unknown;
    };
  };
}

// ── Rate limit ────────────────────────────────────────────────

export interface GetRateLimitResponse {
  rateLimitData: WCLRateLimitData;
}

// ── Cast timeline types ──────────────────────────────────────

export interface CastTimelineEvent {
  timestamp: number;
  type: string;
  abilityGameID: number;
  abilityName: string;
  abilityIcon: string;
  targetID: number;
  empowermentLevel?: number;
  essence?: number;
  essenceMax?: number;
  essenceCost?: number;
  mana?: number;
  manaMax?: number;
  manaCost?: number;
  hitPoints?: number;
  maxHitPoints?: number;
}

/** A single buff state change */
export interface BuffTimelineEvent {
  /** ms relative to fight start */
  timestamp: number;
  /** "applybuff" | "removebuff" | "applybuffstack" | "removebuffstack" | "refreshbuff" */
  type: string;
  abilityGameID: number;
  /** Current stack count after this event */
  stacks: number;
}

/** Pre-built buff lane: spans of time with a given stack count */
export interface BuffLaneSpan {
  startTime: number; // ms relative to fight start
  endTime: number;
  stacks: number;
}

export interface BuffLane {
  abilityGameID: number;
  name: string;
  icon: string;
  maxStacks: number;
  spans: BuffLaneSpan[];
}

/** A buff apply/remove on a raid target */
export interface RaidBuffEvent {
  timestamp: number; // ms relative to fight start
  targetID: number;
  buffId: number;
  type: "apply" | "remove";
}

export interface RaidBuffDef {
  id: number;
  name: string;
  icon: string;
  color: string;
  /** Short label for raid frames */
  abbrev: string;
}

/** @deprecated use raidBuffEvents + raidBuffDefs instead */
export interface EchoTargetEvent {
  timestamp: number;
  targetID: number;
  type: "apply" | "remove";
}

/** A HP snapshot for one player at a point in time */
export interface HPSnapshot {
  timestamp: number; // ms relative to fight start
  targetID: number;
  hitPoints: number;
  maxHitPoints: number;
}

/** HPS data point (healing per second over a rolling window) */
export interface HPSPoint {
  timestamp: number; // ms relative to fight start
  hps: number;
}

export interface CastTimelineResult {
  events: CastTimelineEvent[];
  fightDuration: number;
  abilities: Record<number, { name: string; icon: string }>;
  buffLanes: BuffLane[];
  echoEvents: EchoTargetEvent[];
  raidBuffEvents: RaidBuffEvent[];
  raidBuffDefs: RaidBuffDef[];
  raidHP: HPSnapshot[];
  hpsGraph: HPSPoint[];
}

export interface GetCastTimelineParams {
  code: string;
  fightID: number;
  startTime: number;
  endTime: number;
  sourceID: number;
}

// ── Method parameter types ────────────────────────────────────

export interface GetFightEventsParams {
  code: string;
  fightID: number;
  startTime: number;
  endTime: number;
  dataType: string;
  sourceID?: number;
  targetID?: number;
  abilityID?: number;
  filterExpression?: string;
  limit?: number;
}

export interface GetFightTableParams {
  code: string;
  fightID: number;
  startTime: number;
  endTime: number;
  dataType: string;
  sourceID?: number;
}

export interface GetEncounterRankingsParams {
  encounterID: number;
  className?: string;
  specName?: string;
  difficulty?: number;
  metric?: string;
  serverRegion?: string;
  page?: number;
}

export interface GetCharacterRankingsParams {
  name: string;
  serverSlug: string;
  serverRegion: string;
  encounterID?: number;
  zoneID?: number;
  difficulty?: number;
  metric?: string;
}
