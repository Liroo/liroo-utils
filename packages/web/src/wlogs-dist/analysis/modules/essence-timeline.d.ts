import type { WCLClient } from "../../client/wcl-client.js";
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
        timeAtMaxEssence: number;
        timeAtMaxEssencePercent: number;
        freeCastsFromEB: number;
        totalCastsWithEssenceCost: number;
        essenceBurstUptime: number;
        essenceBurstUptimePercent: number;
    };
}
export declare function buildEssenceTimeline(wcl: WCLClient, code: string, fightID: number, startTime: number, endTime: number, sourceID: number, playerName: string): Promise<EssenceTimelineResult>;
//# sourceMappingURL=essence-timeline.d.ts.map