"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleX,
  FileCheck2,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import type {
  ReceiptChangeView,
  ReceiptDetailView,
} from "@/components/receipts/receipt-model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function formatSavings(cents: number): string {
  return `${cents >= 0 ? "−" : "+"}${formatMoney(Math.abs(cents))}`;
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : dateFormatter.format(timestamp);
}

function actionLabel(actionType: ReceiptChangeView["actionType"]): string {
  if (actionType === "seat-count") return "Seat change";
  if (actionType === "plan") return "Plan change";
  return "Cancellation";
}

function ReceiptChange({
  change,
  index,
}: {
  change: ReceiptChangeView;
  index: number;
}) {
  const failedBlockers = change.proof.checks.filter(
    (check) => !check.passed && check.severity === "hard-blocker",
  );
  const warnings = change.proof.checks.filter(
    (check) => !check.passed && check.severity === "advisory",
  );

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)] font-mono text-[10px] text-[var(--text-muted)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-white">
                {change.productName}
              </h3>
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                {actionLabel(change.actionType)}
              </span>
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-2 font-mono text-xs">
              <span className="truncate text-[var(--text-muted)]">
                {change.beforeLabel}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
              />
              <span className="truncate text-white">{change.afterLabel}</span>
            </div>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="font-mono text-sm text-[var(--success)]">
            {formatSavings(change.monthlySavingsCents)}/mo
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
            {change.activeUsersAffected} active affected
          </p>
          {change.contractPenaltyCents > 0 ? (
            <p className="mt-1 font-mono text-[10px] text-[var(--danger)]">
              {formatMoney(change.contractPenaltyCents)} penalty
            </p>
          ) : null}
        </div>
      </div>

      <details className="border-t border-[var(--border)] bg-[var(--surface-subtle)]">
        <summary className="cursor-pointer px-4 py-3 text-[10px] font-medium text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] sm:px-5">
          Proof snapshot · {change.proof.evidenceCount} evidence records ·{" "}
          {change.proof.checks.length} checks
        </summary>
        <div className="grid gap-4 border-t border-[var(--border)] px-4 py-4 sm:grid-cols-2 sm:px-5">
          <section aria-labelledby={`receipt-evidence-${change.changeId}`}>
            <h4
              id={`receipt-evidence-${change.changeId}`}
              className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]"
            >
              Evidence highlights
            </h4>
            <dl className="mt-3 grid gap-2">
              {change.proof.evidenceHighlights.map((evidence, index) => (
                <div
                  key={`${evidence.label}-${index}`}
                  className="rounded-md border border-[var(--border)] bg-[var(--canvas)] p-2.5"
                >
                  <dt className="text-[9px] text-[var(--text-faint)]">
                    {evidence.label}
                  </dt>
                  <dd className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">
                    {evidence.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby={`receipt-checks-${change.changeId}`}>
            <h4
              id={`receipt-checks-${change.changeId}`}
              className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]"
            >
              Constraint snapshot
            </h4>
            <ul className="mt-3 grid gap-2">
              {change.proof.checks.map((check) => (
                <li
                  key={check.code}
                  className="flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--canvas)] p-2.5"
                >
                  {check.passed ? (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]"
                    />
                  ) : check.severity === "hard-blocker" ? (
                    <CircleX
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--danger)]"
                    />
                  ) : (
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]"
                    />
                  )}
                  <span>
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      {check.label}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-4 text-[var(--text-faint)]">
                      {check.message}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3 text-[9px] text-[var(--text-faint)] sm:px-5">
          <span>
            Source: {change.proof.provenanceSource} · {change.proof.commandName}
          </span>
          <span>
            {failedBlockers.length} blockers · {warnings.length} warnings
          </span>
        </div>
      </details>
    </article>
  );
}

export type ReceiptDetailProps = {
  receipt: ReceiptDetailView;
  onBack?: () => void;
};

export function ReceiptDetail({ receipt, onBack }: ReceiptDetailProps) {
  return (
    <div className="mx-auto w-full max-w-[1120px]">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 text-xs text-[var(--text-muted)] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          All receipts
        </button>
      ) : null}

      <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--success)]">
              <FileCheck2 aria-hidden="true" className="h-3 w-3" />
              Committed
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <FlaskConical aria-hidden="true" className="h-3 w-3" />
              Fictional data
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl">
            {receipt.shadowName}
          </h1>
          <p className="mt-2 font-mono text-[10px] text-[var(--text-faint)]">
            {receipt.receiptId} · receipt schema v{receipt.receiptVersion}
          </p>
        </div>
        <div className="lg:text-right">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Committed at
          </p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            {formatTimestamp(receipt.committedAt)}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 font-mono text-xs text-white">
            Reality v{receipt.realityVersionBefore}
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 text-[var(--accent)]"
            />
            Reality v{receipt.realityVersionAfter}
          </p>
        </div>
      </header>

      <section className="pt-7" aria-labelledby="receipt-totals-title">
        <h2 id="receipt-totals-title" className="sr-only">
          Receipt totals
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Changes
            </dt>
            <dd className="mt-3 font-mono text-xl text-white">
              {receipt.changes.length}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Monthly savings
            </dt>
            <dd className="mt-3 font-mono text-xl text-[var(--success)]">
              {formatMoney(receipt.totalImpact.monthlySavingsCents)}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Annual savings
            </dt>
            <dd className="mt-3 font-mono text-xl text-white">
              {formatMoney(receipt.totalImpact.annualSavingsCents)}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Savings rate
            </dt>
            <dd className="mt-3 font-mono text-xl text-white">
              {percentageFormatter.format(
                receipt.totalImpact.savingsBasisPoints / 100,
              )}
              %
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Active affected
            </dt>
            <dd className="mt-3 font-mono text-xl text-white">
              {receipt.totalImpact.activeUsersAffected}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="applied-changes-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="applied-changes-title"
              className="text-sm font-medium text-white"
            >
              Applied changes and Proof snapshots
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Observable evidence and validation results captured at commit
              time.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
            <ShieldCheck aria-hidden="true" className="h-3 w-3" />
            Snapshot, not chain-of-thought
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {receipt.changes.map((change, index) => (
            <ReceiptChange
              key={change.changeId}
              change={change}
              index={index}
            />
          ))}
        </div>
      </section>

      <footer className="mt-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-[10px] leading-5 text-[var(--text-faint)]">
        This deterministic receipt records a synthetic application-state
        transition. It is not cryptographically signed and does not represent a
        real vendor transaction.
      </footer>
    </div>
  );
}
