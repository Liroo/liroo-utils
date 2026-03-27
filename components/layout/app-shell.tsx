import { Header } from "./header";
import { Footer } from "./footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="p-6">
        {children}
        <Footer />
      </main>
    </div>
  );
}
