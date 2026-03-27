"use client";

import { useState } from "react";
import { useCredentialsStore } from "@/stores/credentials-store";
import { KeyRound } from "lucide-react";

export function CredentialsGate({ children }: { children: React.ReactNode }) {
  const { isConfigured, setCredentials } = useCredentialsStore();
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  if (isConfigured) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !secret.trim()) {
      setError("Both fields are required");
      return;
    }
    setCredentials(id.trim(), secret.trim());
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[var(--background)]">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-[var(--card)] border border-[var(--border)] rounded-lg">
        <div className="flex items-center gap-3 mb-6">
          <KeyRound size={24} className="text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--foreground)]">WCL API Credentials</h1>
        </div>
        <p className="text-sm text-[var(--muted)] mb-6">
          Enter your Warcraft Logs API credentials. Create them at{" "}
          <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">
            warcraftlogs.com/api/clients
          </a>
        </p>
        {error && <p className="text-sm text-[var(--destructive)] mb-4">{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Client ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Client Secret</label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••••••••••••••"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            Save & Continue
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-4">
          Credentials are stored locally in your browser. They are never sent to our servers — only to the Warcraft Logs API via our proxy.
        </p>
      </form>
    </div>
  );
}
