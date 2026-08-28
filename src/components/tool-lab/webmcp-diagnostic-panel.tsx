"use client";

import { useSyncExternalStore } from "react";
import { webMcpDiagnostics } from "@/webmcp/diagnostics";

export function WebMcpDiagnosticPanel() {
  const events = useSyncExternalStore(
    webMcpDiagnostics.subscribe,
    webMcpDiagnostics.getSnapshot,
    webMcpDiagnostics.getServerSnapshot,
  );
  const recent = events.slice(-8).reverse();

  return (
    <aside
      data-testid="webmcp-diagnostics"
      className="fixed right-4 bottom-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-2xl backdrop-blur"
      aria-label="WebMCP diagnostics"
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          WebMCP diagnostics
        </strong>
        <span className="text-[10px] text-[var(--text-faint)]">temporary</span>
      </div>
      {recent.length === 0 ? (
        <p className="mt-2 text-[10px] text-[var(--text-faint)]">No WebMCP events yet.</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {recent.map((event) => (
            <li key={event.id} className="rounded border border-[var(--border)] px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                <span className="truncate text-[var(--text-secondary)]">{event.tool}</span>
                <span className={event.status === "error" ? "text-[var(--warning)]" : "text-[var(--accent)]"}>
                  {event.source}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[var(--text-faint)]">
                <span>{event.phase}</span>
                <span>{event.status}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
