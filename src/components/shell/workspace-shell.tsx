"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleDot,
  FileText,
  GitCompareArrows,
  History,
  RotateCcw,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  commitShadow,
  UI_COMMIT_CONFIRMATION,
} from "@/application/commit-service";
import {
  CommitShadowDialog,
  type CommitDialogConfirmation,
  type CommitShadowView,
} from "@/components/commit";
import { ShadowWordmark } from "@/components/shell/shadow-logo";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { projectShadow } from "@/domain/projection";

const realityNavigation = [
  { href: "/", label: "Overview", icon: CircleDot },
  { href: "/subscriptions", label: "Subscriptions", icon: WalletCards },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/people", label: "People", icon: Users },
  { href: "/receipts", label: "Receipts", icon: History },
] as const satisfies readonly {
  href: Route;
  label: string;
  icon: typeof CircleDot;
}[];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const {
    workspace,
    store,
    webMcpStatus,
    activeShadowId,
    selectReality,
    selectShadow,
  } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [commitOpen, setCommitOpen] = useState(false);
  const shadows = Object.values(workspace.shadows);
  const activeShadow = activeShadowId
    ? workspace.shadows[activeShadowId]
    : undefined;
  const activeProjectionResult = activeShadow
    ? projectShadow(workspace.reality, activeShadow, workspace.catalog)
    : null;
  const activeProjection = activeProjectionResult?.ok
    ? activeProjectionResult.value
    : null;
  const commitReview: CommitShadowView | null =
    activeShadow &&
    activeProjection &&
    activeShadow.status === "draft" &&
    activeShadow.baseRealityVersion === workspace.reality.version &&
    activeShadow.changes.length > 0
      ? {
          shadowId: activeShadow.id,
          shadowName: activeShadow.name,
          shadowRevision: activeShadow.revision,
          realityVersionBefore: workspace.reality.version,
          changeCount: activeProjection.changes.length,
          totalImpact: activeProjection.totalImpact,
          blockers: activeProjection.hardBlockers,
          warnings: activeProjection.warnings,
        }
      : null;

  async function handleCommit(confirmation: CommitDialogConfirmation) {
    const current = store.getSnapshot().workspace;
    const currentShadow = current.shadows[confirmation.shadowId];
    if (
      current.reality.version !== confirmation.expectedRealityVersion ||
      currentShadow?.revision !== confirmation.expectedShadowRevision
    ) {
      throw new Error(
        "Reality or this Shadow changed during review. Reopen commit and review the latest projection.",
      );
    }
    const result = commitShadow(current, {
      shadowId: confirmation.shadowId,
      confirmation: UI_COMMIT_CONFIRMATION,
      acknowledgeWarnings: confirmation.acknowledgedAdvisoryCodes.length > 0,
    });
    if (!result.ok) throw new Error(result.error.message);
    store.replace(result.value.workspace);
    setCommitOpen(false);
    selectReality();
    router.push(`/receipts/${result.value.receipt.id}`);
  }

  function handleReset() {
    store.reset();
    setCommitOpen(false);
    selectReality();
    router.push("/");
  }

  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--text-primary)]">
      <a
        href="#workspace-main"
        className="sr-only fixed top-3 left-3 z-50 rounded-md bg-white px-3 py-2 text-sm font-semibold text-black focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:var(--canvas)] px-4 md:px-6">
        <ShadowWordmark />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectReality}
            className="hidden h-9 items-center gap-2 rounded-md px-2 text-xs text-[var(--text-muted)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:flex"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${activeShadow ? "bg-[var(--accent)]" : "bg-[var(--success)]"}`}
            />
            {activeShadow
              ? `${activeShadow.name} · based on v${activeShadow.baseRealityVersion}`
              : `Reality v${workspace.reality.version}`}
          </button>
          <Link
            aria-label="Compare"
            href={{
              pathname: "/compare",
              query:
                shadows.length >= 2
                  ? { left: shadows[0].id, right: shadows[1].id }
                  : undefined,
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <GitCompareArrows aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compare</span>
          </Link>
          <button
            type="button"
            aria-label="Reset demo"
            onClick={handleReset}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset demo</span>
          </button>
          <button
            type="button"
            disabled={!commitReview}
            title={
              commitReview
                ? `Review ${commitReview.shadowName} before commit`
                : "Select a current Shadow with staged changes to commit"
            }
            onClick={() => setCommitOpen(true)}
            className="h-9 rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Commit
          </button>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1720px] md:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[224px_minmax(0,1fr)_340px]">
        <aside className="hidden border-r border-[var(--border)] px-4 py-7 md:block">
          <nav aria-label="Workspace navigation" className="space-y-7">
            <section>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                Reality
              </p>
              {realityNavigation.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/receipts"
                    ? pathname.startsWith("/receipts")
                    : pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={selectReality}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      active
                        ? "bg-[var(--surface-raised)] text-white"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-white"
                    }`}
                  >
                    <Icon
                      aria-hidden="true"
                      className={`h-4 w-4 ${active ? "text-[var(--accent)]" : "text-[var(--text-faint)]"}`}
                    />
                    {label}
                  </Link>
                );
              })}
            </section>

            <section>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                Shadows
              </p>
              {shadows.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-xs leading-5 text-[var(--text-faint)]">
                  No futures staged yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {shadows.map((shadow) => {
                    const active = shadow.id === activeShadowId;
                    const stale =
                      shadow.baseRealityVersion !== workspace.reality.version;
                    const committed = shadow.status === "committed";
                    return (
                      <button
                        key={shadow.id}
                        type="button"
                        onClick={() => selectShadow(shadow.id)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                          active
                            ? "bg-[color:rgba(77,141,255,0.11)] text-white"
                            : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-white"
                        }`}
                      >
                        <span className="truncate">{shadow.name}</span>
                        {stale || committed ? (
                          <span
                            className={`text-[8px] font-semibold uppercase tracking-[0.1em] ${committed ? "text-[var(--success)]" : "text-[var(--warning)]"}`}
                          >
                            {committed ? "Committed" : "Stale"}
                          </span>
                        ) : (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--accent)]" : "bg-[var(--text-faint)]"}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </nav>
        </aside>

        <main
          id="workspace-main"
          tabIndex={-1}
          className="min-w-0 px-4 py-6 outline-none sm:px-7 sm:py-8 lg:px-10 lg:py-10"
        >
          <nav
            aria-label="Mobile workspace navigation"
            className="-mx-1 mb-7 flex gap-1 overflow-x-auto pb-1 md:hidden"
          >
            {realityNavigation.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/receipts"
                  ? pathname.startsWith("/receipts")
                  : pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={selectReality}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                    active
                      ? "border-[var(--border-strong)] bg-[var(--surface-raised)] text-white"
                      : "border-transparent text-[var(--text-muted)]"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
          {shadows.length > 0 ? (
            <section
              aria-labelledby="mobile-context-heading"
              className="mb-7 md:hidden"
            >
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2
                  id="mobile-context-heading"
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]"
                >
                  Viewing context
                </h2>
                <span className="text-[10px] text-[var(--text-faint)]">
                  Reality stays unchanged
                </span>
              </div>
              <div
                role="group"
                aria-label="Reality and Shadow context"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              >
                <button
                  type="button"
                  aria-pressed={!activeShadowId}
                  onClick={selectReality}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                    !activeShadowId
                      ? "border-[color:rgba(56,201,151,0.38)] bg-[color:rgba(56,201,151,0.07)] text-white"
                      : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${!activeShadowId ? "bg-[var(--success)]" : "bg-[var(--text-faint)]"}`}
                  />
                  Reality v{workspace.reality.version}
                </button>
                {shadows.map((shadow) => {
                  const active = shadow.id === activeShadowId;
                  const stale =
                    shadow.baseRealityVersion !== workspace.reality.version;
                  return (
                    <button
                      key={shadow.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectShadow(shadow.id)}
                      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                        active
                          ? "border-[color:rgba(77,141,255,0.45)] bg-[color:rgba(77,141,255,0.1)] text-white"
                          : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--accent)]" : "bg-[var(--text-faint)]"}`}
                      />
                      <span>{shadow.name}</span>
                      {stale || shadow.status === "committed" ? (
                        <span
                          className={`text-[8px] font-semibold uppercase tracking-[0.1em] ${shadow.status === "committed" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}
                        >
                          {shadow.status === "committed"
                            ? "Committed"
                            : "Stale"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          {children}
        </main>

        <aside className="hidden border-l border-[var(--border)] px-6 py-8 xl:block">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-sm font-medium">Site tools</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            The browser agent reads the same versioned workspace shown here.
          </p>
          <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                get_company_summary
              </span>
              <span
                data-testid="webmcp-status"
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
              >
                {webMcpStatus === "ready"
                  ? "Ready"
                  : webMcpStatus === "checking"
                    ? "Checking"
                    : "Fallback"}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-faint)]">
              13 semantic tools · Reality v{workspace.reality.version}
            </p>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <Link
              href="/tool-lab"
              className="mt-3 inline-flex text-xs text-[var(--accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Open development Tool Lab →
            </Link>
          ) : null}
          {webMcpStatus === "unavailable" && (
            <p className="mt-4 text-xs leading-5 text-[var(--text-faint)]">
              Site tools are unavailable in this browser. The application
              remains fully usable.
            </p>
          )}

          <section className="mt-9 border-t border-[var(--border)] pt-7">
            <h2 className="text-sm font-medium">Application activity</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              Observable commands only—never private model reasoning.
            </p>
            {workspace.activity.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-4 text-xs leading-5 text-[var(--text-faint)]">
                No Shadow commands yet.
              </div>
            ) : (
              <ol
                className="mt-4 space-y-2"
                aria-label="Recent application activity"
              >
                {workspace.activity
                  .slice(-4)
                  .reverse()
                  .map((event) => (
                    <li
                      key={event.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-[10px] text-[var(--text-secondary)]">
                          {event.commandName}
                        </span>
                        <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--accent)]">
                          {event.source}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
                        {event.shadowId} · revision {event.shadowRevision}
                      </p>
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
      {commitReview && commitOpen ? (
        <CommitShadowDialog
          open
          review={commitReview}
          onClose={() => setCommitOpen(false)}
          onCommit={handleCommit}
        />
      ) : null}
    </div>
  );
}
