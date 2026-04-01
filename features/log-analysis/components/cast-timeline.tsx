"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type {
  CastTimelineEvent,
  BuffLane,
  EchoTargetEvent,
  RaidBuffEvent,
  RaidBuffDef,
  HPSnapshot,
  HPSPoint,
  DTPSPoint,
  EchoCountPoint,
  CombatantInfo,
  DamageProfileResult,
  EnemyAbility,
} from "@/lib/wlogs/types/wcl-responses";
import { RaidFrames } from "./raid-frames";

interface Actor {
  id: number;
  name: string;
  server: string;
  subType: string;
}

interface CastTimelineData {
  events: CastTimelineEvent[];
  fightDuration: number;
  abilities: Record<string, { name: string; icon: string }>;
  buffLanes?: BuffLane[];
  echoEvents?: EchoTargetEvent[];
  raidBuffEvents?: RaidBuffEvent[];
  raidBuffDefs?: RaidBuffDef[];
  raidHP?: HPSnapshot[];
  hpsGraph?: HPSPoint[];
  dtpsGraph?: DTPSPoint[];
  echoCountGraph?: EchoCountPoint[];
  combatants?: CombatantInfo[];
}

type ChartType = "essence" | "hps" | "dtps" | "echo-count" | "none";

const CHART_OPTIONS: Array<{ value: ChartType; label: string }> = [
  { value: "none", label: "None" },
  { value: "essence", label: "Essence" },
  { value: "hps", label: "HPS" },
  { value: "dtps", label: "Damage Taken" },
  { value: "echo-count", label: "Echo Count" },
];

const CHART_COLORS: Record<ChartType, { line: string; area: string }> = {
  essence: { line: "#3fb950", area: "rgba(63,185,80,0.06)" },
  hps: { line: "#58a6ff", area: "rgba(88,166,255,0.06)" },
  dtps: { line: "#f85149", area: "rgba(248,81,73,0.06)" },
  "echo-count": { line: "#bc8cff", area: "rgba(188,140,255,0.06)" },
  none: { line: "transparent", area: "transparent" },
};

interface CastTimelineProps {
  data: CastTimelineData;
  actors?: Actor[];
  reportCode?: string;
  fightId?: number;
  sourceId?: number;
  playerName?: string;
  damageProfile?: DamageProfileResult;
  encounterID?: number;
}

// --- Constants ---

const MIN_PX_PER_SEC = 4;
const MAX_PX_PER_SEC = 80;
const DEFAULT_PX_PER_SEC = 12;
const CHART_HEIGHT = 160;
const ICON_SIZE = 24;
const ICON_ROW_HEIGHT = 32;
const WARN_ROW_HEIGHT = 24;
const BUFF_LANE_HEIGHT = 16;
const RULER_HEIGHT = 28;
const Y_AXIS_WIDTH = 28;
const Y_AXIS_RIGHT_WIDTH = 40;
const ESSENCE_MAX = 5;

const BUFF_COLORS: Record<number, { bg: string; text: string }> = {
  369299: { bg: "#d29922", text: "#fff" }, // Essence Burst — amber
  1242759: { bg: "#bc8cff", text: "#fff" }, // Twin Echoes — purple
};
const BOSS_ROW_HEIGHT = 28;
const BOSS_ICON_SIZE = 22;
const ZOOM_SPEED = 0.003;

const SPELL_COLORS: Record<string, string> = {
  Echo: "#bc8cff",
  "Dream Breath": "#f0883e",
  "Emerald Blossom": "#3fb950",
  "Temporal Anomaly": "#56d4dd",
  Rewind: "#f778ba",
  "Dream Flight": "#f778ba",
  "Fire Breath": "#f85149",
  "Merithra's Blessing": "#d2a8ff",
  Reversion: "#7ee787",
  "Verdant Embrace": "#7ee787",
  "Chrono Flames": "#ffa657",
  "Living Flame": "#f85149",
  Disintegrate: "#f85149",
};

// --- Helpers ---

function iconUrl(abilityIcon: string): string {
  return `https://wow.zamimg.com/images/wow/icons/large/${abilityIcon.replace(/\.jpg$/, "")}.jpg`;
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Reversion marker color: green → yellow → orange → red → dark red based on intensity 0..1
const REV_COLORS = ["#3fb950", "#b8cc20", "#e8a016", "#e05030", "#8b0000"] as const;
const REV_STROKES = ["#2ea043", "#9ab015", "#c08010", "#c03020", "#600000"] as const;

function revColor(t: number): string {
  const i = Math.min(Math.floor(t * (REV_COLORS.length - 1)), REV_COLORS.length - 2);
  const f = t * (REV_COLORS.length - 1) - i;
  return lerpColor(REV_COLORS[i], REV_COLORS[i + 1], f);
}

function revStroke(t: number): string {
  const i = Math.min(Math.floor(t * (REV_STROKES.length - 1)), REV_STROKES.length - 2);
  const f = t * (REV_STROKES.length - 1) - i;
  return lerpColor(REV_STROKES[i], REV_STROKES[i + 1], f);
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function fmtDmg(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtSec(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// --- Cast analysis warnings ---

const ESSENCE_BURST_ID = 369299;
const TWIN_ECHOES_ID = 1242759;
const ECHO_ID = 364343;
const EMERALD_BLOSSOM_ID = 355913;
const DREAM_BREATH_ID = 355936;
const TEMPORAL_ANOMALY_ID = 373861;
const REVERSION_ID = 366155;

const STAT_SPELLS = [
  { id: ECHO_ID, name: "Echo", color: "#bc8cff" },
  { id: DREAM_BREATH_ID, name: "Dream Breath", color: "#f0883e" },
  { id: TEMPORAL_ANOMALY_ID, name: "Temporal Anomaly", color: "#56d4dd" },
  { id: EMERALD_BLOSSOM_ID, name: "Emerald Blossom", color: "#3fb950" },
  { id: REVERSION_ID, name: "Reversion", color: "#7ee787" },
];

const MERITHRAS_BLESSING_ID = 1242728;

interface CastWarning {
  cast: CastTimelineEvent;
  level: "error" | "warning" | "info";
  title: string;
  description: string;
}

function warnColor(level: CastWarning["level"]): string {
  if (level === "error") return "#f85149";
  if (level === "info") return "#58a6ff";
  return "#d29922";
}

function warnBg(level: CastWarning["level"]): string {
  if (level === "error") return "#f8514920";
  if (level === "info") return "#58a6ff20";
  return "#d2992220";
}

// Look up buff stacks slightly BEFORE the cast timestamp.
// WCL buff events can land at the same ms as the cast that triggers them,
// so checking at (ts - BUFF_TIMING_MARGIN) gives us the state before the cast.
const BUFF_TIMING_MARGIN = 50; // ms

function getBuffStacks(buffLanes: BuffLane[], buffId: number, timestamp: number): number {
  const lane = buffLanes.find((l) => l.abilityGameID === buffId);
  if (!lane) return 0;
  const t = timestamp - BUFF_TIMING_MARGIN;
  const span = lane.spans.find((s) => s.startTime <= t && s.endTime >= t);
  return span?.stacks ?? 0;
}

function analyzeCasts(casts: CastTimelineEvent[], buffLanes: BuffLane[], dtpsData: DTPSPoint[]): CastWarning[] {
  const warnings: CastWarning[] = [];

  // Pre-compute: find DTPS at a given timestamp (nearest point)
  const getDtpsAt = (ms: number): number => {
    let best = 0;
    let bestDist = Infinity;
    for (const d of dtpsData) {
      const dist = Math.abs(d.timestamp - ms);
      if (dist < bestDist) { bestDist = dist; best = d.dtps; }
      if (d.timestamp > ms + 1000) break;
    }
    return best;
  };

  // Find peak DTPS in a time window
  const getPeakDtpsInWindow = (startMs: number, endMs: number): { dtps: number; timestamp: number } => {
    let best = { dtps: 0, timestamp: startMs };
    for (const d of dtpsData) {
      if (d.timestamp < startMs) continue;
      if (d.timestamp > endMs) break;
      if (d.dtps > best.dtps) best = { dtps: d.dtps, timestamp: d.timestamp };
    }
    return best;
  };

  const dtpsMax = dtpsData.length > 0 ? Math.max(...dtpsData.map((d) => d.dtps), 1) : 1;

  for (const cast of casts) {
    const ts = cast.timestamp;
    const ebStacks = getBuffStacks(buffLanes, ESSENCE_BURST_ID, ts);
    const teStacks = getBuffStacks(buffLanes, TWIN_ECHOES_ID, ts);

    if (cast.abilityGameID === EMERALD_BLOSSOM_ID && teStacks >= 2) {
      warnings.push({
        cast,
        level: "error",
        title: "Emerald Blossom with Twin Echoes capped",
        description: "Twin Echoes is at 2 stacks (max). Casting Emerald Blossom here wastes a Twin Echoes proc. Use Echo first to consume a stack, then Emerald Blossom.",
      });
    } else if (cast.abilityGameID === EMERALD_BLOSSOM_ID && ebStacks === 0) {
      warnings.push({
        cast,
        level: "error",
        title: "Emerald Blossom without Essence Burst",
        description: "Emerald Blossom costs 3 Essence without Essence Burst. You should only cast it when Essence Burst is active to make it free.",
      });
    }

    if (cast.abilityGameID === ECHO_ID && ebStacks > 0 && teStacks === 1) {
      warnings.push({
        cast,
        level: "warning",
        title: "Echo with Essence Burst (only 1 Twin Echoes)",
        description: "You have Essence Burst active but only 1 Twin Echoes stack. Consider using Emerald Blossom (free with Essence Burst) to get more value before spending Echo here.",
      });
    }

    // Reversion/Merithra's Blessing mistimed: big damage spike comes 5-10s AFTER the cast
    // meaning the player cast too early and won't benefit from the 5s lookback window
    if ((cast.abilityGameID === REVERSION_ID || cast.abilityGameID === MERITHRAS_BLESSING_ID) && dtpsData.length > 0) {
      const dtpsAtCast = getDtpsAt(ts);
      const futurePeak = getPeakDtpsInWindow(ts + 5000, ts + 10000);
      // Warn if future peak is notably higher than damage at cast time (>1.5x and >40% of max)
      if (futurePeak.dtps > dtpsAtCast * 1.5 && futurePeak.dtps > dtpsMax * 0.4) {
        const spellName = cast.abilityGameID === REVERSION_ID ? "Reversion" : "Merithra's Blessing";
        warnings.push({
          cast,
          level: "info",
          title: `${spellName} cast too early`,
          description: `Damage spike at ${fmtTime(futurePeak.timestamp)} (${fmtDmg(futurePeak.dtps * 5)} over 5s) hits ${((futurePeak.timestamp - ts) / 1000).toFixed(0)}s after this cast. Delaying would capture more damage in the 5s healing window.`,
        });
      }
    }

    // Essence Burst wasted: buff refreshed at max stacks means a proc was lost
    // Detect by checking if EB is already at max (2) when a spell that generates EB is cast
    // (Dream Breath, Fire Breath, Living Flame damage)
  }

  // Essence overcap: 5/5 for > 2s without spending
  const essenceCasts = casts.filter((c) => c.essenceCost && c.essenceCost > 0 && c.essenceMax === 5);
  for (let i = 0; i < essenceCasts.length - 1; i++) {
    const cur = essenceCasts[i];
    const next = essenceCasts[i + 1];
    const afterEssence = (cur.essence ?? 5) - (cur.essenceCost ?? 0);
    if (afterEssence >= 5) continue; // can't overcap if we just spent
    // Check if essence reached 5 and stayed there > 2s before next spend
    if (next.essence === 5 && (next.timestamp - cur.timestamp) > 4000) {
      warnings.push({
        cast: next,
        level: "warning",
        title: "Essence overcapped (5/5)",
        description: `${((next.timestamp - cur.timestamp) / 1000).toFixed(1)}s at max Essence before this cast. Spend Essence sooner to avoid wasting regeneration.`,
      });
    }
  }

  return warnings;
}

// --- Boss ability filtering ---

const MIN_BOSS_DAMAGE_PCT = 0.005; // 0.5% of total raid damage

function getAllBossAbilities(profile: DamageProfileResult): EnemyAbility[] {
  // Collect abilities from all enemies, deduplicate by name, filter junk
  const seen = new Set<string>();
  const allAbilities: EnemyAbility[] = [];
  for (const enemy of profile.enemies) {
    for (const ability of enemy.abilities) {
      if (seen.has(ability.name)) continue;
      seen.add(ability.name);
      if (ability.name.startsWith("Unknown(")) continue;
      if (ability.abilityGameID === 1) continue; // Melee
      if (ability.hitCount <= 1) continue;
      if (profile.totalRaidDamage > 0 && ability.totalDamage / profile.totalRaidDamage < MIN_BOSS_DAMAGE_PCT) continue;
      allAbilities.push(ability);
    }
  }
  return allAbilities.sort((a, b) => b.totalDamage - a.totalDamage);
}

// --- Boss timer colors ---

const BOSS_SPELL_COLORS = [
  "#9b59b6", // purple
  "#e74c3c", // red
  "#3498db", // blue
  "#e67e22", // orange
  "#1abc9c", // teal
  "#f1c40f", // yellow
  "#e91e63", // pink
  "#2ecc71", // green
  "#00bcd4", // cyan
  "#ff5722", // deep orange
];

// --- Essence ---

interface EP { time: number; essence: number }

function buildEssence(casts: CastTimelineEvent[], durMs: number): EP[] {
  const ec = casts.filter((c) => c.essenceCost && c.essenceCost > 0 && c.essenceMax === 5);
  if (!ec.length) return [];
  const pts: EP[] = [];

  for (let i = 0; i < ec.length; i++) {
    const c = ec[i];
    const t = c.timestamp / 1000;
    const before = c.essence ?? 5;
    const cost = c.essenceCost ?? 0;
    const after = before - cost;
    pts.push({ time: t, essence: before }, { time: t + 0.01, essence: Math.max(0, after) });

    if (i < ec.length - 1) {
      const nx = ec[i + 1];
      const nxt = nx.timestamp / 1000;
      const regen = (nx.essence ?? 5) - after;
      const gap = nxt - t;
      if (regen > 0 && gap > 0) {
        const step = gap / (regen + 1);
        let ce = after;
        for (let r = 0; r < regen; r++) {
          ce++;
          if (ce > 5) break;
          pts.push({ time: t + step * (r + 1), essence: ce });
        }
      }
    }
  }

  if (ec[0].timestamp / 1000 > 0) pts.unshift({ time: 0, essence: 5 });
  pts.push({ time: durMs / 1000, essence: 5 });
  pts.sort((a, b) => a.time - b.time);
  return pts;
}

function eY(e: number): number {
  return CHART_HEIGHT - (e / ESSENCE_MAX) * CHART_HEIGHT;
}

function stepPath(pts: EP[], toX: (t: number) => number): string {
  if (!pts.length) return "";
  let d = `M ${toX(pts[0].time)} ${eY(pts[0].essence)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` H ${toX(pts[i].time)} V ${eY(pts[i].essence)}`;
  }
  return d;
}

function areaPath(pts: EP[], toX: (t: number) => number, w: number): string {
  if (!pts.length) return "";
  let d = `M ${toX(pts[0].time)} ${CHART_HEIGHT} V ${eY(pts[0].essence)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` H ${toX(pts[i].time)} V ${eY(pts[i].essence)}`;
  }
  d += ` H ${w} V ${CHART_HEIGHT} Z`;
  return d;
}

// --- Component ---

export function CastTimeline({ data, actors, reportCode, fightId, sourceId, playerName, damageProfile, encounterID }: CastTimelineProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Virtual viewport: viewStartS = left edge time, pxPerSec = zoom
  const [pps, setPps] = useState(DEFAULT_PX_PER_SEC);
  const [viewStartS, setViewStartS] = useState(0);
  const [mouseClientX, setMouseClientX] = useState<number | null>(null);
  const [hoveredCast, setHoveredCast] = useState<CastTimelineEvent | null>(null);
  const [hoveredRevPeak, setHoveredRevPeak] = useState<{ timestamp: number; dtps: number; total5s: number; isPrimary: boolean } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [leftChart, setLeftChart] = useState<ChartType>("dtps");
  const [rightChart, setRightChart] = useState<ChartType>("echo-count");
  const [bossTimersOpen, setBossTimersOpen] = useState(false);
  const [hiddenBossSpells, setHiddenBossSpells] = useState<Set<string>>(() => {
    if (!encounterID) return new Set();
    try {
      const stored = localStorage.getItem(`hidden-boss-spells-${encounterID}`);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const [bossFilterOpen, setBossFilterOpen] = useState(false);
  const bossFilterRef = useRef<HTMLDivElement>(null);

  // Persist hidden boss spells per encounter
  useEffect(() => {
    if (!encounterID) return;
    localStorage.setItem(`hidden-boss-spells-${encounterID}`, JSON.stringify([...hiddenBossSpells]));
  }, [hiddenBossSpells, encounterID]);

  // Reload hidden boss spells when encounter changes
  useEffect(() => {
    if (!encounterID) return;
    try {
      const stored = localStorage.getItem(`hidden-boss-spells-${encounterID}`);
      setHiddenBossSpells(stored ? new Set(JSON.parse(stored) as string[]) : new Set());
    } catch { setHiddenBossSpells(new Set()); }
  }, [encounterID]);

  // Close boss filter dropdown on outside click
  useEffect(() => {
    if (!bossFilterOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bossFilterRef.current && !bossFilterRef.current.contains(e.target as Node)) {
        setBossFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [bossFilterOpen]);
  const [hiddenSpells, setHiddenSpells] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("hidden-spells");
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist hidden spells to localStorage
  useEffect(() => {
    localStorage.setItem("hidden-spells", JSON.stringify([...hiddenSpells]));
  }, [hiddenSpells]);

  const [hiddenWarningTypes, setHiddenWarningTypes] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("hidden-warning-types");
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem("hidden-warning-types", JSON.stringify([...hiddenWarningTypes]));
  }, [hiddenWarningTypes]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filterOpen]);

  // Refs for synchronous wheel handler access
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const viewStartRef = useRef(viewStartS);
  viewStartRef.current = viewStartS;

  // Lerp targets + animation
  const targetStartRef = useRef(viewStartS);
  const targetPpsRef = useRef(pps);
  const rafRef = useRef<number>(0);

  const startLerp = useCallback(() => {
    if (rafRef.current) return; // already running
    const step = () => {
      const LERP = 0.3;
      const curS = viewStartRef.current;
      const curP = ppsRef.current;
      const tS = targetStartRef.current;
      const tP = targetPpsRef.current;
      const dS = tS - curS;
      const dP = tP - curP;

      if (Math.abs(dS) < 0.01 && Math.abs(dP) < 0.05) {
        viewStartRef.current = tS;
        ppsRef.current = tP;
        setViewStartS(tS);
        setPps(tP);
        rafRef.current = 0;
        return;
      }

      const nS = curS + dS * LERP;
      const nP = curP + dP * LERP;
      viewStartRef.current = nS;
      ppsRef.current = nP;
      setViewStartS(nS);
      setPps(nP);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const allCasts = data.events.filter(
    (e) => (e.type === "cast" || e.type === "empowerend") && !e.abilityName.startsWith("Unknown(")
  );

  // Unique spells for filter
  const uniqueSpells = (() => {
    const seen = new Map<number, { name: string; icon: string; count: number }>();
    for (const c of allCasts) {
      const existing = seen.get(c.abilityGameID);
      if (existing) {
        existing.count++;
      } else {
        seen.set(c.abilityGameID, { name: c.abilityName, icon: c.abilityIcon ?? "", count: 1 });
      }
    }
    return [...seen.entries()]
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count);
  })();

  const toggleSpell = (id: number) => {
    setHiddenSpells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const casts = allCasts;
  const visibleFilteredCasts = hiddenSpells.size > 0
    ? allCasts.filter((c) => !hiddenSpells.has(c.abilityGameID))
    : allCasts;

  const buffLanes = data.buffLanes ?? [];

  const durationS = data.fightDuration / 1000;
  const essencePts = buildEssence(casts, data.fightDuration);

  // Chart data
  const hpsData = data.hpsGraph ?? [];
  const hpsMax = hpsData.length > 0 ? Math.max(...hpsData.map((p) => p.hps), 1) : 1;
  const dtpsData = data.dtpsGraph ?? [];
  const dtpsMax = dtpsData.length > 0 ? Math.max(...dtpsData.map((p) => p.dtps), 1) : 1;

  const castWarnings = analyzeCasts(casts, buffLanes, dtpsData);
  const warningByCastTs = new Map(castWarnings.map((w) => [`${w.cast.timestamp}-${w.cast.abilityGameID}`, w]));
  const hasWarnings = castWarnings.length > 0;

  // Optimal Reversion/Merithra's Blessing moments
  // Find local DTPS peaks + ensure at least one marker every 20s (best moment in each window)
  type RevPeak = { timestamp: number; dtps: number; total5s: number; isPrimary: boolean };
  const reversionPeaks = (() => {
    if (dtpsData.length < 3) return [] as RevPeak[];
    const threshold = dtpsMax * 0.4;

    // Step 1: find real local maxima above threshold
    const rawPeaks: RevPeak[] = [];
    for (let i = 1; i < dtpsData.length - 1; i++) {
      const cur = dtpsData[i].dtps;
      if (cur > dtpsData[i - 1].dtps && cur >= dtpsData[i + 1].dtps && cur >= threshold) {
        rawPeaks.push({ timestamp: dtpsData[i].timestamp, dtps: cur, total5s: cur * 5, isPrimary: true });
      }
    }
    // Deduplicate: keep only peaks at least 5s apart
    const peaks: RevPeak[] = [];
    for (const p of rawPeaks) {
      if (peaks.length === 0 || p.timestamp - peaks[peaks.length - 1].timestamp >= 5000) {
        peaks.push(p);
      } else if (p.dtps > peaks[peaks.length - 1].dtps) {
        peaks[peaks.length - 1] = p;
      }
    }

    // Step 2: fill gaps — ensure at least one marker every 20s
    const MAX_GAP = 30_000;
    const filled: RevPeak[] = [];
    let lastTs = 0;

    for (const peak of peaks) {
      // Fill any gap before this peak
      while (peak.timestamp - lastTs > MAX_GAP) {
        const windowStart = lastTs;
        const windowEnd = Math.min(lastTs + MAX_GAP, peak.timestamp - 5000);
        // Find best DTPS point in this gap
        let best: RevPeak | null = null;
        for (const d of dtpsData) {
          if (d.timestamp <= windowStart || d.timestamp > windowEnd) continue;
          if (!best || d.dtps > best.dtps) {
            best = { timestamp: d.timestamp, dtps: d.dtps, total5s: d.dtps * 5, isPrimary: false };
          }
        }
        if (best) {
          filled.push(best);
          lastTs = best.timestamp;
        } else {
          lastTs = windowEnd;
        }
      }
      filled.push(peak);
      lastTs = peak.timestamp;
    }
    // Fill after last peak until end of fight
    const fightEnd = data.fightDuration;
    while (fightEnd - lastTs > MAX_GAP) {
      const windowStart = lastTs;
      const windowEnd = Math.min(lastTs + MAX_GAP, fightEnd);
      let best: RevPeak | null = null;
      for (const d of dtpsData) {
        if (d.timestamp <= windowStart || d.timestamp > windowEnd) continue;
        if (!best || d.dtps > best.dtps) {
          best = { timestamp: d.timestamp, dtps: d.dtps, total5s: d.dtps * 5, isPrimary: false };
        }
      }
      if (best) {
        filled.push(best);
        lastTs = best.timestamp;
      } else {
        break;
      }
    }

    return filled;
  })();

  // Build echo count from raidBuffEvents, filtering to actual players only
  const echoCountData = (() => {
    const playerIds = new Set(actors?.filter((a) => a.subType !== "Unknown").map((a) => a.id) ?? []);
    const echoBuffs = (data.raidBuffEvents ?? []).filter(
      (e) => e.buffId === 364343 && playerIds.has(e.targetID)
    );
    const points: Array<{ timestamp: number; count: number }> = [];
    const active = new Set<number>();
    let lastCount = 0;
    for (const e of echoBuffs) {
      if (e.type === "apply") active.add(e.targetID);
      else active.delete(e.targetID);
      if (active.size !== lastCount) {
        points.push({ timestamp: e.timestamp, count: active.size });
        lastCount = active.size;
      }
    }
    if (points.length === 0 || points[0].timestamp > 0) {
      points.unshift({ timestamp: 0, count: 0 });
    }
    points.push({ timestamp: data.fightDuration, count: 0 });
    return points;
  })();
  const echoCountMax = echoCountData.length > 0 ? Math.max(...echoCountData.map((p) => p.count), 1) : 1;

  // Generic chart helpers
  function getChartPoints(type: ChartType): Array<{ timeS: number; value: number }> {
    switch (type) {
      case "essence": return essencePts.map((p) => ({ timeS: p.time, value: p.essence }));
      case "hps": return hpsData.map((p) => ({ timeS: p.timestamp / 1000, value: p.hps }));
      case "dtps": return dtpsData.map((p) => ({ timeS: p.timestamp / 1000, value: p.dtps }));
      case "echo-count": return echoCountData.map((p) => ({ timeS: p.timestamp / 1000, value: p.count }));
      default: return [];
    }
  }

  function getChartMax(type: ChartType): number {
    switch (type) {
      case "essence": return ESSENCE_MAX;
      case "hps": return hpsMax;
      case "dtps": return dtpsMax;
      case "echo-count": return echoCountMax;
      default: return 1;
    }
  }

  function chartValueToY(value: number, max: number): number {
    return CHART_HEIGHT - (value / max) * CHART_HEIGHT;
  }

  function formatYLabel(value: number, type: ChartType): string {
    if (type === "essence" || type === "echo-count") return String(Math.round(value));
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(Math.round(value));
  }

  function buildChartSVGPath(
    type: ChartType,
    toXFn: (t: number) => number,
    max: number,
    vStartS: number,
    vEndS: number,
  ): { lineD: string; areaD: string } | null {
    const pts = getChartPoints(type);
    const margin = 5;
    const visible = pts.filter((p) => p.timeS >= vStartS - margin && p.timeS <= vEndS + margin);
    if (visible.length < 2) return null;

    const toY = (v: number) => chartValueToY(v, max);
    const isStep = type === "essence" || type === "echo-count";

    if (isStep) {
      // Add boundary points
      const firstBefore = pts.findLast((p) => p.timeS < vStartS - margin);
      const lastAfter = pts.find((p) => p.timeS > vEndS + margin);
      const clipped = [
        ...(firstBefore ? [firstBefore] : []),
        ...visible,
        ...(lastAfter ? [lastAfter] : []),
      ];
      if (clipped.length < 1) return null;
      let lineD = `M ${toXFn(clipped[0].timeS)} ${toY(clipped[0].value)}`;
      for (let i = 1; i < clipped.length; i++) {
        lineD += ` H ${toXFn(clipped[i].timeS)} V ${toY(clipped[i].value)}`;
      }
      let areaD = `M ${toXFn(clipped[0].timeS)} ${CHART_HEIGHT} V ${toY(clipped[0].value)}`;
      for (let i = 1; i < clipped.length; i++) {
        areaD += ` H ${toXFn(clipped[i].timeS)} V ${toY(clipped[i].value)}`;
      }
      areaD += ` H ${toXFn(clipped[clipped.length - 1].timeS)} V ${CHART_HEIGHT} Z`;
      return { lineD, areaD };
    }

    // Line chart (HPS, DTPS)
    const coords = visible.map((p) => `${toXFn(p.timeS)},${toY(p.value)}`);
    const lineD = `M ${coords.join(" L ")}`;
    const areaD = `M ${toXFn(visible[0].timeS)},${CHART_HEIGHT} L ${coords.join(" L ")} L ${toXFn(visible[visible.length - 1].timeS)},${CHART_HEIGHT} Z`;
    return { lineD, areaD };
  }

  const hasRightChart = rightChart !== "none";

  // Collect all actor IDs that appear in this fight's events
  const fightActorIds = (() => {
    const ids = new Set<number>();
    for (const e of data.events) {
      if (e.targetID > 0) ids.add(e.targetID);
    }
    for (const e of data.echoEvents ?? []) {
      ids.add(e.targetID);
    }
    // Add the source player (they cast spells on themselves too)
    if (casts.length > 0) {
      // sourceID is implicit — it's the player whose casts these are
      // They show up as targetID on self-casts
    }
    return ids;
  })();
  // Refresh Wowhead tooltips when boss timers load/toggle
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$WowheadPower?.refreshLinks?.();
  }, [damageProfile, bossTimersOpen]);

  const buffLanesHeight = buffLanes.length * BUFF_LANE_HEIGHT;
  const allBossAbilities = damageProfile ? getAllBossAbilities(damageProfile) : [];
  const bossAbilities = allBossAbilities.filter((a) => !hiddenBossSpells.has(a.name));
  const hasBossTimers = allBossAbilities.length > 0;
  const BOSS_HEADER_HEIGHT = hasBossTimers ? 24 : 0;
  const bossTimersHeight = hasBossTimers
    ? BOSS_HEADER_HEIGHT + (bossTimersOpen ? bossAbilities.length * BOSS_ROW_HEIGHT : 0)
    : 0;
  const warnRowH = hasWarnings ? WARN_ROW_HEIGHT : 0;
  const totalH = warnRowH + ICON_ROW_HEIGHT + buffLanesHeight + bossTimersHeight + CHART_HEIGHT + RULER_HEIGHT;

  // View width in seconds
  const getViewWidthS = () => {
    if (!viewRef.current) return durationS;
    return viewRef.current.clientWidth / pps;
  };

  // Clamp viewStart
  const clampStart = (s: number, currentPps: number) => {
    if (!viewRef.current) return Math.max(0, s);
    const maxStart = durationS - viewRef.current.clientWidth / currentPps;
    return Math.max(0, Math.min(s, maxStart));
  };

  // Convert time to pixel X in viewport
  const toX = (timeS: number) => (timeS - viewStartS) * pps;

  // Mouse time
  const mouseTimeS =
    mouseClientX !== null && viewRef.current
      ? viewStartS + (mouseClientX - viewRef.current.getBoundingClientRect().left) / pps
      : null;

  // Mouse X in viewport pixels
  const mouseViewX =
    mouseClientX !== null && viewRef.current
      ? mouseClientX - viewRef.current.getBoundingClientRect().left
      : null;

  // Wheel: zoom + pan with direction lock
  const scrollDirRef = useRef<"h" | "v" | null>(null);
  const scrollDirTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Direction lock: first significant axis wins, resets after 150ms idle
      if (scrollDirRef.current === null) {
        if (Math.abs(e.deltaX) > 2 || Math.abs(e.deltaY) > 2) {
          scrollDirRef.current = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? "h" : "v";
        }
      }
      clearTimeout(scrollDirTimer.current);
      scrollDirTimer.current = setTimeout(() => { scrollDirRef.current = null; }, 150);

      const curPps = ppsRef.current;
      const curStart = viewStartRef.current;
      const rect = el.getBoundingClientRect();
      const mouseXInView = e.clientX - rect.left;
      const mouseTime = curStart + mouseXInView / curPps;

      const tStart = targetStartRef.current;
      const tPps = targetPpsRef.current;

      // Horizontal pan only
      if (scrollDirRef.current === "h") {
        targetStartRef.current = clampStart(tStart + e.deltaX / tPps, tPps);
        startLerp();
        return;
      }

      // Vertical = zoom centered on mouse
      const factor = 1 - e.deltaY * ZOOM_SPEED;
      const newPps = Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, tPps * factor));
      const newStart = clampStart(mouseTime - mouseXInView / newPps, newPps);

      targetPpsRef.current = newPps;
      targetStartRef.current = newStart;
      startLerp();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationS]);

  // Drag to pan
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartViewS = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left click, ignore if clicking on interactive elements
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartViewS.current = viewStartRef.current;
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setMouseClientX(e.clientX);
    if (isDragging.current) {
      const dx = e.clientX - dragStartX.current;
      const dS = dx / ppsRef.current;
      const newStart = clampStart(dragStartViewS.current - dS, ppsRef.current);
      targetStartRef.current = newStart;
      startLerp();
    }
  }, [startLerp]);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const onMouseLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Global mouseup to catch drag release outside viewport
  useEffect(() => {
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  // Tick intervals based on zoom
  const viewWidthS = getViewWidthS();
  const tickInterval =
    viewWidthS > 600 ? 60 : viewWidthS > 300 ? 30 : viewWidthS > 120 ? 15 : viewWidthS > 60 ? 10 : viewWidthS > 20 ? 5 : 2;

  const ticks: number[] = [];
  const firstTick = Math.ceil(viewStartS / tickInterval) * tickInterval;
  for (let t = firstTick; t <= viewStartS + viewWidthS + tickInterval; t += tickInterval) {
    if (t >= 0 && t <= durationS) ticks.push(t);
  }

  // Filter visible casts + thin when zoomed out (uses filtered list for icon row)
  const viewEndS = viewStartS + viewWidthS;
  const margin = 2;
  const allVisible = visibleFilteredCasts.filter((c) => {
    const t = c.timestamp / 1000;
    return t >= viewStartS - margin && t <= viewEndS + margin;
  });

  // When icons would overlap, only keep every Nth to stay under ~150 DOM nodes
  // But always keep casts that have warnings
  const maxIcons = 150;
  const visibleCasts = allVisible.length > maxIcons
    ? (() => {
        const step = Math.ceil(allVisible.length / maxIcons);
        const thinned = new Set(
          allVisible.filter((_, i) => i % step === 0)
        );
        // Always include casts with warnings
        for (const c of allVisible) {
          if (warningByCastTs.has(`${c.timestamp}-${c.abilityGameID}`)) {
            thinned.add(c);
          }
        }
        return [...thinned].sort((a, b) => a.timestamp - b.timestamp);
      })()
    : allVisible;

  // Find the nearest cast to the mouse cursor (for highlight)
  const nearestCastIdx = mouseTimeS !== null
    ? (() => {
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < casts.length; i++) {
          const d = Math.abs(casts[i].timestamp / 1000 - mouseTimeS);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        // Only highlight if within a reasonable range (icon width in seconds)
        const thresholdS = ICON_SIZE / pps;
        return bestDist <= thresholdS ? bestIdx : -1;
      })()
    : -1;
  const nearestCast = nearestCastIdx >= 0 ? casts[nearestCastIdx] : null;

  // Viewport pixel width for SVG
  const viewWidthPx = viewRef.current?.clientWidth ?? 1000;

  // Clip essence points to visible range (with margin) for perf
  const essenceMarginS = 5;
  const visibleEssence = essencePts.filter(
    (p) => p.time >= viewStartS - essenceMarginS && p.time <= viewEndS + essenceMarginS
  );
  // Add boundary points so the path connects at edges
  const firstVisible = essencePts.findLast((p) => p.time < viewStartS - essenceMarginS);
  const lastVisible = essencePts.find((p) => p.time > viewEndS + essenceMarginS);
  const clippedEssence = [
    ...(firstVisible ? [firstVisible] : []),
    ...visibleEssence,
    ...(lastVisible ? [lastVisible] : []),
  ];

  const activeCast = hoveredCast || nearestCast;

  return (
    <div className="flex flex-col gap-3">

      {/* === Toolbar: spell filter + chart selectors === */}
      <div className="flex items-center gap-3 flex-wrap">
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
        >
          Spell Filters
          {hiddenSpells.size > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[10px] leading-none">
              {hiddenSpells.size}
            </span>
          )}
        </button>
        {filterOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-64 max-h-72 overflow-y-auto bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg p-2">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">
                {uniqueSpells.length - hiddenSpells.size}/{uniqueSpells.length} shown
              </span>
              <button
                onClick={() => setHiddenSpells(hiddenSpells.size > 0 ? new Set() : new Set(uniqueSpells.map((s) => s.id)))}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                {hiddenSpells.size > 0 ? "Show all" : "Hide all"}
              </button>
            </div>
            {uniqueSpells.map((spell) => {
              const visible = !hiddenSpells.has(spell.id);
              const color = SPELL_COLORS[spell.name] || "#8b949e";
              return (
                <label
                  key={spell.id}
                  className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[var(--background)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleSpell(spell.id)}
                    className="accent-[var(--accent)]"
                  />
                  {spell.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl(spell.icon)}
                      alt=""
                      width={16}
                      height={16}
                      className="rounded-sm flex-shrink-0"
                    />
                  )}
                  <span className="text-xs flex-1 truncate" style={{ color }}>
                    {spell.name}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">{spell.count}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Boss spell filter */}
      {allBossAbilities.length > 0 && (
      <div className="relative" ref={bossFilterRef}>
        <button
          onClick={() => setBossFilterOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
        >
          Boss Spells
          {hiddenBossSpells.size > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#f85149] text-white text-[10px] leading-none">
              {hiddenBossSpells.size}
            </span>
          )}
        </button>
        {bossFilterOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-72 max-h-72 overflow-y-auto bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg p-2">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">
                {allBossAbilities.length - hiddenBossSpells.size}/{allBossAbilities.length} shown
              </span>
              <button
                onClick={() => setHiddenBossSpells(hiddenBossSpells.size > 0 ? new Set() : new Set(allBossAbilities.map((a) => a.name)))}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                {hiddenBossSpells.size > 0 ? "Show all" : "Hide all"}
              </button>
            </div>
            {allBossAbilities.map((ability, i) => {
              const visible = !hiddenBossSpells.has(ability.name);
              const color = BOSS_SPELL_COLORS[i % BOSS_SPELL_COLORS.length];
              return (
                <label
                  key={ability.abilityGameID}
                  className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[var(--background)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => {
                      setHiddenBossSpells((prev) => {
                        const next = new Set(prev);
                        if (next.has(ability.name)) next.delete(ability.name);
                        else next.add(ability.name);
                        return next;
                      });
                    }}
                    className="accent-[var(--accent)]"
                  />
                  {ability.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl(ability.icon)}
                      alt=""
                      width={16}
                      height={16}
                      className="rounded-sm flex-shrink-0"
                    />
                  )}
                  <span className="text-xs flex-1 truncate" style={{ color }}>
                    {ability.name}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">{ability.hitCount}x</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Chart type selectors */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Left</span>
        <select
          value={leftChart}
          onChange={(e) => setLeftChart(e.target.value as ChartType)}
          className="px-2 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
          style={{ color: CHART_COLORS[leftChart].line }}
        >
          {CHART_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Right</span>
        <select
          value={rightChart}
          onChange={(e) => setRightChart(e.target.value as ChartType)}
          className="px-2 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
          style={{ color: CHART_COLORS[rightChart].line }}
        >
          {CHART_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      </div>

      {/* === Chart card === */}
      <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">

        {/* Fixed Y-axis */}
        <div className="flex-shrink-0 border-r border-[var(--border)]" style={{ width: Y_AXIS_WIDTH }}>
          {hasWarnings && <div style={{ height: WARN_ROW_HEIGHT }} />}
          <div style={{ height: ICON_ROW_HEIGHT }} />
          {/* Buff lane labels */}
          {buffLanes.map((lane) => (
            <div
              key={lane.abilityGameID}
              className="flex items-center justify-end pr-1"
              style={{ height: BUFF_LANE_HEIGHT, borderBottom: "1px solid var(--border)" }}
              title={lane.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={iconUrl(lane.icon)}
                alt={lane.name}
                width={12}
                height={12}
                className="rounded-sm"
              />
            </div>
          ))}
          {/* Boss timer labels */}
          {hasBossTimers && (
            <>
              <div
                className="flex items-center justify-center cursor-pointer hover:bg-[var(--card-hover)]"
                style={{ height: BOSS_HEADER_HEIGHT, borderBottom: "1px solid var(--border)" }}
                onClick={() => setBossTimersOpen((o) => !o)}
                title="Toggle Boss Timers"
              >
                <svg width={10} height={10} viewBox="0 0 10 10" className="text-[var(--muted)]">
                  {bossTimersOpen
                    ? <path d="M2 3.5 L5 7 L8 3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    : <path d="M3.5 2 L7 5 L3.5 8" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  }
                </svg>
              </div>
              {bossTimersOpen && bossAbilities.map((ability) => (
                <a
                  key={`boss-${ability.abilityGameID}`}
                  href={`https://www.wowhead.com/spell=${ability.abilityGameID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wowhead={`spell=${ability.abilityGameID}`}
                  className="flex items-center justify-end pr-0.5 hover:bg-[var(--card-hover)]"
                  style={{ height: BOSS_ROW_HEIGHT, borderBottom: "1px solid var(--border)" }}
                >
                  {ability.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl(ability.icon)}
                      alt={ability.name}
                      width={20}
                      height={20}
                      className="rounded-sm"
                    />
                  ) : (
                    <span className="text-[8px] text-[var(--muted)] truncate max-w-[24px]">{ability.name.slice(0, 3)}</span>
                  )}
                </a>
              ))}
            </>
          )}
          {/* Left Y labels */}
          <div style={{ height: CHART_HEIGHT, position: "relative" }}>
            {leftChart !== "none" && (() => {
              const max = getChartMax(leftChart);
              const steps = (leftChart === "essence" || leftChart === "echo-count") ? max : 4;
              return Array.from({ length: steps + 1 }, (_, i) => {
                const val = (i / steps) * max;
                return (
                  <div
                    key={i}
                    className="absolute text-[10px] text-right pr-1.5"
                    style={{ right: 0, top: chartValueToY(val, max) - 6, width: Y_AXIS_WIDTH, opacity: 0.6, color: CHART_COLORS[leftChart].line }}
                  >
                    {formatYLabel(val, leftChart)}
                  </div>
                );
              });
            })()}
          </div>
          <div style={{ height: RULER_HEIGHT }} />
        </div>

        {/* Viewport */}
        <div
          ref={viewRef}
          className="flex-1 relative overflow-hidden select-none"
          style={{ cursor: "grab", height: totalH }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        >
          {/* Icon row */}
          {/* Warning row */}
          {hasWarnings && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: WARN_ROW_HEIGHT, borderBottom: "1px solid var(--border)" }}>
              {visibleCasts.map((cast, i) => {
                const w = warningByCastTs.get(`${cast.timestamp}-${cast.abilityGameID}`);
                if (!w) return null;
                const x = toX(cast.timestamp / 1000);
                return (
                  <div
                    key={`w-${cast.timestamp}-${i}`}
                    className="absolute"
                    style={{
                      left: x - 8,
                      top: (WARN_ROW_HEIGHT - 16) / 2,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold cursor-default"
                      style={{
                        background: warnBg(w.level),
                        border: `1.5px solid ${warnColor(w.level)}`,
                        color: warnColor(w.level),
                      }}
                    >
                      !
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Icon row */}
          <div style={{ position: "absolute", top: warnRowH, left: 0, right: 0, height: ICON_ROW_HEIGHT, borderBottom: "1px solid var(--border)" }}>
            {visibleCasts.map((cast, i) => {
              const x = toX(cast.timestamp / 1000);
              const icon = cast.abilityIcon ? iconUrl(cast.abilityIcon) : null;
              const color = SPELL_COLORS[cast.abilityName] || "#8b949e";
              const isHighlighted = nearestCast === cast;

              return (
                <div
                  key={`${cast.timestamp}-${i}`}
                  className="absolute"
                  style={{
                    left: x - ICON_SIZE / 2,
                    top: (ICON_ROW_HEIGHT - ICON_SIZE) / 2,
                    zIndex: isHighlighted ? 40 : hoveredCast === cast ? 20 : 1,
                    transform: isHighlighted ? "scale(1.6)" : undefined,
                    transition: "transform 0.1s ease-out",
                  }}
                  onMouseEnter={() => setHoveredCast(cast)}
                  onMouseLeave={() => setHoveredCast(null)}
                >
                  <div
                    className="rounded overflow-hidden cursor-pointer relative"
                    style={{
                      width: ICON_SIZE,
                      height: ICON_SIZE,
                      border: isHighlighted ? `2px solid ${color}` : `1.5px solid ${color}40`,
                      boxShadow: isHighlighted ? `0 0 8px ${color}80` : undefined,
                    }}
                  >
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icon} alt={cast.abilityName} className="w-full h-full object-cover" loading="lazy" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[7px]" style={{ background: "var(--background)", color: "var(--muted)" }}>
                        {cast.abilityName?.slice(0, 2)}
                      </div>
                    )}
                    {cast.empowermentLevel != null && cast.empowermentLevel > 0 && (
                      <div className="absolute -bottom-px -right-px text-white text-[7px] w-2.5 h-2.5 rounded-full flex items-center justify-center font-bold" style={{ background: color }}>
                        {cast.empowermentLevel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Buff lanes */}
          {buffLanes.map((lane, laneIdx) => {
            const laneTop = warnRowH + ICON_ROW_HEIGHT + laneIdx * BUFF_LANE_HEIGHT;
            const colors = BUFF_COLORS[lane.abilityGameID] ?? { bg: "#58a6ff", text: "#fff" };

            // Filter visible spans
            const visibleSpans = lane.spans.filter((s) => {
              const sStartS = s.startTime / 1000;
              const sEndS = s.endTime / 1000;
              return sEndS >= viewStartS && sStartS <= viewEndS;
            });

            return (
              <div
                key={lane.abilityGameID}
                style={{
                  position: "absolute",
                  top: laneTop,
                  left: 0,
                  right: 0,
                  height: BUFF_LANE_HEIGHT,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {visibleSpans.map((span, si) => {
                  const left = toX(span.startTime / 1000);
                  const right = toX(span.endTime / 1000);
                  const width = Math.max(1, right - left);
                  const opacity = span.stacks / lane.maxStacks;

                  return (
                    <div
                      key={si}
                      className="absolute top-0 bottom-0 flex items-center justify-center"
                      style={{
                        left,
                        width,
                        background: colors.bg,
                        opacity: 0.15 + opacity * 0.45,
                      }}
                    >
                      {width > 20 && (
                        <span style={{ color: colors.text, fontSize: 9, fontWeight: 600, opacity: 0.9 }}>
                          {span.stacks}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Boss timers: header + collapsible rows */}
          {hasBossTimers && (
            <>
              {/* Collapse header */}
              <div
                style={{
                  position: "absolute",
                  top: warnRowH + ICON_ROW_HEIGHT + buffLanesHeight,
                  left: 0,
                  right: 0,
                  height: BOSS_HEADER_HEIGHT,
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  zIndex: 5,
                }}
                className="flex items-center bg-[var(--card)]"
                onClick={() => setBossTimersOpen((o) => !o)}
              >
                <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide px-2 select-none">
                  Boss Timers
                  <span className="ml-1 font-normal normal-case">({bossAbilities.length})</span>
                </span>
              </div>

              {/* Rows */}
              {bossTimersOpen && bossAbilities.map((ability, rowIdx) => {
                const rowTop = warnRowH + ICON_ROW_HEIGHT + buffLanesHeight + BOSS_HEADER_HEIGHT + rowIdx * BOSS_ROW_HEIGHT;
                const color = BOSS_SPELL_COLORS[rowIdx % BOSS_SPELL_COLORS.length];

                // Filter visible hits
                const visibleHits = ability.hits.filter((hit) => {
                  const tS = hit.timestamp / 1000;
                  return tS >= viewStartS - 2 && tS <= viewEndS + 2;
                });

                return (
                  <div
                    key={ability.abilityGameID}
                    style={{
                      position: "absolute",
                      top: rowTop,
                      left: 0,
                      right: 0,
                      height: BOSS_ROW_HEIGHT,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {/* Alternating background */}
                    {rowIdx % 2 === 0 && (
                      <div className="absolute inset-0" style={{ background: "var(--card)", opacity: 0.2 }} />
                    )}

                    {/* Cast markers with icon + timestamp */}
                    {visibleHits.map((hit, hitIdx) => {
                      const x = toX(hit.timestamp / 1000);
                      const label = fmtTime(hit.timestamp);

                      return (
                        <a
                          key={hitIdx}
                          href={`https://www.wowhead.com/spell=${ability.abilityGameID}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-wowhead={`spell=${ability.abilityGameID}`}
                          className="absolute flex items-center gap-0.5"
                          style={{
                            left: x - BOSS_ICON_SIZE / 2,
                            top: (BOSS_ROW_HEIGHT - BOSS_ICON_SIZE) / 2,
                          }}
                        >
                          {/* Spell icon */}
                          <div
                            className="rounded overflow-hidden flex-shrink-0"
                            style={{
                              width: BOSS_ICON_SIZE,
                              height: BOSS_ICON_SIZE,
                              border: `1.5px solid ${color}60`,
                            }}
                          >
                            {ability.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={iconUrl(ability.icon)}
                                alt={ability.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                draggable={false}
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-[7px]"
                                style={{ background: color + "20", color }}
                              >
                                {ability.name.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          {/* Timestamp label */}
                          <span
                            className="text-[9px] font-medium whitespace-nowrap select-none"
                            style={{ color }}
                          >
                            {label}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* Chart SVG */}
          <svg
            width={viewWidthPx}
            height={CHART_HEIGHT}
            style={{ position: "absolute", top: warnRowH + ICON_ROW_HEIGHT + buffLanesHeight + bossTimersHeight, left: 0 }}
          >
            {/* Vertical time grid */}
            {ticks.map((t) => {
              const x = toX(t);
              const major = t % 60 === 0;
              return (
                <line key={`tg-${t}`} x1={x} x2={x} y1={0} y2={CHART_HEIGHT}
                  stroke="var(--border)" strokeWidth={major ? 0.8 : 0.4} opacity={major ? 0.3 : 0.12} />
              );
            })}

            {/* Horizontal grid (based on left chart) */}
            {leftChart !== "none" && (() => {
              const max = getChartMax(leftChart);
              const steps = (leftChart === "essence" || leftChart === "echo-count") ? max : 4;
              return Array.from({ length: steps }, (_, i) => {
                const val = ((i + 1) / steps) * max;
                const y = chartValueToY(val, max);
                const isMax = i === steps - 1;
                return (
                  <line key={`hg-${i}`} x1={0} x2={viewWidthPx} y1={y} y2={y}
                    stroke="var(--border)" strokeWidth={0.5}
                    strokeDasharray={isMax ? "none" : "4,4"} opacity={isMax ? 0.4 : 0.15} />
                );
              });
            })()}

            {/* Right chart (rendered first, behind left) */}
            {rightChart !== "none" && (() => {
              const max = getChartMax(rightChart);
              const paths = buildChartSVGPath(rightChart, toX, max, viewStartS, viewEndS);
              if (!paths) return null;
              const colors = CHART_COLORS[rightChart];
              return (
                <>
                  <path d={paths.areaD} fill={colors.area} />
                  <path d={paths.lineD} fill="none" stroke={colors.line} strokeWidth={1} opacity={0.4} />
                </>
              );
            })()}

            {/* Left chart */}
            {leftChart !== "none" && (() => {
              const max = getChartMax(leftChart);
              const paths = buildChartSVGPath(leftChart, toX, max, viewStartS, viewEndS);
              if (!paths) return null;
              const colors = CHART_COLORS[leftChart];
              return (
                <>
                  <path d={paths.areaD} fill={colors.area} />
                  <path d={paths.lineD} fill="none" stroke={colors.line} strokeWidth={1.5} opacity={0.7} />
                </>
              );
            })()}

            {/* Optimal Reversion markers (shown when DTPS chart is active) */}
            {(leftChart === "dtps" || rightChart === "dtps") && reversionPeaks
              .filter((p) => {
                const tS = p.timestamp / 1000;
                return tS >= viewStartS - 2 && tS <= viewEndS + 2;
              })
              .map((p, i) => {
                const x = toX(p.timestamp / 1000);
                const max = getChartMax("dtps");
                const y = chartValueToY(p.dtps, max);
                const isHovered = hoveredRevPeak?.timestamp === p.timestamp;
                // Intensity 0..1 based on dtps relative to max
                const intensity = Math.min(1, p.dtps / dtpsMax);
                // Size: 2.5 (low) → 6 (max)
                const r = 2.5 + intensity * 3.5;
                // Color: green → yellow → orange → red → dark red
                const fill = revColor(intensity);
                const stroke = revStroke(intensity);
                return (
                  <g key={`rev-${i}`}
                    onMouseEnter={() => setHoveredRevPeak(p)}
                    onMouseLeave={() => setHoveredRevPeak(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <line x1={x} x2={x} y1={0} y2={CHART_HEIGHT}
                      stroke={fill} strokeWidth={1} opacity={isHovered ? 0.5 : 0.15} strokeDasharray="3,3" />
                    {/* Invisible larger hit area */}
                    <circle cx={x} cy={y} r={12} fill="transparent" />
                    <circle cx={x} cy={y} r={isHovered ? r + 2 : r}
                      fill={fill} fillOpacity={isHovered ? 1 : 0.85}
                      stroke={isHovered ? "#fff" : stroke} strokeWidth={isHovered ? 2 : 1.5} />
                  </g>
                );
              })}

            {/* Essence cost markers (when essence chart is active) */}
            {(leftChart === "essence" || rightChart === "essence") && visibleCasts
              .filter((c) => c.essenceCost && c.essenceCost > 0)
              .map((c, i) => {
                const x = toX(c.timestamp / 1000);
                return (
                  <line key={`m-${i}`} x1={x} x2={x} y1={0} y2={CHART_HEIGHT}
                    stroke={SPELL_COLORS[c.abilityName] || "#8b949e"} strokeWidth={0.5} opacity={0.15} />
                );
              })}
          </svg>

          {/* Ruler */}
          <div style={{ position: "absolute", top: warnRowH + ICON_ROW_HEIGHT + buffLanesHeight + bossTimersHeight + CHART_HEIGHT, left: 0, right: 0, height: RULER_HEIGHT, borderTop: "1px solid var(--border)" }}>
            {ticks.map((t) => {
              const x = toX(t);
              return (
                <div key={t}>
                  <div className="absolute top-0" style={{ left: x, width: 1, height: 6, background: "var(--muted)", opacity: 0.3 }} />
                  <div className="absolute" style={{ left: x, top: 8, transform: "translateX(-50%)", fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {fmtSec(t)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mouse guide */}
          {mouseViewX !== null && mouseTimeS !== null && mouseTimeS >= 0 && mouseTimeS <= durationS && (
            <>
              <div style={{ position: "absolute", left: mouseViewX, top: 0, width: 1, height: totalH, background: "var(--accent)", opacity: 0.5, pointerEvents: "none", zIndex: 30 }} />
              <div style={{ position: "absolute", left: mouseViewX, top: warnRowH + ICON_ROW_HEIGHT + buffLanesHeight + bossTimersHeight + CHART_HEIGHT + 1, transform: "translateX(-50%)", pointerEvents: "none", zIndex: 31 }}>
                <div className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--accent)", color: "white", whiteSpace: "nowrap" }}>
                  {fmtSec(mouseTimeS)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Y-axis */}
        {hasRightChart && (
          <div className="flex-shrink-0 border-l border-[var(--border)]" style={{ width: Y_AXIS_RIGHT_WIDTH }}>
            <div style={{ height: ICON_ROW_HEIGHT }} />
            {buffLanes.map((lane) => (
              <div key={lane.abilityGameID} style={{ height: BUFF_LANE_HEIGHT, borderBottom: "1px solid var(--border)" }} />
            ))}
            {hasBossTimers && (
              <>
                <div style={{ height: BOSS_HEADER_HEIGHT, borderBottom: "1px solid var(--border)" }} />
                {bossTimersOpen && bossAbilities.map((ability) => (
                  <div key={`rboss-${ability.abilityGameID}`} style={{ height: BOSS_ROW_HEIGHT, borderBottom: "1px solid var(--border)" }} />
                ))}
              </>
            )}
            <div style={{ height: CHART_HEIGHT, position: "relative" }}>
              {(() => {
                const max = getChartMax(rightChart);
                const steps = (rightChart === "essence" || rightChart === "echo-count") ? max : 4;
                return Array.from({ length: steps + 1 }, (_, i) => {
                  const val = (i / steps) * max;
                  return (
                    <div
                      key={i}
                      className="absolute text-[9px] pl-1"
                      style={{ left: 0, top: chartValueToY(val, max) - 5, opacity: 0.5, color: CHART_COLORS[rightChart].line }}
                    >
                      {formatYLabel(val, rightChart)}
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ height: RULER_HEIGHT }} />
          </div>
        )}
      </div>

      {/* === Info card (below chart, updates on hover) === */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3">
        {hoveredRevPeak ? (() => {
          const intensity = Math.min(1, hoveredRevPeak.dtps / dtpsMax);
          const peakColor = revColor(intensity);
          const pctMax = Math.round(intensity * 100);
          const label = pctMax >= 80 ? "High value" : pctMax >= 50 ? "Good value" : "Low damage";
          return (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: peakColor + "20", border: `2px solid ${peakColor}` }}>
              <div className="w-5 h-5 rounded-full" style={{ background: peakColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm" style={{ color: peakColor }}>
                  Reversion Window
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: peakColor + "20", color: peakColor }}>
                  {label}
                </span>
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{fmtTime(hoveredRevPeak.timestamp)}</div>
            </div>
            <div className="flex gap-6 flex-shrink-0">
              <div className="text-center">
                <div className="text-sm font-semibold" style={{ color: peakColor }}>
                  {fmtDmg(hoveredRevPeak.total5s)}
                </div>
                <div className="text-[10px] text-[var(--muted)]">5s Damage</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold" style={{ color: peakColor }}>
                  {fmtDmg(hoveredRevPeak.dtps)}/s
                </div>
                <div className="text-[10px] text-[var(--muted)]">Raid DTPS</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold" style={{ color: peakColor }}>
                  {pctMax}%
                </div>
                <div className="text-[10px] text-[var(--muted)]">of Max DTPS</div>
              </div>
            </div>
          </div>
          );
        })() : activeCast ? (
          <div className="flex flex-col gap-3">
            {/* Top row: icon + details + stats */}
            <div className="flex items-center gap-4">
              {activeCast.abilityIcon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrl(activeCast.abilityIcon)}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded flex-shrink-0"
                  style={{ border: `2px solid ${SPELL_COLORS[activeCast.abilityName] || "var(--border)"}` }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold text-sm"
                    style={{ color: SPELL_COLORS[activeCast.abilityName] || "var(--foreground)" }}
                  >
                    {activeCast.abilityName || `Spell ${activeCast.abilityGameID}`}
                  </span>
                  {activeCast.empowermentLevel != null && activeCast.empowermentLevel > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] font-medium">
                      Rank {activeCast.empowermentLevel}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{fmtTime(activeCast.timestamp)}</div>
              </div>
              <div className="flex gap-4 flex-shrink-0">
                {activeCast.essenceCost != null && activeCast.essenceCost > 0 && (
                  <div className="text-center">
                    <div className="text-sm font-semibold text-[#3fb950]">
                      {activeCast.essence} → {(activeCast.essence ?? 0) - activeCast.essenceCost}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">Essence</div>
                  </div>
                )}
                {buffLanes.map((lane) => {
                  const castMs = activeCast.timestamp;
                  const span = lane.spans.find((s) => s.startTime <= castMs && s.endTime >= castMs);
                  const stacks = span?.stacks ?? 0;
                  const colors = BUFF_COLORS[lane.abilityGameID] ?? { bg: "#58a6ff", text: "#fff" };
                  return (
                    <div key={lane.abilityGameID} className="text-center">
                      <div className="text-sm font-semibold" style={{ color: stacks > 0 ? colors.bg : "var(--muted)" }}>
                        {stacks}/{lane.maxStacks}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">{lane.name}</div>
                    </div>
                  );
                })}
                {activeCast.hitPoints != null && activeCast.maxHitPoints != null && (
                  <div className="text-center">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {Math.round((activeCast.hitPoints / activeCast.maxHitPoints) * 100)}%
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">HP</div>
                  </div>
                )}
              </div>
            </div>
            {/* Warning notice */}
            {(() => {
              const w = warningByCastTs.get(`${activeCast.timestamp}-${activeCast.abilityGameID}`);
              if (!w) return null;
              const color = warnColor(w.level);
              return (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-md text-xs"
                  style={{
                    background: `${color}10`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ border: `1.5px solid ${color}`, color }}
                  >
                    {w.level === "info" ? "i" : "!"}
                  </span>
                  <div>
                    <div className="font-semibold" style={{ color }}>
                      {w.title}
                    </div>
                    <div className="text-[var(--muted)] mt-0.5 leading-relaxed">
                      {w.description}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)] py-2">
            Hover the timeline to inspect casts &middot; {casts.length} casts &middot; {fmtTime(data.fightDuration)}
          </div>
        )}
      </div>

      {/* === Raid frames (always visible, centered) === */}
      {actors && actors.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3 flex justify-center">
          <RaidFrames
            actors={actors}
            fightActorIds={fightActorIds}
            raidBuffEvents={data.raidBuffEvents ?? []}
            raidBuffDefs={data.raidBuffDefs ?? []}
            raidHP={data.raidHP ?? []}
            currentTimestamp={activeCast?.timestamp ?? null}
            targetID={activeCast?.targetID && activeCast.targetID > 0 ? activeCast.targetID : null}
          />
        </div>
      )}

      {/* === Stats summary === */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">Statistics</h3>
          {reportCode && fightId && sourceId && (
            <a
              href={`https://wowanalyzer.com/report/${reportCode}/${fightId}/${sourceId}-${encodeURIComponent(playerName ?? "Player")}/standard/overview`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              View on WoW Analyzer
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {/* Player ilvl + tier */}
          {(() => {
            const combatant = sourceId ? data.combatants?.find((c) => c.sourceID === sourceId) : null;
            if (!combatant) return null;
            return (
              <>
                {combatant.ilvl > 0 && (
                  <div className="text-center">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {combatant.ilvl}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">Item Level</div>
                  </div>
                )}
              </>
            );
          })()}
          {/* Average HPS */}
          {hpsData.length > 0 && (
            <div className="text-center">
              <div className="text-sm font-semibold text-[#58a6ff]">
                {(hpsData.reduce((sum, p) => sum + p.hps, 0) / hpsData.length / 1000).toFixed(1)}k
              </div>
              <div className="text-[10px] text-[var(--muted)]">Avg HPS</div>
            </div>
          )}
          {/* Total essence spent */}
          <div className="text-center">
            <div className="text-sm font-semibold text-[#3fb950]">
              {casts.reduce((sum, c) => sum + (c.essenceCost ?? 0), 0)}
            </div>
            <div className="text-[10px] text-[var(--muted)]">Essence spent</div>
          </div>
          {/* Cast per minute for key spells */}
          {STAT_SPELLS.map((spell) => {
            const count = casts.filter((c) => c.abilityGameID === spell.id).length;
            const cpm = durationS > 0 ? (count / durationS * 60).toFixed(1) : "0";
            return (
              <div key={spell.id} className="text-center">
                <div className="text-sm font-semibold" style={{ color: spell.color }}>
                  {count} <span className="text-[10px] font-normal text-[var(--muted)]">({cpm}/min)</span>
                </div>
                <div className="text-[10px] text-[var(--muted)]">{spell.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* === Warning list === */}
      {castWarnings.length > 0 && (() => {
        // Unique warning types for filter
        const warningTypes = [...new Map(castWarnings.map((w) => [w.title, w])).values()];
        const filteredWarnings = hiddenWarningTypes.size > 0
          ? castWarnings.filter((w) => !hiddenWarningTypes.has(w.title))
          : castWarnings;

        const toggleWarningType = (title: string) => {
          setHiddenWarningTypes((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
          });
        };

        return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">
              Warnings ({filteredWarnings.length}/{castWarnings.length})
            </h3>
            <button
              onClick={() => setHiddenWarningTypes(
                hiddenWarningTypes.size > 0 ? new Set() : new Set(warningTypes.map((w) => w.title))
              )}
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              {hiddenWarningTypes.size > 0 ? "Show all" : "Hide all"}
            </button>
          </div>
          {/* Warning type filters */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {warningTypes.map((w) => {
              const count = castWarnings.filter((cw) => cw.title === w.title).length;
              const visible = !hiddenWarningTypes.has(w.title);
              const color = warnColor(w.level);
              return (
                <button
                  key={w.title}
                  onClick={() => toggleWarningType(w.title)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-opacity"
                  style={{
                    background: visible ? `${color}15` : "transparent",
                    border: `1px solid ${visible ? `${color}40` : "var(--border)"}`,
                    color: visible ? color : "var(--muted)",
                    opacity: visible ? 1 : 0.5,
                  }}
                >
                  {w.title}
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
          {/* Warning items */}
          <div className="flex flex-col gap-2">
            {filteredWarnings.map((w, i) => {
              const color = warnColor(w.level);
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-md text-xs"
                  style={{
                    background: `${color}08`,
                    border: `1px solid ${color}20`,
                  }}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ border: `1.5px solid ${color}`, color }}
                  >
                    {w.level === "info" ? "i" : "!"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {fmtTime(w.cast.timestamp)}
                      </span>
                      <span className="font-semibold" style={{ color }}>
                        {w.title}
                      </span>
                    </div>
                    <div className="text-[var(--muted)] mt-0.5 leading-relaxed">
                      {w.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

    </div>
  );
}
