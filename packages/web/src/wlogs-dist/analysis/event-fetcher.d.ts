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
    amount?: number;
    overheal?: number;
    absorbed?: number;
}
export interface FightEvents {
    casts: WCLEvent[];
    buffs: WCLEvent[];
    healing: WCLEvent[];
}
export declare function fetchFightEvents(wcl: WCLClient, code: string, fightID: number, startTime: number, endTime: number, sourceID: number): Promise<FightEvents>;
//# sourceMappingURL=event-fetcher.d.ts.map