import { SPELLS, spellName, ECHO_CONSUMERS } from "../../constants/spells.js";
export function analyzeEcho(events, fightDurationMs) {
    const { casts, buffs } = events;
    // Track Echo casts
    const echoCasts = casts.filter((e) => e.abilityGameID === SPELLS.ECHO && e.type === "cast");
    // Track Echo buff applications and removals
    const echoApply = buffs.filter((e) => e.abilityGameID === SPELLS.ECHO && e.type === "applybuff");
    const echoRemove = buffs.filter((e) => e.abilityGameID === SPELLS.ECHO && e.type === "removebuff");
    // Track TA casts (TA applies echoes automatically)
    const taCasts = casts.filter((e) => e.abilityGameID === SPELLS.TEMPORAL_ANOMALY && e.type === "cast");
    // Track active echos over time for snapshots
    // An echo is "active" between applybuff and removebuff on a target
    const activeEchos = new Map(); // targetID -> timestamp applied
    // Track what consumes each echo
    const consumptions = {};
    let expired = 0;
    // Build timeline of echo states
    const echoTimeline = [];
    for (const e of echoApply) {
        echoTimeline.push({ timestamp: e.timestamp, targetID: e.targetID, type: "apply" });
    }
    for (const e of echoRemove) {
        echoTimeline.push({ timestamp: e.timestamp, targetID: e.targetID, type: "remove" });
    }
    echoTimeline.sort((a, b) => a.timestamp - b.timestamp);
    // For each echo removal, find what cast happened around that time to that target
    for (const removal of echoRemove) {
        const consumingCast = findConsumingCast(casts, removal.timestamp, removal.targetID);
        if (consumingCast) {
            const name = spellName(consumingCast.abilityGameID);
            consumptions[name] = (consumptions[name] || 0) + 1;
        }
        else {
            expired++;
        }
    }
    // Echo at empowered cast moments
    const empoweredCasts = casts.filter((e) => e.type === "empowerend" &&
        (e.abilityGameID === SPELLS.DREAM_BREATH || e.abilityGameID === SPELLS.SPIRITBLOOM));
    const echoAtEmpowered = empoweredCasts.map((emp) => {
        const activeAtTime = countActiveEchos(echoTimeline, emp.timestamp);
        return {
            timestamp: emp.timestamp,
            spell: spellName(emp.abilityGameID),
            empowerLevel: emp.empowermentLevel ?? 0,
            activeEchos: activeAtTime.count,
            targets: activeAtTime.targets,
        };
    });
    // Echo target distribution
    const targetDist = {};
    for (const e of echoCasts) {
        targetDist[e.targetID] = (targetDist[e.targetID] || 0) + 1;
    }
    // Build echo windows (groups of echo casts before a consumer)
    const echoWindows = buildEchoWindows(casts);
    return {
        totalEchoCasts: echoCasts.length,
        hardcastEchoCasts: echoCasts.length,
        taEchoApplications: taCasts.length, // TA casts, each applies echos to nearby
        echoConsumptions: consumptions,
        echoExpired: expired,
        echoCastsPerMinute: echoCasts.length / (fightDurationMs / 60000),
        echoTargetDistribution: targetDist,
        echoWindows,
        echoAtEmpowered,
    };
}
function findConsumingCast(casts, removalTimestamp, targetID) {
    // Look for a cast within 200ms before the echo removal that targets this player
    // or is an AoE heal (targetID -1)
    const BUFFER = 200;
    for (const cast of casts) {
        if (cast.type === "cast" || cast.type === "empowerend") {
            if (Math.abs(cast.timestamp - removalTimestamp) <= BUFFER &&
                ECHO_CONSUMERS.has(cast.abilityGameID)) {
                return cast;
            }
        }
    }
    return null;
}
function countActiveEchos(timeline, atTimestamp) {
    const active = new Set();
    for (const event of timeline) {
        if (event.timestamp > atTimestamp)
            break;
        if (event.type === "apply") {
            active.add(event.targetID);
        }
        else {
            active.delete(event.targetID);
        }
    }
    return { count: active.size, targets: Array.from(active) };
}
function buildEchoWindows(casts) {
    const windows = [];
    let currentWindow = null;
    for (const cast of casts) {
        if (cast.type !== "cast" && cast.type !== "empowerend")
            continue;
        if (cast.abilityGameID === SPELLS.ECHO) {
            if (!currentWindow) {
                currentWindow = { start: cast.timestamp, count: 0 };
            }
            currentWindow.count++;
        }
        else if (currentWindow && ECHO_CONSUMERS.has(cast.abilityGameID)) {
            windows.push({
                startTime: currentWindow.start,
                endTime: cast.timestamp,
                echosApplied: currentWindow.count,
                consumedBy: spellName(cast.abilityGameID),
            });
            currentWindow = null;
        }
    }
    // Unclosed window
    if (currentWindow) {
        windows.push({
            startTime: currentWindow.start,
            endTime: currentWindow.start,
            echosApplied: currentWindow.count,
            consumedBy: null,
        });
    }
    return windows;
}
export function formatEchoAnalysis(analysis, fightStart) {
    const lines = [];
    lines.push("## Echo Analysis");
    lines.push("");
    lines.push(`- **Total Echo casts:** ${analysis.totalEchoCasts}`);
    lines.push(`- **Echo CPM:** ${analysis.echoCastsPerMinute.toFixed(1)}`);
    lines.push(`- **TA casts (auto-Echo):** ${analysis.taEchoApplications}`);
    lines.push(`- **Echos expired (wasted):** ${analysis.echoExpired}`);
    lines.push("");
    lines.push("### Echo Consumptions (what spell used the Echo)");
    const sorted = Object.entries(analysis.echoConsumptions).sort(([, a], [, b]) => b - a);
    for (const [spell, count] of sorted) {
        lines.push(`  - ${spell}: ${count}`);
    }
    lines.push("");
    lines.push("### Echo Count at Empowered Casts");
    lines.push("(How many Echos were active when you cast Dream Breath / Spiritbloom)");
    for (const snap of analysis.echoAtEmpowered) {
        const relTime = ((snap.timestamp - fightStart) / 1000).toFixed(1);
        lines.push(`  - ${relTime}s: ${snap.spell} (rank ${snap.empowerLevel}) — **${snap.activeEchos} Echos active**`);
    }
    lines.push("");
    lines.push("### Echo Ramp Windows");
    lines.push("(Sequences of Echo casts → consumer spell)");
    for (const w of analysis.echoWindows) {
        const relStart = ((w.startTime - fightStart) / 1000).toFixed(1);
        const consumed = w.consumedBy ?? "none (wasted)";
        lines.push(`  - ${relStart}s: ${w.echosApplied} Echos → ${consumed}`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=echo-analysis.js.map