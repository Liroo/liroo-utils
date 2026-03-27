"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Flame } from "lucide-react";
import type {
  DamageProfileResult,
  EnemyTimeline,
  EnemyAbility,
  DamageSpike,
} from "@/lib/wlogs/types/wcl-responses";

interface DamageProfileProps {
  data: DamageProfileResult;
}

function iconUrl(abilityIcon: string): string {
  return `https://wow.zamimg.com/images/wow/icons/large/${abilityIcon.replace(/\.jpg$/, "")}.jpg`;
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDamage(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtDps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M/s`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k/s`;
  return `${Math.round(n)}/s`;
}

// --- Enemy Ability Row ---

function AbilityRow({ ability, fightDuration }: { ability: EnemyAbility; fightDuration: number }) {
  const pctPerMs = 100 / fightDuration;

  return (
    <div className="flex items-center gap-3 py-1.5 group">
      {/* Icon + name */}
      <a
        href={`https://www.wowhead.com/spell=${ability.abilityGameID}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 min-w-[200px] shrink-0"
        data-wowhead={`spell=${ability.abilityGameID}`}
      >
        {ability.icon && (
          <img
            src={iconUrl(ability.icon)}
            alt={ability.name}
            className="w-5 h-5 rounded-sm border border-[var(--border)]"
          />
        )}
        <span className="text-xs text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
          {ability.name}
        </span>
      </a>

      {/* Stats */}
      <span className="text-[10px] text-[var(--muted)] min-w-[60px] text-right shrink-0">
        {fmtDamage(ability.totalDamage)}
      </span>
      <span className="text-[10px] text-[var(--muted)] min-w-[30px] text-right shrink-0">
        {ability.hitCount}x
      </span>

      {/* Timeline bar */}
      <div className="flex-1 relative h-4 bg-[var(--card)] rounded-sm border border-[var(--border)] overflow-hidden">
        {ability.hits.map((hit, i) => {
          const left = hit.timestamp * pctPerMs;
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-[2px] bg-[#f85149] opacity-70 hover:opacity-100 transition-opacity"
              style={{ left: `${left}%` }}
              title={`${fmtTime(hit.timestamp)} — ${fmtDamage(hit.totalDamage)} (${hit.targetsHit} target${hit.targetsHit > 1 ? "s" : ""})`}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Enemy Section (collapsible) ---

function EnemySection({ enemy, fightDuration }: { enemy: EnemyTimeline; fightDuration: number }) {
  const [open, setOpen] = useState(enemy.isMainBoss);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-[var(--card)] hover:bg-[var(--card-hover)] transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-[var(--muted)] shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[var(--muted)] shrink-0" />
        )}
        <span className="text-sm font-medium text-[var(--foreground)] flex-1">
          {enemy.name}
          {enemy.isMainBoss && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
              Boss
            </span>
          )}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {fmtDamage(enemy.totalDamage)} total
        </span>
        <span className="text-xs text-[var(--muted)]">
          {enemy.abilities.length} abilities
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--background)]">
          {enemy.abilities.map((ability) => (
            <AbilityRow
              key={ability.abilityGameID}
              ability={ability}
              fightDuration={fightDuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Spike Card ---

function SpikeCard({ spike }: { spike: DamageSpike }) {
  const isHigh = spike.severity === "high";
  const borderColor = isHigh ? "border-red-500/40" : "border-yellow-500/30";
  const bgColor = isHigh ? "bg-red-500/5" : "bg-yellow-500/5";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${borderColor} ${bgColor}`}>
      {/* Severity icon */}
      <div className="shrink-0 mt-0.5">
        {isHigh ? (
          <Flame size={16} className="text-red-400" />
        ) : (
          <AlertTriangle size={16} className="text-yellow-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
            isHigh ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
          }`}>
            {spike.severity}
          </span>
          <span className="text-xs text-[var(--foreground)]">
            {fmtTime(spike.startTime)} — {fmtTime(spike.endTime)}
          </span>
          <span className="text-xs text-[var(--muted)]">
            ({(spike.duration / 1000).toFixed(1)}s)
          </span>
        </div>

        <div className="flex items-center gap-4 mt-1">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {fmtDamage(spike.totalDamage)}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {fmtDps(spike.dtps)}
          </span>
        </div>

        {/* Top abilities */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {spike.topAbilities.map((ability) => (
            <a
              key={ability.abilityGameID}
              href={`https://www.wowhead.com/spell=${ability.abilityGameID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              data-wowhead={`spell=${ability.abilityGameID}`}
            >
              {ability.icon && (
                <img
                  src={iconUrl(ability.icon)}
                  alt={ability.name}
                  className="w-4 h-4 rounded-sm border border-[var(--border)]"
                />
              )}
              <span>{ability.name}</span>
              <span className="text-[var(--muted)]">({fmtDamage(ability.damage)})</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

declare global {
  interface Window {
    $WowheadPower?: { refreshLinks?: () => void };
  }
}

export function DamageProfile({ data }: DamageProfileProps) {
  const [showAllSpikes, setShowAllSpikes] = useState(false);
  const visibleSpikes = showAllSpikes ? data.spikes : data.spikes.slice(0, 10);

  // Refresh Wowhead tooltips when content changes
  useEffect(() => {
    window.$WowheadPower?.refreshLinks?.();
  }, [data, showAllSpikes]);

  return (
    <div className="flex flex-col gap-6">
      {/* Boss / Adds Timelines */}
      <div>
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
          Boss Timers
          <span className="text-[10px] text-[var(--muted)] font-normal">
            {data.enemies.length} source{data.enemies.length > 1 ? "s" : ""}
          </span>
        </h3>
        <div className="flex flex-col gap-2">
          {data.enemies.map((enemy) => (
            <EnemySection
              key={enemy.sourceID}
              enemy={enemy}
              fightDuration={data.fightDuration}
            />
          ))}
        </div>
      </div>

      {/* Damage Spikes */}
      {data.spikes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
            Damage Spikes
            <span className="text-[10px] text-[var(--muted)] font-normal">
              {data.spikes.filter((s) => s.severity === "high").length} high,{" "}
              {data.spikes.filter((s) => s.severity === "medium").length} medium
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            {visibleSpikes.map((spike, i) => (
              <SpikeCard key={i} spike={spike} />
            ))}
          </div>
          {data.spikes.length > 10 && !showAllSpikes && (
            <button
              onClick={() => setShowAllSpikes(true)}
              className="mt-2 text-xs text-[var(--accent)] hover:underline"
            >
              Show all {data.spikes.length} spikes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
