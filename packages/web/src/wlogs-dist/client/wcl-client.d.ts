import type { GetReportResponse, GetPlayerDetailsResponse, GetFightTableResponse, GetEncounterRankingsResponse, GetCharacterRankingsResponse, GetRateLimitResponse, GetFightEventsParams, GetFightTableParams, GetEncounterRankingsParams, GetCharacterRankingsParams, GetCastTimelineParams, CastTimelineResult } from "../types/wcl-responses.js";
export declare class WCLClient {
    private clientId;
    private clientSecret;
    private accessToken;
    private tokenExpiresAt;
    constructor(clientId: string, clientSecret: string);
    private authenticate;
    query<T = unknown>(graphqlQuery: string, variables?: Record<string, unknown>): Promise<T>;
    getReport(code: string): Promise<GetReportResponse>;
    getPlayerDetails(code: string, fightIDs: number[]): Promise<GetPlayerDetailsResponse>;
    /**
     * Fetch fight events with automatic pagination.
     * Returns the full array of events across all pages.
     */
    getFightEvents(params: GetFightEventsParams): Promise<{
        eventCount: number;
        events: unknown[];
    }>;
    getFightTable(params: GetFightTableParams): Promise<GetFightTableResponse>;
    getEncounterRankings(params: GetEncounterRankingsParams): Promise<GetEncounterRankingsResponse>;
    getCharacterRankings(params: GetCharacterRankingsParams): Promise<GetCharacterRankingsResponse>;
    /**
     * Fetch cast timeline with ability icons and resource data.
     * Combines Casts events (with includeResources) and Casts table (for icons).
     */
    getCastTimeline(params: GetCastTimelineParams): Promise<CastTimelineResult>;
    getRateLimit(): Promise<GetRateLimitResponse>;
}
//# sourceMappingURL=wcl-client.d.ts.map