import type { FightEvents } from "../event-fetcher.js";
export interface EchoAnalysis {
    totalEchoCasts: number;
    hardcastEchoCasts: number;
    taEchoApplications: number;
    echoConsumptions: Record<string, number>;
    echoExpired: number;
    echoCastsPerMinute: number;
    echoTargetDistribution: Record<number, number>;
    echoWindows: EchoWindow[];
    echoAtEmpowered: EmpoweredEchoSnapshot[];
}
export interface EchoWindow {
    startTime: number;
    endTime: number;
    echosApplied: number;
    consumedBy: string | null;
}
export interface EmpoweredEchoSnapshot {
    timestamp: number;
    spell: string;
    empowerLevel: number;
    activeEchos: number;
    targets: number[];
}
export declare function analyzeEcho(events: FightEvents, fightDurationMs: number): EchoAnalysis;
export declare function formatEchoAnalysis(analysis: EchoAnalysis, fightStart: number): string;
//# sourceMappingURL=echo-analysis.d.ts.map