"use client";

import { useCredentialsStore } from "@/stores/credentials-store";

export function Footer() {
  const { clearCredentials } = useCredentialsStore();

  return (
    <footer className="mt-12 py-4 border-t border-[var(--border)] text-[11px] text-[var(--muted)]">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <span>
            Made with <span className="text-red-500">&#10084;</span> by{" "}
            <a
              href="https://github.com/liroo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Liroo
            </a>
          </span>
          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/liroo/liroo-utils"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Source code
            </a>
            <span>|</span>
            <a
              href="https://buymeacoffee.com/liroo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Buy me a &#9749;
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end text-right">
          <button
            onClick={clearCredentials}
            className="text-[var(--accent)] hover:underline"
          >
            Reset the store
          </button>
          <span>
            This website is not affiliated with WarcraftLogs. Subject to bugs.
          </span>
        </div>
      </div>
    </footer>
  );
}
