"use client";

import { useUIStore } from "@/stores/ui-store";
import { BarChart3, Clock, GitCompare, Home } from "lucide-react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/analyze", label: "Analyze", icon: BarChart3 },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/compare", label: "Compare", icon: GitCompare },
];

export function Sidebar() {
  const { sidebarOpen } = useUIStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="w-56 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
      <div className="p-4 border-b border-[var(--border)]">
        <h1 className="text-sm font-bold text-[var(--accent)] tracking-wide">WOW LOG ANALYZER</h1>
      </div>
      <nav className="flex-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
