"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredentialsStore } from "@/stores/credentials-store";
import { Search, Loader2 } from "lucide-react";
import { FightSelector } from "./fight-selector";
import { PlayerSelector } from "./player-selector";
import { CastTimeline } from "./cast-timeline";
import { useReport } from "../hooks/use-report";
import { useCastTimeline } from "../hooks/use-cast-timeline";
import { useDamageProfile } from "../hooks/use-damage-profile";
import { usePlayerDetails } from "../hooks/use-player-details";
import { parseWclUrl } from "@/lib/wcl-utils";

interface ReportAnalysisProps {
  reportCode: string;
  fightId: number | null;
  sourceId: number | null;
  /** Override fight/source selection (for compare panel) */
  onFightSelect?: (id: number) => void;
  onSourceSelect?: (id: number) => void;
  onReportChange?: (code: string, fight: number | null, source: number | null) => void;
}

export function ReportAnalysis({
  reportCode,
  fightId,
  sourceId,
  onFightSelect,
  onSourceSelect,
  onReportChange,
}: ReportAnalysisProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { clientId, clientSecret } = useCredentialsStore();

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useReport(reportCode, clientId, clientSecret);

  // Find selected fight info for timeline
  const selectedFight = report?.reportData?.report?.fights?.find(
    (f: { id: number }) => f.id === fightId
  );

  // Fetch player details for spec info when fight is selected
  const { data: playerDetailsRaw } = usePlayerDetails(
    reportCode,
    fightId,
    clientId,
    clientSecret
  );

  // Extract player info array from the nested WCL response
  const playerDetails = playerDetailsRaw?.reportData?.report?.playerDetails?.data?.playerDetails;
  // Flatten all roles into one array
  const allPlayers = playerDetails
    ? [
        ...(playerDetails.tanks || []),
        ...(playerDetails.healers || []),
        ...(playerDetails.dps || []),
      ]
    : undefined;

  const { data: timeline, isLoading: timelineLoading } = useCastTimeline(
    reportCode,
    selectedFight,
    sourceId,
    clientId,
    clientSecret
  );

  const { data: damageProfile, isLoading: damageProfileLoading } = useDamageProfile(
    reportCode,
    selectedFight,
    clientId,
    clientSecret
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseWclUrl(input);
    if (!parsed.code) return;

    if (onReportChange) {
      onReportChange(parsed.code, parsed.fight, parsed.source);
      return;
    }

    let url = `/analyze/${parsed.code}`;
    const params = new URLSearchParams();
    if (parsed.fight) params.set("fight", String(parsed.fight));
    if (parsed.fight && parsed.source)
      params.set("source", String(parsed.source));
    if (params.toString()) url += `?${params.toString()}`;

    router.push(url);
  };

  const handleFightSelect = (id: number) => {
    if (onFightSelect) {
      onFightSelect(id);
    } else {
      router.push(`/analyze/${reportCode}?fight=${id}`, { scroll: false });
    }
  };

  const handleSourceSelect = (id: number) => {
    if (onSourceSelect) {
      onSourceSelect(id);
    } else {
      router.push(`/analyze/${reportCode}?fight=${fightId}&source=${id}`, { scroll: false });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* URL Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste Warcraft Logs URL or report code..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Load
        </button>
      </form>

      {/* Error */}
      {reportError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-[var(--destructive)]">
          {reportError.message}
        </div>
      )}

      {/* Loading */}
      {reportLoading && (
        <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading report...
        </div>
      )}

      {/* Report loaded: show selectors */}
      {report && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 flex-wrap">
            <FightSelector
              fights={report.reportData.report.fights}
              selectedFightId={fightId}
              onSelect={handleFightSelect}
            />
            {fightId && (
              <PlayerSelector
                actors={report.reportData.report.masterData?.actors ?? []}
                playerDetails={allPlayers}
                selectedSourceId={sourceId}
                onSelect={handleSourceSelect}
              />
            )}
          </div>

          {/* Timeline */}
          {timelineLoading && (
            <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading cast
              timeline...
            </div>
          )}
          {timeline && (
            <CastTimeline
              data={timeline}
              actors={report.reportData.report.masterData?.actors ?? []}
              reportCode={reportCode}
              fightId={fightId ?? undefined}
              sourceId={sourceId ?? undefined}
              playerName={
                report.reportData.report.masterData?.actors?.find(
                  (a: { id: number; name: string }) => a.id === sourceId
                )?.name
              }
              damageProfile={damageProfile ?? undefined}
              encounterID={selectedFight?.encounterID}
            />
          )}

        </div>
      )}
    </div>
  );
}
