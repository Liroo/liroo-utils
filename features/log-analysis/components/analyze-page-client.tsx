"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, X } from "lucide-react";
import { ReportAnalysis } from "./report-analysis";
import { parseWclUrl } from "@/lib/wcl-utils";

interface Props {
  reportCode: string;
  fightId: number | null;
  sourceId: number | null;
  compareCode: string | null;
  compareFightId: number | null;
  compareSourceId: number | null;
}

export function AnalyzePageClient({
  reportCode,
  fightId,
  sourceId,
  compareCode,
  compareFightId,
  compareSourceId,
}: Props) {
  const router = useRouter();
  const [compareInput, setCompareInput] = useState("");
  const hasCompare = compareCode !== null;

  // Build URL with current + compare params
  const buildUrl = (
    main: { code: string; fight: number | null; source: number | null },
    compare: { code: string | null; fight: number | null; source: number | null } | null
  ) => {
    let url = `/analyze/${main.code}`;
    const params = new URLSearchParams();
    if (main.fight) params.set("fight", String(main.fight));
    if (main.fight && main.source) params.set("source", String(main.source));
    if (compare?.code) {
      params.set("code2", compare.code);
      if (compare.fight) params.set("fight2", String(compare.fight));
      if (compare.fight && compare.source) params.set("source2", String(compare.source));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return url;
  };

  const handleAddCompare = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseWclUrl(compareInput);
    if (!parsed.code) return;
    const url = buildUrl(
      { code: reportCode, fight: fightId, source: sourceId },
      { code: parsed.code, fight: parsed.fight, source: parsed.source }
    );
    router.push(url, { scroll: false });
  };

  const handleRemoveCompare = () => {
    const url = buildUrl(
      { code: reportCode, fight: fightId, source: sourceId },
      null
    );
    router.push(url, { scroll: false });
  };

  // Callback for changing the main report while preserving compare
  const handleMainReportChange = (code: string, fight: number | null, source: number | null) => {
    const url = buildUrl(
      { code, fight, source },
      { code: compareCode, fight: compareFightId, source: compareSourceId }
    );
    router.push(url, { scroll: false });
  };

  // Callback for changing the compare report while preserving main
  const handleCompareReportChange = (code: string, fight: number | null, source: number | null) => {
    const url = buildUrl(
      { code: reportCode, fight: fightId, source: sourceId },
      { code, fight, source }
    );
    router.push(url, { scroll: false });
  };

  // Callbacks for compare panel's fight/source selection
  const handleCompareFightSelect = (id: number) => {
    const url = buildUrl(
      { code: reportCode, fight: fightId, source: sourceId },
      { code: compareCode, fight: id, source: null }
    );
    router.push(url, { scroll: false });
  };

  const handleCompareSourceSelect = (id: number) => {
    const url = buildUrl(
      { code: reportCode, fight: fightId, source: sourceId },
      { code: compareCode, fight: compareFightId, source: id }
    );
    router.push(url, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {hasCompare ? (
        <>
          {/* Side by side */}
          <div className="grid grid-cols-2 gap-4 min-h-0">
            <div className="flex flex-col min-w-0">
              <div className="text-xs text-[var(--muted)] mb-2 font-medium uppercase tracking-wide">Player 1</div>
              <ReportAnalysis
                reportCode={reportCode}
                fightId={fightId}
                sourceId={sourceId}
                onReportChange={handleMainReportChange}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Player 2</span>
                <button
                  onClick={handleRemoveCompare}
                  className="text-[var(--muted)] hover:text-[var(--destructive)] transition-colors"
                  title="Remove comparison"
                >
                  <X size={14} />
                </button>
              </div>
              <ReportAnalysis
                reportCode={compareCode!}
                fightId={compareFightId}
                sourceId={compareSourceId}
                onFightSelect={handleCompareFightSelect}
                onSourceSelect={handleCompareSourceSelect}
                onReportChange={handleCompareReportChange}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <ReportAnalysis
            reportCode={reportCode}
            fightId={fightId}
            sourceId={sourceId}
          />
          <div className="border border-dashed border-[var(--border)] rounded-lg p-4">
            <form onSubmit={handleAddCompare} className="flex items-center gap-3">
              <GitCompare size={16} className="text-[var(--muted)] flex-shrink-0" />
              <input
                type="text"
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
                placeholder="Paste a WCL URL to compare..."
                className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Compare
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
