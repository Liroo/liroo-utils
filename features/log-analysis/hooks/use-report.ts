import { useQuery } from "@tanstack/react-query";

async function fetchReport(
  code: string,
  clientId: string,
  clientSecret: string
) {
  const res = await fetch(`/api/wcl/report?code=${code}`, {
    headers: {
      "x-wcl-client-id": clientId,
      "x-wcl-client-secret": clientSecret,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to load report");
  }
  return res.json();
}

export function useReport(
  code: string | null,
  clientId: string | null,
  clientSecret: string | null
) {
  return useQuery({
    queryKey: ["report", code],
    queryFn: () => fetchReport(code!, clientId!, clientSecret!),
    enabled: !!code && !!clientId && !!clientSecret,
  });
}
