"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleX,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ConstraintCheck, Impact, ShadowId } from "@/domain/model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export type CommitShadowView = {
  shadowId: ShadowId;
  shadowName: string;
  shadowRevision: number;
  realityVersionBefore: number;
  changeCount: number;
  totalImpact: Impact;
  blockers: ConstraintCheck[];
  warnings: ConstraintCheck[];
};

export type CommitDialogConfirmation = {
  shadowId: ShadowId;
  expectedRealityVersion: number;
  expectedShadowRevision: number;
  acknowledgedAdvisoryCodes: string[];
};

export type CommitShadowDialogProps = {
  open: boolean;
  review: CommitShadowView;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onCommit: (confirmation: CommitDialogConfirmation) => void | Promise<void>;
};

function ConstraintList({
  title,
  checks,
  kind,
}: {
  title: string;
  checks: ConstraintCheck[];
  kind: "blocker" | "warning";
}) {
  if (checks.length === 0) return null;

  return (
    <section
      className={`rounded-xl border p-4 ${kind === "blocker" ? "border-[var(--danger)] bg-[color:var(--danger)]/5" : "border-[var(--warning)] bg-[color:var(--warning)]/5"}`}
      aria-labelledby={`commit-${kind}-title`}
    >
      <div className="flex items-start gap-2.5">
        {kind === "blocker" ? (
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
        <div className="min-w-0">
          <h3
            id={`commit-${kind}-title`}
            className={`text-xs font-medium ${kind === "blocker" ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
          >
            {title}
          </h3>
          <ul className="mt-2 grid gap-2">
            {checks.map((check) => (
              <li
                key={check.code}
                className="text-[11px] leading-5 text-[var(--text-muted)]"
              >
                <span className="font-medium text-[var(--text-secondary)]">
                  {check.label}:
                </span>{" "}
                {check.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function CommitShadowDialog({
  open,
  review,
  pending = false,
  error,
  onClose,
  onCommit,
}: CommitShadowDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [advisoriesAcknowledged, setAdvisoriesAcknowledged] = useState(false);
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const blocked = review.blockers.length > 0;
  const needsAdvisoryAcknowledgement = review.warnings.length > 0;
  const isPending = pending || localPending;
  const canCommit =
    !blocked &&
    review.changeCount > 0 &&
    confirmed &&
    (!needsAdvisoryAcknowledgement || advisoriesAcknowledged) &&
    !isPending;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function resetDialogState() {
    setConfirmed(false);
    setAdvisoriesAcknowledged(false);
    setLocalPending(false);
    setLocalError(null);
  }

  function requestClose() {
    if (isPending) return;
    dialogRef.current?.close();
  }

  async function commit() {
    if (!canCommit) return;
    setLocalPending(true);
    setLocalError(null);
    try {
      await onCommit({
        shadowId: review.shadowId,
        expectedRealityVersion: review.realityVersionBefore,
        expectedShadowRevision: review.shadowRevision,
        acknowledgedAdvisoryCodes: advisoriesAcknowledged
          ? review.warnings.map((warning) => warning.code)
          : [],
      });
      dialogRef.current?.close();
    } catch (commitError) {
      setLocalError(
        commitError instanceof Error
          ? commitError.message
          : "Reality could not be updated.",
      );
    } finally {
      setLocalPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="commit-shadow-title"
      className="m-auto w-[min(680px,calc(100%-2rem))] max-w-none rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/75 max-sm:h-[calc(100dvh-2rem)] max-sm:w-[calc(100%-1rem)] max-sm:rounded-xl"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        resetDialogState();
        if (open) onClose();
      }}
    >
      <div className="flex max-h-[min(850px,calc(100dvh-2rem))] flex-col max-sm:h-full max-sm:max-h-none">
        <header className="flex items-start justify-between gap-5 border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-[var(--surface-raised)] ${blocked ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
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
                Human commit
              </p>
              <h2
                id="commit-shadow-title"
                className="mt-1 truncate text-lg font-medium text-white"
              >
                Commit {review.shadowName}
              </h2>
              <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                Reality v{review.realityVersionBefore} → v
                {review.realityVersionBefore + 1}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={requestClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Close commit review</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                Changes
              </p>
              <p className="mt-2 font-mono text-lg text-white">
                {review.changeCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                Annual savings
              </p>
              <p className="mt-2 font-mono text-lg text-[var(--success)]">
                {formatMoney(review.totalImpact.annualSavingsCents)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                Savings
              </p>
              <p className="mt-2 font-mono text-lg text-white">
                {percentageFormatter.format(
                  review.totalImpact.savingsBasisPoints / 100,
                )}
                %
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                Active affected
              </p>
              <p
                className={`mt-2 font-mono text-lg ${review.totalImpact.activeUsersAffected > 0 ? "text-[var(--warning)]" : "text-white"}`}
              >
                {review.totalImpact.activeUsersAffected}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <ConstraintList
              title="Hard blockers cannot be overridden"
              checks={review.blockers}
              kind="blocker"
            />
            <ConstraintList
              title="Advisory review required"
              checks={review.warnings}
              kind="warning"
            />
          </div>

          {!blocked ? (
            <section
              className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
              aria-labelledby="commit-confirmation-title"
            >
              <div className="flex items-start gap-3">
                <LockKeyhole
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
                />
                <div>
                  <h3
                    id="commit-confirmation-title"
                    className="text-xs font-medium text-white"
                  >
                    Deliberate Reality update
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
                    This applies {review.changeCount} deterministic change
                    {review.changeCount === 1 ? "" : "s"} to the synthetic ORBIT
                    dataset, creates Reality v{review.realityVersionBefore + 1},
                    and generates an immutable demo receipt.
                  </p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={isPending}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-[11px] leading-5 text-[var(--text-secondary)]">
                  I have reviewed this Shadow and intend to make it the new
                  synthetic Reality.
                </span>
              </label>

              {needsAdvisoryAcknowledgement ? (
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--warning)] bg-[color:var(--warning)]/5 p-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
                  <input
                    type="checkbox"
                    checked={advisoriesAcknowledged}
                    disabled={isPending}
                    onChange={(event) =>
                      setAdvisoriesAcknowledged(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-[var(--warning)]"
                  />
                  <span className="text-[11px] leading-5 text-[var(--text-secondary)]">
                    I acknowledge the advisory warnings above, including any
                    unmet savings target.
                  </span>
                </label>
              ) : null}
            </section>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--danger)] bg-[color:var(--danger)]/5 p-4">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]"
              />
              <div>
                <p className="text-xs font-medium text-[var(--danger)]">
                  Commit is unavailable
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
                  Return to the Shadow and remove or replace every blocked
                  action. Human acknowledgement cannot bypass safety policy.
                </p>
              </div>
            </div>
          )}

          {error || localError ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-[var(--danger)] bg-[color:var(--danger)]/5 p-3 text-xs text-[var(--danger)]"
            >
              {localError ?? error}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-faint)]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Only the human-facing UI exposes commit.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={requestClose}
              className="h-9 rounded-lg border border-[var(--border)] px-3.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canCommit}
              onClick={() => void commit()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {blocked
                ? "Resolve blockers"
                : isPending
                  ? "Committing…"
                  : review.changeCount === 0
                    ? "No changes to commit"
                    : `Commit to Reality v${review.realityVersionBefore + 1}`}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
