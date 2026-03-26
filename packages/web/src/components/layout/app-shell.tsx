import { Header } from "./header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Header />
      <main className="flex-1 overflow-y-auto p-6 pb-[50vh]">{children}</main>
    </div>
  );
}
