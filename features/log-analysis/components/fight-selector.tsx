"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Swords } from "lucide-react";
import { DIFFICULTY, DIFFICULTY_ORDER } from "@/constants/wow";

interface Fight {
  id: number;
  encounterID: number;
  name: string;
  kill: boolean;
  difficulty: number;
  startTime: number;
  endTime: number;
  size: number;
}

function formatDuration(startTime: number, endTime: number): string {
  const totalSeconds = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function BossIcon({ encounterID, name }: { encounterID: number; name: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-6 h-6 rounded bg-[var(--border)] flex items-center justify-center flex-shrink-0">
        <Swords size={12} className="text-[var(--muted)]" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://assets.rpglogs.com/img/warcraft/bosses/${encounterID}-icon.jpg`}
      alt={name}
      width={24}
      height={24}
      className="rounded flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

interface GroupedFights {
  difficulty: number;
  label: string;
  bosses: { name: string; encounterID: number; fights: Fight[] }[];
}

function groupFights(fights: Fight[]): GroupedFights[] {
  const byDifficulty = new Map<number, Map<string, Fight[]>>();

  for (const fight of fights) {
    if (!byDifficulty.has(fight.difficulty)) {
      byDifficulty.set(fight.difficulty, new Map());
    }
    const bossMap = byDifficulty.get(fight.difficulty)!;
    if (!bossMap.has(fight.name)) {
      bossMap.set(fight.name, []);
    }
    bossMap.get(fight.name)!.push(fight);
  }

  const groups: GroupedFights[] = [];
  for (const diff of DIFFICULTY_ORDER) {
    const bossMap = byDifficulty.get(diff);
    if (!bossMap) continue;
    const bosses: GroupedFights["bosses"] = [];
    for (const [name, bFights] of bossMap) {
      bosses.push({ name, encounterID: bFights[0].encounterID, fights: bFights });
    }
    groups.push({
      difficulty: diff,
      label: DIFFICULTY[diff]?.label || `D${diff}`,
      bosses,
    });
  }

  return groups;
}

interface FightSelectorProps {
  fights: Fight[];
  selectedFightId: number | null;
  onSelect: (id: number) => void;
}

export function FightSelector({ fights, selectedFightId, onSelect }: FightSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedFight = fights.find((f) => f.id === selectedFightId);
  const grouped = groupFights(fights);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div className="flex-1 min-w-[250px] relative" ref={containerRef}>
      <label className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1.5">
        <Swords size={12} /> Select Fight
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] text-left flex items-center gap-2 hover:border-[var(--accent)] transition-colors"
      >
        {selectedFight ? (
          <>
            <BossIcon encounterID={selectedFight.encounterID} name={selectedFight.name} />
            <span className="truncate flex-1">
              {selectedFight.name}
              <span
                className="ml-1 text-xs font-medium"
                style={{ color: DIFFICULTY[selectedFight.difficulty]?.color || "var(--muted)" }}
              >
                {DIFFICULTY[selectedFight.difficulty]?.label || `D${selectedFight.difficulty}`}
              </span>
            </span>
            <span className={selectedFight.kill ? "text-green-400" : "text-red-400"}>
              {selectedFight.kill ? "Kill" : "Wipe"}
            </span>
            <span className="text-[var(--muted)] text-xs">
              {formatDuration(selectedFight.startTime, selectedFight.endTime)}
            </span>
          </>
        ) : (
          <span className="text-[var(--muted)]">Choose a fight...</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[400px] overflow-y-auto bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg">
          {grouped.map((group) => (
            <div key={group.difficulty}>
              {/* Difficulty header */}
              <div
                className="sticky top-0 z-10 px-3 py-1.5 bg-[var(--background)] border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide"
                style={{ color: DIFFICULTY[group.difficulty]?.color || "var(--muted)" }}
              >
                {group.label}
              </div>

              {group.bosses.map((boss, bossIdx) => (
                <div key={boss.name}>
                  {/* Boss divider — always show between bosses */}
                  {bossIdx > 0 && (
                    <div className="border-t border-[var(--border)]" />
                  )}
                  {/* Boss header */}
                  <div className="px-3 py-1.5 text-xs text-[var(--muted)] flex items-center gap-2 bg-[var(--card)]">
                    <BossIcon encounterID={boss.encounterID} name={boss.name} />
                    <span className="font-medium">{boss.name}</span>
                    <span className="text-[10px] opacity-60">({boss.fights.length} pull{boss.fights.length > 1 ? "s" : ""})</span>
                  </div>
                  {boss.fights.map((fight) => (
                    <button
                      key={fight.id}
                      type="button"
                      onClick={() => {
                        onSelect(fight.id);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 pl-11 text-sm text-left flex items-center gap-2 hover:bg-[var(--border)] transition-colors ${
                        fight.id === selectedFightId ? "bg-[var(--border)]" : ""
                      }`}
                    >
                      <span
                        className={`text-xs font-medium w-9 ${
                          fight.kill ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fight.kill ? "Kill" : "Wipe"}
                      </span>
                      <span className="text-xs text-[var(--muted)] w-12">
                        {formatDuration(fight.startTime, fight.endTime)}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        #{fight.id}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
