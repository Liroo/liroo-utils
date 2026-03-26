import { AnalyzePageClient } from "@/features/log-analysis/components/analyze-page-client";

interface Props {
  params: Promise<{ reportCode: string }>;
  searchParams: Promise<{
    fight?: string;
    source?: string;
    code2?: string;
    fight2?: string;
    source2?: string;
  }>;
}

export default async function AnalyzeReportPage({ params, searchParams }: Props) {
  const { reportCode } = await params;
  const { fight, source, code2, fight2, source2 } = await searchParams;

  return (
    <AnalyzePageClient
      reportCode={reportCode}
      fightId={fight ? Number(fight) : null}
      sourceId={source ? Number(source) : null}
      compareCode={code2 || null}
      compareFightId={fight2 ? Number(fight2) : null}
      compareSourceId={source2 ? Number(source2) : null}
    />
  );
}
