"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleX,
  GitBranchPlus,
  Layers3,
  LoaderCircle,
} from "lucide-react";
import {
  type CompareFuturesView,
  type ComparedFutureView,
  type HybridProposalView,
} from "@/components/compare/compare-model";
import { FutureStateCell } from "@/components/compare/future-state-cell";
import type { RiskLevel, ShadowId } from "@/domain/model";

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

function formatPercent(basisPoints: number): string {
  return `${percentageFormatter.format(basisPoints / 100)}%`;
}

function riskClass(risk: RiskLevel): string {
  if (risk === "high") return "border-[var(--danger)] text-[var(--danger)]";
  if (risk === "medium") {
    return "border-[var(--warning)] text-[var(--warning)]";
  }
  return "border-[var(--success)] text-[var(--success)]";
}

function FutureHero({
  future,
  side,
  selected,
  onSelect,
}: {
  future: ComparedFutureView;
  side: "left" | "right";
  selected: boolean;
  onSelect?: (shadowId: ShadowId) => void;
}) {
  const blocked = future.blockerCount > 0;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect?.(future.shadowId)}
      className={`min-w-0 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:p-5 ${selected ? "border-[var(--accent)] bg-[color:var(--accent)]/5" : blocked ? "border-[var(--danger)] bg-[color:var(--danger)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {side === "left" ? "Future A" : "Future B"}
          </span>
          <span className="mt-2 block truncate text-base font-medium text-white">
            {future.name}
          </span>
          <span className="mt-1 block text-[10px] capitalize text-[var(--text-faint)]">
            {future.strategy} · {future.actionCount} actions
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] ${riskClass(future.risk)}`}
        >
          {future.risk} risk
        </span>
      </span>

      <span className="mt-7 block">
        <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
          Projected annual savings
        </span>
        <span className="mt-2 block font-mono text-2xl tracking-[-0.03em] text-white sm:text-3xl">
          {formatMoney(future.annualSavingsCents)}
        </span>
        <span className="mt-2 inline-flex items-center gap-2 font-mono text-xs text-[var(--success)]">
          {formatPercent(future.savingsBasisPoints)} of Reality
        </span>
      </span>

      <span
        className={`mt-5 flex items-center gap-2 border-t pt-3 text-[10px] ${blocked ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
      >
        {blocked ? (
          <CircleX aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Check
            aria-hidden="true"
            className="h-3.5 w-3.5 text-[var(--success)]"
          />
        )}
        {blocked
          ? `${future.blockerCount} commit blocker${future.blockerCount === 1 ? "" : "s"}`
          : "Eligible for human review"}
      </span>
    </button>
  );
}

type MetricRow = {
  label: string;
  left: string;
  right: string;
  leftTone?: "default" | "success" | "warning" | "danger";
  rightTone?: "default" | "success" | "warning" | "danger";
};

function toneClass(tone: MetricRow["leftTone"]): string {
  if (tone === "success") return "text-[var(--success)]";
  if (tone === "warning") return "text-[var(--warning)]";
  if (tone === "danger") return "text-[var(--danger)]";
  return "text-white";
}

function comparisonMetrics(
  left: ComparedFutureView,
  right: ComparedFutureView,
): MetricRow[] {
  return [
    {
      label: "Monthly savings",
      left: formatMoney(left.monthlySavingsCents),
      right: formatMoney(right.monthlySavingsCents),
      leftTone: "success",
      rightTone: "success",
    },
    {
      label: "Annual savings",
      left: formatMoney(left.annualSavingsCents),
      right: formatMoney(right.annualSavingsCents),
    },
    {
      label: "Savings",
      left: formatPercent(left.savingsBasisPoints),
      right: formatPercent(right.savingsBasisPoints),
    },
    {
      label: "Actions",
      left: String(left.actionCount),
      right: String(right.actionCount),
    },
    {
      label: "Active users affected",
      left: String(left.activeUsersAffected),
      right: String(right.activeUsersAffected),
      leftTone: left.activeUsersAffected > 0 ? "warning" : "default",
      rightTone: right.activeUsersAffected > 0 ? "warning" : "default",
    },
    {
      label: "Engineering affected",
      left: String(left.activeEngineeringUsersAffected),
      right: String(right.activeEngineeringUsersAffected),
      leftTone: left.activeEngineeringUsersAffected > 0 ? "danger" : "default",
      rightTone:
        right.activeEngineeringUsersAffected > 0 ? "danger" : "default",
    },
    {
      label: "Contract penalties",
      left: formatMoney(left.contractPenaltyCents),
      right: formatMoney(right.contractPenaltyCents),
      leftTone: left.contractPenaltyCents > 0 ? "danger" : "default",
      rightTone: right.contractPenaltyCents > 0 ? "danger" : "default",
    },
    {
      label: "Risk",
      left: left.risk,
      right: right.risk,
      leftTone:
        left.risk === "high"
          ? "danger"
          : left.risk === "medium"
            ? "warning"
            : "success",
      rightTone:
        right.risk === "high"
          ? "danger"
          : right.risk === "medium"
            ? "warning"
            : "success",
    },
  ];
}

export type CompareFuturesProps = {
  comparison: CompareFuturesView;
  selectedShadowId?: ShadowId | null;
  hybridPending?: boolean;
  hybridError?: string | null;
  onSelectLeft?: (shadowId: ShadowId) => void;
  onSelectRight?: (shadowId: ShadowId) => void;
  onCreateHybrid?: (proposal: HybridProposalView) => void | Promise<void>;
};

export function CompareFutures({
  comparison,
  selectedShadowId,
  hybridPending = false,
  hybridError,
  onSelectLeft,
  onSelectRight,
  onCreateHybrid,
}: CompareFuturesProps) {
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pending = hybridPending || localPending;
  const metrics = comparisonMetrics(comparison.left, comparison.right);
  const differences = comparison.products.filter((row) => row.different);
  const identical = comparison.products.length - differences.length;

  async function createHybrid() {
    if (!comparison.hybridProposal || !onCreateHybrid) return;
    setLocalPending(true);
    setLocalError(null);
    try {
      await onCreateHybrid(comparison.hybridProposal);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "The Hybrid future could not be created.",
      );
    } finally {
      setLocalPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1260px]">
      <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Reality v{comparison.realityVersion} · Decision surface
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white sm:text-3xl">
            Compare Futures
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Inspect the financial result, operational impact, and exact product
            differences before choosing what should become real.
          </p>
        </div>

        {comparison.hybridProposal && onCreateHybrid ? (
          <div className="lg:text-right">
            <button
              type="button"
              disabled={pending}
              onClick={() => void createHybrid()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <GitBranchPlus aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {pending ? "Creating Hybrid…" : "Create Hybrid"}
            </button>
            <p className="mt-2 max-w-sm text-[10px] leading-4 text-[var(--text-faint)] lg:ml-auto">
              {comparison.hybridProposal.description}
            </p>
          </div>
        ) : null}
      </header>

      {hybridError || localError ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-[var(--danger)] bg-[color:var(--danger)]/5 p-3.5 text-xs text-[var(--danger)]"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          {localError ?? hybridError}
        </div>
      ) : null}

      <section className="mt-7" aria-labelledby="future-candidates-title">
        <h2 id="future-candidates-title" className="sr-only">
          Future candidates
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FutureHero
            future={comparison.left}
            side="left"
            selected={selectedShadowId === comparison.left.shadowId}
            onSelect={onSelectLeft}
          />
          <FutureHero
            future={comparison.right}
            side="right"
            selected={selectedShadowId === comparison.right.shadowId}
            onSelect={onSelectRight}
          />
        </div>
      </section>

      <section className="mt-7" aria-labelledby="outcomes-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="outcomes-title" className="text-sm font-medium text-white">
              Outcomes
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Calculated from the same Reality snapshot.
            </p>
          </div>
          <span className="font-mono text-[10px] text-[var(--text-faint)]">
            revision {comparison.left.revision} · revision{" "}
            {comparison.right.revision}
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">
              Outcome comparison for {comparison.left.name} and{" "}
              {comparison.right.name}
            </caption>
            <thead className="bg-[var(--surface-subtle)]">
              <tr className="border-b border-[var(--border)]">
                <th
                  scope="col"
                  className="w-[38%] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] sm:w-[32%]"
                >
                  Metric
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] sm:px-4"
                >
                  {comparison.left.name}
                </th>
                <th
                  scope="col"
                  className="border-l border-[var(--border)] px-3 py-3 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] sm:px-4"
                >
                  {comparison.right.name}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {metrics.map((metric) => (
                <tr key={metric.label}>
                  <th
                    scope="row"
                    className="px-4 py-3.5 text-left text-[10px] font-normal text-[var(--text-muted)] sm:text-xs"
                  >
                    {metric.label}
                  </th>
                  <td
                    className={`px-3 py-3.5 text-right font-mono text-xs capitalize sm:px-4 ${toneClass(metric.leftTone)}`}
                  >
                    {metric.left}
                  </td>
                  <td
                    className={`border-l border-[var(--border)] px-3 py-3.5 text-right font-mono text-xs capitalize sm:px-4 ${toneClass(metric.rightTone)}`}
                  >
                    {metric.right}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="differences-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="differences-title"
              className="text-sm font-medium text-white"
            >
              Product differences
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {differences.length} different · {identical} identical across both
              futures
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
            <Layers3 aria-hidden="true" className="h-3 w-3" />
            Aligned by subscription
          </span>
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Product-level differences between {comparison.left.name} and{" "}
              {comparison.right.name}
            </caption>
            <thead className="bg-[var(--surface-subtle)]">
              <tr className="border-b border-[var(--border)] text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                <th scope="col" className="w-[24%] px-4 py-3">
                  Product
                </th>
                <th scope="col" className="w-[38%] px-4 py-3">
                  {comparison.left.name}
                </th>
                <th
                  scope="col"
                  className="w-[38%] border-l border-[var(--border)] px-4 py-3"
                >
                  {comparison.right.name}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {comparison.products.map((row) => (
                <tr
                  key={row.subscriptionId}
                  className={row.different ? "" : "bg-[var(--surface-subtle)]"}
                >
                  <th scope="row" className="px-4 py-4 font-normal">
                    <span className="block text-xs font-medium text-white">
                      {row.productName}
                    </span>
                    <span className="mt-1 block text-[10px] capitalize text-[var(--text-faint)]">
                      {row.category ??
                        (row.different ? "Different" : "Identical")}
                    </span>
                  </th>
                  <td className="px-4 py-4">
                    <FutureStateCell state={row.left} />
                  </td>
                  <td className="border-l border-[var(--border)] px-4 py-4">
                    <FutureStateCell state={row.right} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul
          className="mt-4 grid gap-3 md:hidden"
          aria-label="Product differences"
        >
          {comparison.products.map((row) => (
            <li
              key={row.subscriptionId}
              className={`rounded-xl border bg-[var(--surface)] ${row.different ? "border-[var(--border-strong)]" : "border-[var(--border)]"}`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <span className="text-xs font-medium text-white">
                  {row.productName}
                </span>
                <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                  {row.different ? "Different" : "Same"}
                </span>
              </div>
              <div className="grid grid-cols-2">
                <div className="min-w-0 p-4">
                  <p className="mb-3 truncate text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    {comparison.left.name}
                  </p>
                  <FutureStateCell state={row.left} />
                </div>
                <div className="min-w-0 border-l border-[var(--border)] p-4">
                  <p className="mb-3 truncate text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                    {comparison.right.name}
                  </p>
                  <FutureStateCell state={row.right} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {comparison.hybridProposal && onCreateHybrid ? (
        <footer className="mt-8 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-white">
              {comparison.hybridProposal.name}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
              Keep {comparison.left.name} as the base and copy the{" "}
              {comparison.hybridProposal.sourceProductName} change from{" "}
              {comparison.right.name}.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void createHybrid()}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3.5 text-xs font-medium text-white transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : (
              <GitBranchPlus aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Create Hybrid
          </button>
        </footer>
      ) : null}
    </div>
  );
}
