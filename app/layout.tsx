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
      <head>
        <script dangerouslySetInnerHTML={{ __html: `const whTooltips = {colorLinks: true, iconizeLinks: false, renameLinks: false};` }} />
        <script src="https://wow.zamimg.com/js/tooltips.js" async />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          <CredentialsGate>
            <AppShell>{children}</AppShell>
          </CredentialsGate>
        </Providers>
      </body>
    </html>
  );
}
