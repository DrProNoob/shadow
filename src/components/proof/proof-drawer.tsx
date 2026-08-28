"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Check, CircleX, FileCheck2, X } from "lucide-react";
import type { ActionProof, EvidenceRecord } from "@/domain/model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function formatEvidenceValue(value: EvidenceRecord["value"]): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return value;
}

function formatTransitionScalar(value: unknown, key?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && key?.toLowerCase().endsWith("cents")) {
    return formatMoney(value);
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  try {
    return JSON.stringify(value);
  } catch {
    return "Structured value";
  }
}

function transitionLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function TransitionValue({
  value,
  align = "left",
}: {
  value: unknown;
  align?: "left" | "right";
}) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return (
      <dl className="grid gap-2">
        {Object.entries(value as Record<string, unknown>).map(
          ([key, entryValue]) => (
            <div key={key} className={align === "right" ? "text-right" : ""}>
              <dt className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                {transitionLabel(key)}
              </dt>
              <dd className="mt-0.5 break-words font-mono text-xs text-[var(--text-secondary)]">
                {formatTransitionScalar(entryValue, key)}
              </dd>
            </div>
          ),
        )}
      </dl>
    );
  }

  return (
    <p
      className={`break-words font-mono text-sm text-[var(--text-secondary)] ${align === "right" ? "text-right" : ""}`}
    >
      {formatTransitionScalar(value)}
    </p>
  );
}

function ProofSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--border)] py-6 first:border-t-0 first:pt-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type ProofDrawerProps = {
  open: boolean;
  proof: ActionProof | null;
  productName?: string;
  protectedTeamNames?: string[];
  onClose: () => void;
};

export function ProofDrawer({
  open,
  proof,
  productName = "Staged change",
  protectedTeamNames = ["Engineering"],
  onClose,
}: ProofDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const failedBlockers =
    proof?.checks.filter(
      (check) => !check.passed && check.severity === "hard-blocker",
    ) ?? [];
  const failedWarnings =
    proof?.checks.filter(
      (check) => !check.passed && check.severity === "advisory",
    ) ?? [];
  const blocked = failedBlockers.length > 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="proof-drawer-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[440px] border-0 border-l border-[var(--border)] bg-[var(--canvas)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/70 max-sm:max-w-none"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-5 border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-[var(--surface-raised)] ${blocked ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
            >
              {blocked ? (
                <CircleX
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--danger)]"
                />
              ) : (
                <FileCheck2
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--accent)]"
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Observable proof
              </p>
              <h2
                id="proof-drawer-title"
                className="mt-1 truncate text-base font-medium text-white"
              >
                {productName}
              </h2>
              {proof ? (
                <span
                  role="status"
                  className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] ${blocked ? "border-[var(--danger)] text-[var(--danger)]" : failedWarnings.length > 0 ? "border-[var(--warning)] text-[var(--warning)]" : "border-[var(--success)] text-[var(--success)]"}`}
                >
                  {blocked
                    ? "Commit blocked"
                    : failedWarnings.length > 0
                      ? "Review warning"
                      : `${proof.impact.risk} risk · checks pass`}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Close proof</span>
          </button>
        </header>

        {proof ? (
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
            <ProofSection title="User intent">
              <dl className="grid gap-3 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Savings target</dt>
                  <dd className="text-right font-mono text-white">
                    ≥
                    {percentFormatter.format(
                      proof.intent.minimumSavingsBasisPoints / 100,
                    )}
                    %
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Protected teams</dt>
                  <dd className="max-w-[220px] text-right text-white">
                    {protectedTeamNames.join(", ")}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Maximum penalty</dt>
                  <dd className="text-right font-mono text-white">
                    {formatMoney(proof.intent.maximumContractPenaltyCents)}
                  </dd>
                </div>
              </dl>
            </ProofSection>

            <ProofSection title="Evidence">
              <dl className="grid gap-3">
                {proof.evidence.map((record, index) => (
                  <div
                    key={`${record.kind}-${record.sourceId ?? record.label}-${index}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5"
                  >
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                      {record.label}
                    </dt>
                    <dd className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {formatEvidenceValue(record.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </ProofSection>

            <ProofSection title="Proposed change">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Before
                  </p>
                  <div className="mt-2">
                    <TransitionValue value={proof.transition.before} />
                  </div>
                </div>
                <span aria-hidden="true" className="text-[var(--accent)]">
                  →
                </span>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    After
                  </p>
                  <div className="mt-2">
                    <TransitionValue
                      value={proof.transition.after}
                      align="right"
                    />
                  </div>
                </div>
              </div>
            </ProofSection>

            <ProofSection title="Expected effect">
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Monthly savings
                  </dt>
                  <dd className="mt-2 font-mono text-sm text-[var(--success)]">
                    {formatMoney(proof.impact.monthlySavingsCents)}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Annual savings
                  </dt>
                  <dd className="mt-2 font-mono text-sm text-white">
                    {formatMoney(proof.impact.annualSavingsCents)}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Active affected
                  </dt>
                  <dd className="mt-2 font-mono text-sm text-white">
                    {proof.impact.activeUsersAffected}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Protected affected
                  </dt>
                  <dd
                    className={`mt-2 font-mono text-sm ${proof.impact.activeEngineeringUsersAffected > 0 ? "text-[var(--danger)]" : "text-white"}`}
                  >
                    {proof.impact.activeEngineeringUsersAffected}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Contract penalty
                  </dt>
                  <dd
                    className={`mt-2 font-mono text-sm ${proof.impact.contractPenaltyCents > 0 ? "text-[var(--danger)]" : "text-white"}`}
                  >
                    {formatMoney(proof.impact.contractPenaltyCents)}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    Risk
                  </dt>
                  <dd
                    className={`mt-2 text-sm capitalize ${proof.impact.risk === "high" ? "text-[var(--danger)]" : proof.impact.risk === "medium" ? "text-[var(--warning)]" : "text-[var(--success)]"}`}
                  >
                    {proof.impact.risk}
                  </dd>
                </div>
              </dl>
            </ProofSection>

            <ProofSection title="Constraint checks">
              <ul className="grid gap-2.5">
                {proof.checks.map((check) => (
                  <li
                    key={check.code}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5"
                  >
                    {check.passed ? (
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]"
                      />
                    ) : check.severity === "hard-blocker" ? (
                      <CircleX
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]"
                      />
                    ) : (
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-white">
                        {check.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-[var(--text-muted)]">
                        {check.message}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </ProofSection>

            <footer className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-[11px] leading-5 text-[var(--text-faint)]">
              Proof contains structured application facts, calculations, and
              checks. It never stores or reconstructs private model reasoning.
            </footer>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div>
              <p className="text-sm font-medium text-white">
                Proof unavailable
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                Select a projected change after its evidence has been
                calculated.
              </p>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
