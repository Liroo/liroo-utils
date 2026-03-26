import type { Metadata } from "next";
import { Providers } from "@/providers";
import { AppShell } from "@/components/layout/app-shell";
import { CredentialsGate } from "@/components/credentials-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "WoW Log Analyzer",
  description: "Analyze your World of Warcraft logs to improve your gameplay",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <CredentialsGate>
            <AppShell>{children}</AppShell>
          </CredentialsGate>
        </Providers>
      </body>
    </html>
  );
}
