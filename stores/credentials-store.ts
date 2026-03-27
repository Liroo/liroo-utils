import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CredentialsState {
  clientId: string | null;
  clientSecret: string | null;
  isConfigured: boolean;
  setCredentials: (clientId: string, clientSecret: string) => void;
  clearCredentials: () => void;
}

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set) => ({
      clientId: null,
      clientSecret: null,
      isConfigured: false,
      setCredentials: (clientId, clientSecret) =>
        set({ clientId, clientSecret, isConfigured: true }),
      clearCredentials: () =>
        set({ clientId: null, clientSecret: null, isConfigured: false }),
    }),
    { name: "wcl-credentials" }
  )
);
