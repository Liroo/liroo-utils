import type { FightEvents } from "../event-fetcher.js";
export interface CastEfficiencyAnalysis {
    totalCasts: number;
    castsPerMinute: number;
    healingGCDs: number;
    damageGCDs: number;
    utilityGCDs: number;
    totalDowntimeMs: number;
    downtimePercent: number;
    longestGap: {
        startTime: number;
        durationMs: number;
    };
    gaps: Array<{
        startTime: number;
        durationMs: number;
    }>;
    spellBreakdown: Array<{
        spell: string;
        spellId: number;
        casts: number;
        castsPerMinute: number;
        category: "healing" | "damage" | "utility" | "movement";
    }>;
    fireDamageGCDs: number;
    echoGCDs: number;
    fireToEchoRatio: number;
}
export declare function analyzeCastEfficiency(events: FightEvents, fightDurationMs: number): CastEfficiencyAnalysis;
export declare function formatCastEfficiency(analysis: CastEfficiencyAnalysis, fightStart: number): string;
//# sourceMappingURL=cast-efficiency.d.ts.map