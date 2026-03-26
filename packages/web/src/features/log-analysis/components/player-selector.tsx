"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { User } from "lucide-react";

interface Actor {
  id: number;
  name: string;
  server: string;
  subType: string;
}

export interface PlayerInfo {
  id: number;
  name: string;
  server: string;
  class: string;
  spec: string;
  icon: string; // e.g. "Evoker-Preservation"
}

const CLASS_COLORS: Record<string, string> = {
  Warrior: "#C69B6D",
  Paladin: "#F48CBA",
  Hunter: "#ABD473",
  Rogue: "#FFF468",
  Priest: "#FFFFFF",
  DeathKnight: "#C41E3A",
  Shaman: "#0070DD",
  Mage: "#3FC7EB",
  Warlock: "#8788EE",
  Monk: "#00FF98",
  Druid: "#FF7C0A",
  DemonHunter: "#A330C9",
  Evoker: "#33937F",
};

// Only Preservation Evoker is supported for now
const SUPPORTED_SPECS = new Set(["Evoker-Preservation"]);

// Spec icon mapping: "Class-Spec" → wowhead icon name
const SPEC_ICONS: Record<string, string> = {
  "Evoker-Preservation": "classicon_evoker_preservation",
  "Evoker-Devastation": "classicon_evoker_devastation",
  "Evoker-Augmentation": "classicon_evoker_augmentation",
  "Paladin-Holy": "classicon_paladin_holy",
  "Paladin-Protection": "classicon_paladin_protection",
  "Paladin-Retribution": "classicon_paladin_retribution",
  "Priest-Holy": "classicon_priest_holy",
  "Priest-Discipline": "classicon_priest_discipline",
  "Priest-Shadow": "classicon_priest_shadow",
  "Shaman-Restoration": "classicon_shaman_restoration",
  "Shaman-Elemental": "classicon_shaman_elemental",
  "Shaman-Enhancement": "classicon_shaman_enhancement",
  "Druid-Restoration": "classicon_druid_restoration",
  "Druid-Balance": "classicon_druid_balance",
  "Druid-Feral": "classicon_druid_feral",
  "Druid-Guardian": "classicon_druid_guardian",
  "Monk-Mistweaver": "classicon_monk_mistweaver",
  "Monk-Windwalker": "classicon_monk_windwalker",
  "Monk-Brewmaster": "classicon_monk_brewmaster",
  "Warrior-Arms": "classicon_warrior_arms",
  "Warrior-Fury": "classicon_warrior_fury",
  "Warrior-Protection": "classicon_warrior_protection",
  "Hunter-BeastMastery": "classicon_hunter_beastmastery",
  "Hunter-Marksmanship": "classicon_hunter_marksmanship",
  "Hunter-Survival": "classicon_hunter_survival",
  "Rogue-Assassination": "classicon_rogue_assassination",
  "Rogue-Outlaw": "classicon_rogue_outlaw",
  "Rogue-Subtlety": "classicon_rogue_subtlety",
  "Mage-Arcane": "classicon_mage_arcane",
  "Mage-Fire": "classicon_mage_fire",
  "Mage-Frost": "classicon_mage_frost",
  "Warlock-Affliction": "classicon_warlock_affliction",
  "Warlock-Demonology": "classicon_warlock_demonology",
  "Warlock-Destruction": "classicon_warlock_destruction",
  "DeathKnight-Blood": "classicon_deathknight_blood",
  "DeathKnight-Frost": "classicon_deathknight_frost",
  "DeathKnight-Unholy": "classicon_deathknight_unholy",
  "DemonHunter-Havoc": "classicon_demonhunter_havoc",
  "DemonHunter-Vengeance": "classicon_demonhunter_vengeance",
};

function GameIcon({ name, size = 24 }: { name: string; size?: number }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className="rounded bg-[var(--border)] flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <User size={size * 0.5} className="text-[var(--muted)]" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://wow.zamimg.com/images/wow/icons/large/${name}.jpg`}
      alt={name}
      width={size}
      height={size}
      className="rounded flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

function formatClassName(subType: string): string {
  // Insert spaces before uppercase letters for display: DeathKnight -> Death Knight
  return subType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

interface PlayerSelectorProps {
  actors: Actor[];
  playerDetails?: PlayerInfo[];
  selectedSourceId: number | null;
  onSelect: (id: number) => void;
}

export function PlayerSelector({ actors, playerDetails, selectedSourceId, onSelect }: PlayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge actors with playerDetails to get spec info
  const players = actors
    .filter((a) => a.subType !== "Unknown")
    .map((a) => {
      const detail = playerDetails?.find((p) => p.name === a.name);
      const spec = detail?.icon?.split("-")[1] || null; // "Evoker-Preservation" → "Preservation"
      const specKey = spec ? `${a.subType}-${spec}` : null;
      return { ...a, spec, specKey };
    });

  const supported = players.filter((p) => p.specKey && SUPPORTED_SPECS.has(p.specKey));
  const others = players.filter((p) => !p.specKey || !SUPPORTED_SPECS.has(p.specKey));
  const selectedPlayer = players.find((p) => p.id === selectedSourceId);

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

  const renderPlayer = (player: typeof players[number]) => {
    const specIconName = player.specKey ? SPEC_ICONS[player.specKey] : null;
    return (
      <button
        key={player.id}
        type="button"
        onClick={() => {
          onSelect(player.id);
          setOpen(false);
        }}
        className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--border)] transition-colors ${
          player.id === selectedSourceId ? "bg-[var(--border)]" : ""
        }`}
      >
        <div className="flex items-center gap-1 flex-shrink-0">
          <GameIcon name={`classicon_${player.subType.toLowerCase()}`} size={22} />
          {specIconName && <GameIcon name={specIconName} size={18} />}
        </div>
        <span className="truncate flex-1 font-medium">{player.name}</span>
        <span className="text-xs font-medium" style={{ color: CLASS_COLORS[player.subType] || "var(--foreground)" }}>
          {player.spec ? `${formatClassName(player.subType)} ${player.spec}` : formatClassName(player.subType)}
        </span>
        <span className="text-xs text-[var(--muted)] truncate max-w-[100px]">{player.server}</span>
      </button>
    );
  };

  return (
    <div className="flex-1 min-w-[250px] relative" ref={containerRef}>
      <label className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1.5">
        <User size={12} /> Select Player
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] text-left flex items-center gap-2 hover:border-[var(--accent)] transition-colors"
      >
        {selectedPlayer ? (
          <>
            <div className="flex items-center gap-1 flex-shrink-0">
              <GameIcon name={`classicon_${selectedPlayer.subType.toLowerCase()}`} size={22} />
              {selectedPlayer.specKey && SPEC_ICONS[selectedPlayer.specKey] && (
                <GameIcon name={SPEC_ICONS[selectedPlayer.specKey]} size={18} />
              )}
            </div>
            <span className="truncate flex-1 font-medium">{selectedPlayer.name}</span>
            <span
              className="text-xs font-medium"
              style={{ color: CLASS_COLORS[selectedPlayer.subType] || "var(--foreground)" }}
            >
              {selectedPlayer.spec ? `${formatClassName(selectedPlayer.subType)} ${selectedPlayer.spec}` : formatClassName(selectedPlayer.subType)}
            </span>
            <span className="text-xs text-[var(--muted)]">{selectedPlayer.server}</span>
          </>
        ) : (
          <span className="text-[var(--muted)]">Choose a player...</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[400px] overflow-y-auto bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg">
          {/* Supported section */}
          {supported.length > 0 && (
            <div>
              <div className="sticky top-0 px-3 py-1.5 bg-[var(--background)] border-b border-[var(--border)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                Supported
              </div>
              <div className="border-l-2 border-green-500/50">
                {supported.map(renderPlayer)}
              </div>
            </div>
          )}

          {/* Other section */}
          {others.length > 0 && (
            <div>
              <div className="sticky top-0 px-3 py-1.5 bg-[var(--background)] border-b border-[var(--border)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wide flex items-center gap-2">
                Other
                <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                  (analysis not available)
                </span>
              </div>
              <div className="opacity-40">
                {others.map((player) => {
                  const specIconName = player.specKey ? SPEC_ICONS[player.specKey] : null;
                  return (
                    <div
                      key={player.id}
                      className="w-full px-3 py-2 text-sm flex items-center gap-2 cursor-not-allowed"
                    >
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <GameIcon name={`classicon_${player.subType.toLowerCase()}`} size={22} />
                        {specIconName && <GameIcon name={specIconName} size={18} />}
                      </div>
                      <span className="truncate flex-1 font-medium">{player.name}</span>
                      <span className="text-xs font-medium" style={{ color: CLASS_COLORS[player.subType] || "var(--foreground)" }}>
                        {player.spec ? `${formatClassName(player.subType)} ${player.spec}` : formatClassName(player.subType)}
                      </span>
                      <span className="text-xs text-[var(--muted)] truncate max-w-[100px]">{player.server}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
