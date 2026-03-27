import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 60 * 1000, // 30min — WCL data doesn't change
        gcTime: 60 * 60 * 1000, // 1h garbage collection
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}
