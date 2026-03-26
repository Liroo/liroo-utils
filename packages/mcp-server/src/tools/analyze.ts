import { z } from "zod";
import type { ToolContext } from "./types.js";
import { fetchFightEvents } from "@liroo/wlogs/analysis/event-fetcher";
import { analyzeEcho, formatEchoAnalysis } from "@liroo/wlogs/analysis/echo";
import { analyzeEssenceBurst, formatEssenceBurstAnalysis } from "@liroo/wlogs/analysis/essence-burst";
import { analyzeCastEfficiency, formatCastEfficiency } from "@liroo/wlogs/analysis/cast-efficiency";
import { buildEssenceTimeline } from "@liroo/wlogs/analysis/essence-timeline";

export function registerAnalyzeTools({ wcl, server }: ToolContext) {
  server.registerTool("analyze-preservation", {
    title: "Analyze Preservation Evoker",
    description:
      "Run modular analysis on a Preservation Evoker's performance in a fight. " +
      "Modules: echo (Echo usage, ramp windows, active count at empowered casts), " +
      "essence-burst (proc tracking, waste rate, consumption), " +
      "cast-efficiency (ABC, downtime, GCD usage, Fire Breath vs Echo ratio). " +
      "Fetches all required events automatically. Use get-report first to find fight IDs and source IDs.",
    inputSchema: {
      code: z.string().describe("Report code"),
      fightID: z.number().describe("Fight ID"),
      startTime: z.number().describe("Fight start time (ms)"),
      endTime: z.number().describe("Fight end time (ms)"),
      sourceID: z.number().describe("Player's actor ID"),
      modules: z
        .array(z.enum(["echo", "essence-burst", "cast-efficiency", "all"]))
        .default(["all"])
        .describe("Which analysis modules to run"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ code, fightID, startTime, endTime, sourceID, modules }) => {
    const runAll = modules.includes("all");
    const fightDuration = endTime - startTime;

    // Fetch all events
    const events = await fetchFightEvents(
      wcl, code, fightID, startTime, endTime, sourceID
    );

    const sections: string[] = [];
    sections.push(`# Preservation Evoker Analysis`);
    sections.push(`Fight duration: ${(fightDuration / 1000).toFixed(0)}s (${(fightDuration / 60000).toFixed(1)}min)`);
    sections.push(`Events fetched: ${events.casts.length} casts, ${events.buffs.length} buffs, ${events.healing.length} healing`);
    sections.push("");

    if (runAll || modules.includes("echo")) {
      const echoResult = analyzeEcho(events, fightDuration);
      sections.push(formatEchoAnalysis(echoResult, startTime));
      sections.push("");
    }

    if (runAll || modules.includes("essence-burst")) {
      const ebResult = analyzeEssenceBurst(events, fightDuration);
      sections.push(formatEssenceBurstAnalysis(ebResult, startTime));
      sections.push("");
    }

    if (runAll || modules.includes("cast-efficiency")) {
      const castResult = analyzeCastEfficiency(events, fightDuration);
      sections.push(formatCastEfficiency(castResult, startTime));
      sections.push("");
    }

    return {
      content: [{ type: "text" as const, text: sections.join("\n") }],
    };
  });

  server.registerTool("compare-preservation", {
    title: "Compare Two Preservation Evokers",
    description:
      "Compare two Preservation Evoker performances side by side. " +
      "Runs all analysis modules on both players and highlights key differences. " +
      "Use get-report first to find fight IDs and source IDs for both players.",
    inputSchema: {
      player1: z.object({
        code: z.string(),
        fightID: z.number(),
        startTime: z.number(),
        endTime: z.number(),
        sourceID: z.number(),
        name: z.string(),
      }).describe("First player (you)"),
      player2: z.object({
        code: z.string(),
        fightID: z.number(),
        startTime: z.number(),
        endTime: z.number(),
        sourceID: z.number(),
        name: z.string(),
      }).describe("Second player (reference)"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ player1, player2 }) => {
    // Fetch events for both in parallel
    const [events1, events2] = await Promise.all([
      fetchFightEvents(wcl, player1.code, player1.fightID, player1.startTime, player1.endTime, player1.sourceID),
      fetchFightEvents(wcl, player2.code, player2.fightID, player2.startTime, player2.endTime, player2.sourceID),
    ]);

    const dur1 = player1.endTime - player1.startTime;
    const dur2 = player2.endTime - player2.startTime;

    const echo1 = analyzeEcho(events1, dur1);
    const echo2 = analyzeEcho(events2, dur2);
    const eb1 = analyzeEssenceBurst(events1, dur1);
    const eb2 = analyzeEssenceBurst(events2, dur2);
    const cast1 = analyzeCastEfficiency(events1, dur1);
    const cast2 = analyzeCastEfficiency(events2, dur2);

    const lines: string[] = [];
    lines.push(`# Comparison: ${player1.name} vs ${player2.name}`);
    lines.push("");

    // Summary table
    lines.push("## Key Metrics");
    lines.push("");
    lines.push(`| Metric | ${player1.name} | ${player2.name} | Delta |`);
    lines.push(`|--------|-------|-------|-------|`);

    const addRow = (label: string, v1: number, v2: number, fmt: (n: number) => string = (n) => n.toFixed(1)) => {
      const delta = v1 - v2;
      const pct = v2 !== 0 ? ((delta / v2) * 100).toFixed(0) : "N/A";
      const sign = delta > 0 ? "+" : "";
      lines.push(`| ${label} | ${fmt(v1)} | ${fmt(v2)} | ${sign}${pct}% |`);
    };

    addRow("Echo casts", echo1.totalEchoCasts, echo2.totalEchoCasts, (n) => String(n));
    addRow("Echo CPM", echo1.echoCastsPerMinute, echo2.echoCastsPerMinute);
    addRow("Echos expired", echo1.echoExpired, echo2.echoExpired, (n) => String(n));
    addRow("EB total procs", eb1.totalProcs, eb2.totalProcs, (n) => String(n));
    addRow("EB wasted", eb1.wasted, eb2.wasted, (n) => String(n));
    addRow("EB waste rate", eb1.wasteRate * 100, eb2.wasteRate * 100, (n) => n.toFixed(1) + "%");
    addRow("Total GCD casts", cast1.totalCasts, cast2.totalCasts, (n) => String(n));
    addRow("CPM", cast1.castsPerMinute, cast2.castsPerMinute);
    addRow("Healing GCDs", cast1.healingGCDs, cast2.healingGCDs, (n) => String(n));
    addRow("Damage GCDs", cast1.damageGCDs, cast2.damageGCDs, (n) => String(n));
    addRow("Fire Breath casts", cast1.fireDamageGCDs, cast2.fireDamageGCDs, (n) => String(n));
    addRow("Downtime %", cast1.downtimePercent, cast2.downtimePercent, (n) => n.toFixed(1) + "%");

    lines.push("");

    // Echo at empowered comparison
    lines.push("## Echo at Empowered Casts");
    lines.push("");

    const avgEchos1 = echo1.echoAtEmpowered.length > 0
      ? echo1.echoAtEmpowered.reduce((s, e) => s + e.activeEchos, 0) / echo1.echoAtEmpowered.length
      : 0;
    const avgEchos2 = echo2.echoAtEmpowered.length > 0
      ? echo2.echoAtEmpowered.reduce((s, e) => s + e.activeEchos, 0) / echo2.echoAtEmpowered.length
      : 0;

    lines.push(`**${player1.name}:** avg ${avgEchos1.toFixed(1)} Echos active at empowered casts (${echo1.echoAtEmpowered.length} casts)`);
    lines.push(`**${player2.name}:** avg ${avgEchos2.toFixed(1)} Echos active at empowered casts (${echo2.echoAtEmpowered.length} casts)`);
    lines.push("");

    // Echo ramp windows comparison
    lines.push("## Echo Ramp Patterns");
    lines.push("");
    const avgRamp1 = echo1.echoWindows.length > 0
      ? echo1.echoWindows.reduce((s, w) => s + w.echosApplied, 0) / echo1.echoWindows.length
      : 0;
    const avgRamp2 = echo2.echoWindows.length > 0
      ? echo2.echoWindows.reduce((s, w) => s + w.echosApplied, 0) / echo2.echoWindows.length
      : 0;

    lines.push(`**${player1.name}:** ${echo1.echoWindows.length} ramp windows, avg ${avgRamp1.toFixed(1)} Echos per window`);
    lines.push(`**${player2.name}:** ${echo2.echoWindows.length} ramp windows, avg ${avgRamp2.toFixed(1)} Echos per window`);
    lines.push("");

    // EB consumption comparison
    lines.push("## Essence Burst Usage");
    lines.push("");
    lines.push(`**${player1.name} consumed by:** ${Object.entries(eb1.consumedBy).map(([k, v]) => `${k}(${v})`).join(", ")}`);
    lines.push(`**${player2.name} consumed by:** ${Object.entries(eb2.consumedBy).map(([k, v]) => `${k}(${v})`).join(", ")}`);
    lines.push("");

    // Full individual analyses
    lines.push("---");
    lines.push(`# ${player1.name} — Full Analysis`);
    lines.push("");
    lines.push(formatEchoAnalysis(echo1, player1.startTime));
    lines.push("");
    lines.push(formatEssenceBurstAnalysis(eb1, player1.startTime));
    lines.push("");
    lines.push(formatCastEfficiency(cast1, player1.startTime));
    lines.push("");

    lines.push("---");
    lines.push(`# ${player2.name} — Full Analysis`);
    lines.push("");
    lines.push(formatEchoAnalysis(echo2, player2.startTime));
    lines.push("");
    lines.push(formatEssenceBurstAnalysis(eb2, player2.startTime));
    lines.push("");
    lines.push(formatCastEfficiency(cast2, player2.startTime));

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  });

  server.registerTool("get-essence-timeline", {
    title: "Get Essence Timeline",
    description:
      "Returns a structured timeline dataset of Evoker Essence (resource type 19) over the course of a fight. " +
      "Each data point includes: essence amount, Essence Burst buff state/stacks, spell cast, cost, " +
      "whether the cast was free (EB), and overcap status. " +
      "Designed to be fed into a charting library (D3, Recharts, etc.). " +
      "Also returns a summary with total essence wasted, time at max, EB uptime, etc.",
    inputSchema: {
      code: z.string().describe("Report code"),
      fightID: z.number().describe("Fight ID"),
      startTime: z.number().describe("Fight start time (ms)"),
      endTime: z.number().describe("Fight end time (ms)"),
      sourceID: z.number().describe("Player's actor ID"),
      playerName: z.string().describe("Player name (for labeling)"),
    },
    annotations: { readOnlyHint: true },
  }, async ({ code, fightID, startTime, endTime, sourceID, playerName }) => {
    const result = await buildEssenceTimeline(
      wcl, code, fightID, startTime, endTime, sourceID, playerName
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  });
}
