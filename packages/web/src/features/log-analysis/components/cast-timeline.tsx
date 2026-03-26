"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RaidFrames } from "./raid-frames";

// --- Types ---

interface CastEvent {
  timestamp: number;
  type: string;
  abilityGameID: number;
  abilityName: string;
  abilityIcon: string;
  targetID: number;
  empowermentLevel?: number;
  essence?: number;
  essenceMax?: number;
  essenceCost?: number;
  hitPoints?: number;
  maxHitPoints?: number;
}

interface BuffLaneSpan {
  startTime: number;
  endTime: number;
  stacks: number;
}

interface BuffLane {
  abilityGameID: number;
  name: string;
  icon: string;
  maxStacks: number;
  spans: BuffLaneSpan[];
}

interface EchoTargetEvent {
  timestamp: number;
  targetID: number;
  type: "apply" | "remove";
}

interface Actor {
  id: number;
  name: string;
  server: string;
  subType: string;
}

interface CastTimelineData {
  events: CastEvent[];
  fightDuration: number;
  abilities: Record<string, { name: string; icon: string }>;
  buffLanes?: BuffLane[];
  echoEvents?: EchoTargetEvent[];
  raidBuffEvents?: Array<{ timestamp: number; targetID: number; buffId: number; type: "apply" | "remove" }>;
  raidBuffDefs?: Array<{ id: number; name: string; icon: string; color: string; abbrev: string }>;
  raidHP?: Array<{ timestamp: number; targetID: number; hitPoints: number; maxHitPoints: number }>;
  hpsGraph?: Array<{ timestamp: number; hps: number }>;
}

interface CastTimelineProps {
  data: CastTimelineData;
  actors?: Actor[];
}

// --- Constants ---

const MIN_PX_PER_SEC = 4;
const MAX_PX_PER_SEC = 80;
const DEFAULT_PX_PER_SEC = 12;
const CHART_HEIGHT = 160;
const ICON_SIZE = 24;
const ICON_ROW_HEIGHT = 32;
const BUFF_LANE_HEIGHT = 16;
const RULER_HEIGHT = 28;
const Y_AXIS_WIDTH = 28;
const Y_AXIS_RIGHT_WIDTH = 40;
const ESSENCE_MAX = 5;

const BUFF_COLORS: Record<number, { bg: string; text: string }> = {
  369299: { bg: "#d29922", text: "#fff" }, // Essence Burst — amber
  1242759: { bg: "#bc8cff", text: "#fff" }, // Twin Echoes — purple
};
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

function fmtSec(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// --- Essence ---

interface EP { time: number; essence: number }

function buildEssence(casts: CastEvent[], durMs: number): EP[] {
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

export function CastTimeline({ data, actors }: CastTimelineProps) {
  const viewRef = useRef<HTMLDivElement>(null);

  // Virtual viewport: viewStartS = left edge time, pxPerSec = zoom
  const [pps, setPps] = useState(DEFAULT_PX_PER_SEC);
  const [viewStartS, setViewStartS] = useState(0);
  const [mouseClientX, setMouseClientX] = useState<number | null>(null);
  const [hoveredCast, setHoveredCast] = useState<CastEvent | null>(null);

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

  const casts = data.events.filter(
    (e) => (e.type === "cast" || e.type === "empowerend") && !e.abilityName.startsWith("Unknown(")
  );
  const durationS = data.fightDuration / 1000;
  const essencePts = buildEssence(casts, data.fightDuration);

  // HPS graph
  const hpsData = data.hpsGraph ?? [];
  const hpsMax = hpsData.length > 0 ? Math.max(...hpsData.map((p) => p.hps), 1) : 1;
  const hpsToY = (hps: number) => CHART_HEIGHT - (hps / hpsMax) * CHART_HEIGHT;

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
  const buffLanes = data.buffLanes ?? [];
  const buffLanesHeight = buffLanes.length * BUFF_LANE_HEIGHT;
  const totalH = ICON_ROW_HEIGHT + buffLanesHeight + CHART_HEIGHT + RULER_HEIGHT;

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

  // Mouse move
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setMouseClientX(e.clientX);
  }, []);

  const onMouseLeave = useCallback(() => {
    // Keep last position — don't clear
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

  // Filter visible casts + thin when zoomed out
  const viewEndS = viewStartS + viewWidthS;
  const margin = 2;
  const allVisible = casts.filter((c) => {
    const t = c.timestamp / 1000;
    return t >= viewStartS - margin && t <= viewEndS + margin;
  });

  // When icons would overlap, only keep every Nth to stay under ~150 DOM nodes
  const maxIcons = 150;
  const visibleCasts = allVisible.length > maxIcons
    ? allVisible.filter((_, i) => i % Math.ceil(allVisible.length / maxIcons) === 0)
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

      {/* === Chart card === */}
      <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">

        {/* Fixed Y-axis */}
        <div className="flex-shrink-0 border-r border-[var(--border)]" style={{ width: Y_AXIS_WIDTH }}>
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
          {/* Essence Y labels */}
          <div style={{ height: CHART_HEIGHT, position: "relative" }}>
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <div
                key={v}
                className="absolute text-[10px] text-[var(--muted)] text-right pr-1.5"
                style={{ right: 0, top: eY(v) - 6, width: Y_AXIS_WIDTH, opacity: 0.6 }}
              >
                {v}
              </div>
            ))}
          </div>
          <div style={{ height: RULER_HEIGHT }} />
        </div>

        {/* Viewport */}
        <div
          ref={viewRef}
          className="flex-1 relative overflow-hidden select-none"
          style={{ cursor: "crosshair", height: totalH }}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          {/* Icon row */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: ICON_ROW_HEIGHT, borderBottom: "1px solid var(--border)" }}>
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
            const laneTop = ICON_ROW_HEIGHT + laneIdx * BUFF_LANE_HEIGHT;
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

          {/* Essence chart */}
          <svg
            width={viewWidthPx}
            height={CHART_HEIGHT}
            style={{ position: "absolute", top: ICON_ROW_HEIGHT + buffLanesHeight, left: 0 }}
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

            {/* Horizontal grid */}
            {[1, 2, 3, 4, 5].map((v) => (
              <line key={v} x1={0} x2={viewWidthPx} y1={eY(v)} y2={eY(v)}
                stroke="var(--border)" strokeWidth={0.5}
                strokeDasharray={v === 5 ? "none" : "4,4"} opacity={v === 5 ? 0.4 : 0.15} />
            ))}

            {/* Area */}
            {/* HPS area + line (behind essence) */}
            {hpsData.length > 0 && (() => {
              const visible = hpsData.filter(
                (p) => p.timestamp / 1000 >= viewStartS - 5 && p.timestamp / 1000 <= viewEndS + 5
              );
              if (visible.length < 2) return null;
              const pts = visible.map((p) => `${toX(p.timestamp / 1000)},${hpsToY(p.hps)}`);
              const areaD = `M ${toX(visible[0].timestamp / 1000)},${CHART_HEIGHT} L ${pts.join(" L ")} L ${toX(visible[visible.length - 1].timestamp / 1000)},${CHART_HEIGHT} Z`;
              const lineD = `M ${pts.join(" L ")}`;
              return (
                <>
                  <path d={areaD} fill="rgba(88,166,255,0.06)" />
                  <path d={lineD} fill="none" stroke="#58a6ff" strokeWidth={1} opacity={0.4} />
                </>
              );
            })()}

            {/* Essence area */}
            <path d={areaPath(clippedEssence, toX, viewWidthPx)} fill="rgba(63,185,80,0.06)" />

            {/* Essence line */}
            <path d={stepPath(clippedEssence, toX)} fill="none" stroke="#3fb950" strokeWidth={1.5} opacity={0.7} />

            {/* Essence cost markers */}
            {visibleCasts
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
          <div style={{ position: "absolute", top: ICON_ROW_HEIGHT + buffLanesHeight + CHART_HEIGHT, left: 0, right: 0, height: RULER_HEIGHT, borderTop: "1px solid var(--border)" }}>
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
              <div style={{ position: "absolute", left: mouseViewX, top: ICON_ROW_HEIGHT + buffLanesHeight + CHART_HEIGHT + 1, transform: "translateX(-50%)", pointerEvents: "none", zIndex: 31 }}>
                <div className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--accent)", color: "white", whiteSpace: "nowrap" }}>
                  {fmtSec(mouseTimeS)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Y-axis (HPS) */}
        {hpsData.length > 0 && (
          <div className="flex-shrink-0 border-l border-[var(--border)]" style={{ width: Y_AXIS_RIGHT_WIDTH }}>
            <div style={{ height: ICON_ROW_HEIGHT }} />
            {buffLanes.map((lane) => (
              <div key={lane.abilityGameID} style={{ height: BUFF_LANE_HEIGHT, borderBottom: "1px solid var(--border)" }} />
            ))}
            <div style={{ height: CHART_HEIGHT, position: "relative" }}>
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const val = Math.round(hpsMax * pct);
                const label = val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val);
                return (
                  <div
                    key={pct}
                    className="absolute text-[9px] text-[#58a6ff] pl-1"
                    style={{ left: 0, top: hpsToY(val) - 5, opacity: 0.5 }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div style={{ height: RULER_HEIGHT }} />
          </div>
        )}
      </div>

      {/* === Info card (below chart, updates on hover) === */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3">
        {activeCast ? (
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

    </div>
  );
}
