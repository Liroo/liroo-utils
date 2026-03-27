"use client";

import type { RaidBuffEvent, RaidBuffDef, HPSnapshot } from "@/lib/wlogs/types/wcl-responses";
import { CLASS_COLORS } from "@/constants/wow";

const ECHO_SPELL_ID = 364343;

interface Actor {
  id: number;
  name: string;
  server: string;
  subType: string;
}

interface RaidFramesProps {
  actors: Actor[];
  fightActorIds: Set<number>;
  raidBuffEvents: RaidBuffEvent[];
  raidBuffDefs: RaidBuffDef[];
  raidHP: HPSnapshot[];
  currentTimestamp: number | null;
  targetID: number | null;
}

const CELL_MAX_W = 140;
const CELL_H = 50;

function getHP(snapshots: HPSnapshot[], targetID: number, atTimestamp: number): { hp: number; max: number } | null {
  let best: HPSnapshot | null = null;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const s = snapshots[i];
    if (s.timestamp > atTimestamp) continue;
    if (s.targetID === targetID) { best = s; break; }
  }
  return best ? { hp: best.hitPoints, max: best.maxHitPoints } : null;
}

/** Returns a Set of buffIds active on a given target at a given timestamp.
 *  Removebuff events within BUFF_MARGIN ms of the query timestamp are deferred —
 *  if a buff is removed at (or very close to) the same ms as a cast, it was
 *  consumed BY that cast and should still appear active in the overlay.
 *  WCL events can have slight timing offsets between the cast and the buff removal. */
const BUFF_MARGIN = 100; // ms
function getActiveBuffs(events: RaidBuffEvent[], targetID: number, atTimestamp: number): Set<number> {
  const active = new Set<number>();
  for (const e of events) {
    if (e.timestamp > atTimestamp + BUFF_MARGIN) break;
    if (e.targetID !== targetID) continue;
    if (e.type === "apply") active.add(e.buffId);
    else if (e.timestamp < atTimestamp - BUFF_MARGIN) active.delete(e.buffId);
    // remove within ±BUFF_MARGIN of atTimestamp → skip (buff consumed by or near this cast)
  }
  return active;
}

export function RaidFrames({ actors, fightActorIds, raidBuffEvents, raidBuffDefs, raidHP, currentTimestamp, targetID }: RaidFramesProps) {
  const players = actors.filter((a) => a.subType !== "Unknown" && fightActorIds.has(a.id));

  const groups: Actor[][] = [];
  for (let i = 0; i < players.length; i += 5) {
    groups.push(players.slice(i, i + 5));
  }

  // Build a lookup: buffId → def
  const buffDefMap = new Map(raidBuffDefs.map((d) => [d.id, d]));

  return (
    <div className="flex flex-col w-full">
      {groups.map((group, gi) => (
        <div key={gi} className="flex w-full">
          {group.map((actor) => {
            const isTarget = actor.id === targetID;
            const color = CLASS_COLORS[actor.subType] || "#8b949e";
            const hp = currentTimestamp !== null ? getHP(raidHP, actor.id, currentTimestamp) : null;
            const hpPct = hp ? Math.round((hp.hp / hp.max) * 100) : 100;
            const activeBuffs = currentTimestamp !== null
              ? getActiveBuffs(raidBuffEvents, actor.id, currentTimestamp)
              : new Set<number>();

            return (
              <div
                key={actor.id}
                className="relative flex items-end overflow-hidden flex-1 min-w-0"
                style={{
                  maxWidth: CELL_MAX_W,
                  height: CELL_H,
                  background: "#0a0a0a",
                  border: isTarget ? "2px solid #fff" : "1px solid #1a1a1a",
                  boxShadow: isTarget ? `0 0 10px ${color}, inset 0 0 20px ${color}60` : undefined,
                }}
              >
                {/* HP bar */}
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{ width: `${hpPct}%`, background: color }}
                />
                {/* Missing HP */}
                <div
                  className="absolute right-0 top-0 bottom-0"
                  style={{ width: `${100 - hpPct}%`, background: "#111" }}
                />
                {/* Echo icon — centered */}
                {activeBuffs.has(ECHO_SPELL_ID) && (() => {
                  const def = buffDefMap.get(ECHO_SPELL_ID);
                  if (!def) return null;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://wow.zamimg.com/images/wow/icons/large/${def.icon.replace(/\.jpg$/, "")}.jpg`}
                      alt={def.abbrev}
                      title={def.name}
                      width={20}
                      height={20}
                      className="absolute z-10 rounded-sm"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        border: `1.5px solid ${def.color}`,
                        boxShadow: `0 0 6px ${def.color}`,
                      }}
                    />
                  );
                })()}
                {/* Other buff icons — top right */}
                {(() => {
                  const otherBuffs = Array.from(activeBuffs).filter((id) => id !== ECHO_SPELL_ID);
                  if (otherBuffs.length === 0) return null;
                  return (
                    <div className="absolute top-0.5 right-0.5 z-10 flex gap-px">
                      {otherBuffs.map((buffId) => {
                        const def = buffDefMap.get(buffId);
                        if (!def) return null;
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={buffId}
                            src={`https://wow.zamimg.com/images/wow/icons/large/${def.icon.replace(/\.jpg$/, "")}.jpg`}
                            alt={def.abbrev}
                            title={def.name}
                            width={14}
                            height={14}
                            className="rounded-sm"
                            style={{
                              border: `1px solid ${def.color}`,
                              boxShadow: `0 0 3px ${def.color}`,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Name */}
                <span
                  className="relative z-10 text-[11px] font-semibold leading-none px-1.5 pb-1.5 truncate"
                  style={{ color: "#ddd", textShadow: "0 1px 2px #000" }}
                >
                  {actor.name}
                </span>
                {/* HP % */}
                {hpPct < 100 && (
                  <span
                    className="absolute z-10 text-[9px] font-bold right-1 bottom-1"
                    style={{ color: hpPct < 30 ? "#f85149" : "#aaa", textShadow: "0 1px 2px #000" }}
                  >
                    {hpPct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
