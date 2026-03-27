import { useQuery } from "@tanstack/react-query";

interface Fight {
  id: number;
  startTime: number;
  endTime: number;
}

async function fetchCastTimeline(
  code: string,
  fight: Fight,
  sourceID: number,
  clientId: string,
  clientSecret: string
) {
  const params = new URLSearchParams({
    code,
    fightID: String(fight.id),
    startTime: String(fight.startTime),
    endTime: String(fight.endTime),
    sourceID: String(sourceID),
  });
  const res = await fetch(`/api/wcl/casts?${params}`, {
    headers: {
      "x-wcl-client-id": clientId,
      "x-wcl-client-secret": clientSecret,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to load cast timeline");
  }
  return res.json();
}

export function useCastTimeline(
  code: string | null,
  fight: Fight | undefined,
  sourceID: number | null,
  clientId: string | null,
  clientSecret: string | null
) {
  return useQuery({
    queryKey: ["cast-timeline", code, fight?.id, sourceID],
    queryFn: () =>
      fetchCastTimeline(code!, fight!, sourceID!, clientId!, clientSecret!),
    enabled: !!code && !!fight && !!sourceID && !!clientId && !!clientSecret,
  });
}
