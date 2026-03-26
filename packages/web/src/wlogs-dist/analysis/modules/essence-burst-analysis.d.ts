import type { FightEvents } from "../event-fetcher.js";
export interface EssenceBurstAnalysis {
    totalProcs: number;
    consumed: number;
    wasted: number;
    wasteRate: number;
    consumedBy: Record<string, number>;
    procsPerMinute: number;
    stackTimeline: EBStackEvent[];
}
interface EBStackEvent {
    timestamp: number;
    type: "gain" | "consume" | "waste";
    stacks: number;
    relatedSpell?: string;
}
export declare function analyzeEssenceBurst(events: FightEvents, fightDurationMs: number): EssenceBurstAnalysis;
export declare function formatEssenceBurstAnalysis(analysis: EssenceBurstAnalysis, fightStart: number): string;
export {};
//# sourceMappingURL=essence-burst-analysis.d.ts.map