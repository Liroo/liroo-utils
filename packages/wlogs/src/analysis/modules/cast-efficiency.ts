import type { FightEvents } from "../event-fetcher.js";
import { SPELLS, spellName, HEALING_GCDS } from "../../constants/spells.js";

export interface CastEfficiencyAnalysis {
  totalCasts: number;
  castsPerMinute: number;
  healingGCDs: number;
  damageGCDs: number;
  utilityGCDs: number;
  // Downtime: gaps between casts > 1.5s (GCD)
  totalDowntimeMs: number;
  downtimePercent: number;
  longestGap: { startTime: number; durationMs: number };
  gaps: Array<{ startTime: number; durationMs: number }>;
  // Per-spell breakdown
  spellBreakdown: Array<{
    spell: string;
    spellId: number;
    casts: number;
    castsPerMinute: number;
    category: "healing" | "damage" | "utility" | "movement";
  }>;
  // Fire Breath vs Echo ratio
  fireDamageGCDs: number;
  echoGCDs: number;
  fireToEchoRatio: number;
}

const DAMAGE_SPELLS = new Set<number>([
  SPELLS.FIRE_BREATH,
  SPELLS.DISINTEGRATE,
  SPELLS.CHRONO_FLAMES,
]);

const UTILITY_SPELLS = new Set<number>([
  SPELLS.OBSIDIAN_SCALES,
  SPELLS.RESCUE,
  SPELLS.NATURALIZE,
  SPELLS.TIME_DILATION,
  SPELLS.TIP_THE_SCALES,
  SPELLS.ZEPHYR,
  SPELLS.TIME_SPIRAL,
]);

const MOVEMENT_SPELLS = new Set<number>([SPELLS.HOVER, SPELLS.GLIDE]);

export function analyzeCastEfficiency(
  events: FightEvents,
  fightDurationMs: number
): CastEfficiencyAnalysis {
  const { casts } = events;

  // Only count actual GCD-using casts (cast + empowerend, not begincast/empowerstart)
  const gcdCasts = casts.filter(
    (e) => e.type === "cast" || e.type === "empowerend"
  );

  let healingGCDs = 0;
  let damageGCDs = 0;
  let utilityGCDs = 0;
  let movementGCDs = 0;

  const spellCounts = new Map<number, number>();

  for (const cast of gcdCasts) {
    const id = cast.abilityGameID;
    spellCounts.set(id, (spellCounts.get(id) || 0) + 1);

    if (HEALING_GCDS.has(id) || id === SPELLS.DREAM_FLIGHT || id === SPELLS.REWIND) {
      healingGCDs++;
    } else if (DAMAGE_SPELLS.has(id)) {
      damageGCDs++;
    } else if (UTILITY_SPELLS.has(id)) {
      utilityGCDs++;
    } else if (MOVEMENT_SPELLS.has(id)) {
      movementGCDs++;
    }
  }

  // Downtime analysis
  const sortedCasts = [...gcdCasts].sort((a, b) => a.timestamp - b.timestamp);
  const GCD_THRESHOLD = 2000; // 2s - generous GCD accounting for haste
  const gaps: Array<{ startTime: number; durationMs: number }> = [];
  let totalDowntime = 0;

  for (let i = 1; i < sortedCasts.length; i++) {
    const gap = sortedCasts[i].timestamp - sortedCasts[i - 1].timestamp;
    if (gap > GCD_THRESHOLD) {
      const gapInfo = {
        startTime: sortedCasts[i - 1].timestamp,
        durationMs: gap,
      };
      gaps.push(gapInfo);
      totalDowntime += gap - GCD_THRESHOLD; // Excess beyond 1 GCD
    }
  }

  const longestGap = gaps.reduce(
    (max, g) => (g.durationMs > max.durationMs ? g : max),
    { startTime: 0, durationMs: 0 }
  );

  // Per-spell breakdown
  const spellBreakdown = Array.from(spellCounts.entries())
    .map(([id, count]) => {
      let category: "healing" | "damage" | "utility" | "movement" = "utility";
      if (HEALING_GCDS.has(id) || id === SPELLS.DREAM_FLIGHT || id === SPELLS.REWIND) {
        category = "healing";
      } else if (DAMAGE_SPELLS.has(id)) {
        category = "damage";
      } else if (MOVEMENT_SPELLS.has(id)) {
        category = "movement";
      }

      return {
        spell: spellName(id),
        spellId: id,
        casts: count,
        castsPerMinute: count / (fightDurationMs / 60000),
        category,
      };
    })
    .sort((a, b) => b.casts - a.casts);

  const fireCasts = spellCounts.get(SPELLS.FIRE_BREATH) || 0;
  const echoCasts = spellCounts.get(SPELLS.ECHO) || 0;

  return {
    totalCasts: gcdCasts.length,
    castsPerMinute: gcdCasts.length / (fightDurationMs / 60000),
    healingGCDs,
    damageGCDs,
    utilityGCDs: utilityGCDs + movementGCDs,
    totalDowntimeMs: totalDowntime,
    downtimePercent: (totalDowntime / fightDurationMs) * 100,
    longestGap,
    gaps: gaps.filter((g) => g.durationMs > 3000), // Only show significant gaps
    spellBreakdown,
    fireDamageGCDs: fireCasts,
    echoGCDs: echoCasts,
    fireToEchoRatio: echoCasts > 0 ? fireCasts / echoCasts : Infinity,
  };
}

export function formatCastEfficiency(
  analysis: CastEfficiencyAnalysis,
  fightStart: number
): string {
  const lines: string[] = [];

  lines.push("## Cast Efficiency (Always Be Casting)");
  lines.push("");
  lines.push(`- **Total GCD casts:** ${analysis.totalCasts}`);
  lines.push(`- **CPM:** ${analysis.castsPerMinute.toFixed(1)}`);
  lines.push(
    `- **GCD split:** ${analysis.healingGCDs} healing / ${analysis.damageGCDs} damage / ${analysis.utilityGCDs} utility`
  );
  lines.push(
    `- **Downtime:** ${(analysis.totalDowntimeMs / 1000).toFixed(1)}s (${analysis.downtimePercent.toFixed(1)}%)`
  );
  lines.push(
    `- **Fire Breath vs Echo:** ${analysis.fireDamageGCDs} FB / ${analysis.echoGCDs} Echo (ratio: ${analysis.fireToEchoRatio.toFixed(2)})`
  );
  lines.push("");

  lines.push("### Spell Breakdown");
  for (const s of analysis.spellBreakdown) {
    lines.push(
      `  - ${s.spell}: ${s.casts} casts (${s.castsPerMinute.toFixed(1)} CPM) [${s.category}]`
    );
  }

  if (analysis.gaps.length > 0) {
    lines.push("");
    lines.push("### Significant Gaps (>3s)");
    for (const g of analysis.gaps.slice(0, 10)) {
      const relTime = ((g.startTime - fightStart) / 1000).toFixed(1);
      lines.push(`  - ${relTime}s: ${(g.durationMs / 1000).toFixed(1)}s gap`);
    }
  }

  return lines.join("\n");
}
