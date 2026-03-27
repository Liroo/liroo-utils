"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { parseWclUrl } from "@/lib/wcl-utils";

export default function HomePage() {
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
