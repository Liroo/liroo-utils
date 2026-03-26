"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

function parseWclUrl(input: string): {
  code: string | null;
  fight: number | null;
  source: number | null;
} {
  const urlMatch = input.match(/reports\/([a-zA-Z0-9]+)/);
  const code = urlMatch
    ? urlMatch[1]
    : /^[a-zA-Z0-9]+$/.test(input.trim())
      ? input.trim()
      : null;

  let fight: number | null = null;
  let source: number | null = null;

  if (code) {
    try {
      const url = new URL(input);
      const fightParam = url.searchParams.get("fight");
      const sourceParam = url.searchParams.get("source");
      if (fightParam) fight = Number(fightParam);
      if (sourceParam) source = Number(sourceParam);
    } catch {
      // Not a full URL, just a code
    }
  }

  return { code, fight, source };
}

export default function AnalyzePage() {
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseWclUrl(input);
    if (!parsed.code) return;

    let url = `/analyze/${parsed.code}`;
    const params = new URLSearchParams();
    if (parsed.fight) params.set("fight", String(parsed.fight));
    if (parsed.fight && parsed.source)
      params.set("source", String(parsed.source));
    if (params.toString()) url += `?${params.toString()}`;

    router.push(url);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste Warcraft Logs URL or report code..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Load
        </button>
      </form>
    </div>
  );
}
