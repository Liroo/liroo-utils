import { useQuery } from "@tanstack/react-query";

async function fetchPlayerDetails(
  code: string,
  fightID: number,
  clientId: string,
  clientSecret: string
) {
  const params = new URLSearchParams({
    code,
    fightIDs: String(fightID),
  });
  const res = await fetch(`/api/wcl/player-details?${params}`, {
    headers: {
      "x-wcl-client-id": clientId,
      "x-wcl-client-secret": clientSecret,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to load player details");
  }
  return res.json();
}

export function usePlayerDetails(
  code: string | null,
  fightID: number | null,
  clientId: string | null,
  clientSecret: string | null
) {
  return useQuery({
    queryKey: ["player-details", code, fightID],
    queryFn: () => fetchPlayerDetails(code!, fightID!, clientId!, clientSecret!),
    enabled: !!code && !!fightID && !!clientId && !!clientSecret,
  });
}
