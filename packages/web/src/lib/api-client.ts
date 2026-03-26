const API_BASE = "/api/wcl";

export function createApiClient(clientId: string, clientSecret: string) {
  async function fetchAPI<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        "x-wcl-client-id": clientId,
        "x-wcl-client-secret": clientSecret,
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `API error: ${res.status}`);
    }
    return res.json();
  }

  return {
    getReport: (code: string) => fetchAPI(`/report`, { code }),
    getTimeline: (params: { code: string; fightID: string; startTime: string; endTime: string; sourceID: string; playerName: string }) =>
      fetchAPI(`/timeline`, params),
  };
}
