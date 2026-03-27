export function Header() {
  return (
    <header className="h-12 border-b border-[var(--border)] bg-[var(--card)] flex items-center px-6">
      <span className="text-sm font-semibold text-[var(--accent)]">WoW Log Analyzer</span>
      <span className="text-xs text-[var(--muted)] ml-3">Preservation Evoker</span>
    </header>
  );
}
