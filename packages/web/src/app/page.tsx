export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold text-[var(--accent)]">WoW Log Analyzer</h1>
      <p className="text-[var(--muted)]">Paste a Warcraft Logs report URL to get started.</p>
    </div>
  );
}
