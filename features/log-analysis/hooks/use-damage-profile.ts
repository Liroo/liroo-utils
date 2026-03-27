import { useQuery } from "@tanstack/react-query";
import type { DamageProfileResult } from "@/lib/wlogs/types/wcl-responses";

interface Fight {
  id: number;
  startTime: number;
  endTime: number;
}

async function fetchDamageProfile(
  code: string,
  fight: Fight,
  clientId: string,
  clientSecret: string
): Promise<DamageProfileResult> {
  const params = new URLSearchParams({
    code,
    fightID: String(fight.id),
    startTime: String(fight.startTime),
    endTime: String(fight.endTime),
  });
  const res = await fetch(`/api/wcl/damage-profile?${params}`, {
    headers: {
      "x-wcl-client-id": clientId,
      "x-wcl-client-secret": clientSecret,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to load damage profile");
  }
  return res.json();
}

export function useDamageProfile(
  code: string | null,
  fight: Fight | undefined,
  clientId: string | null,
  clientSecret: string | null
) {
  return useQuery({
    queryKey: ["damage-profile", code, fight?.id],
    queryFn: () =>
      fetchDamageProfile(code!, fight!, clientId!, clientSecret!),
    enabled: !!code && !!fight && !!clientId && !!clientSecret,
  });
}
