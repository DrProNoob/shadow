import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  CircleX,
  FileSearch,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import type { ConstraintCheck, Impact, ShadowChange } from "@/domain/model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function initials(productName: string): string {
  return productName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function actionLabel(actionType: StagedChangeCardView["actionType"]): string {
  switch (actionType) {
    case "seat-count":
      return "Seat optimization";
    case "plan":
      return "Plan change";
    case "cancellation":
      return "Cancellation";
  }
}

export type StagedChangeCardView = {
  id: string;
  subscriptionId?: string;
  productName: string;
  planName?: string;
  actionType: ShadowChange["actionType"];
  previousLabel: string | number;
  proposedLabel: string | number;
  unitLabel?: string;
  monthlySavingsCents: number;
  annualSavingsCents?: number;
  activeUsersAffected: number;
  activeEngineeringUsersAffected?: number;
  contractPenaltyCents?: number;
  risk: Impact["risk"];
  activeUsers90d?: number;
  inactiveUsers90d?: number;
  checks?: ConstraintCheck[];
};

export type StagedChangeCardProps = {
  change: StagedChangeCardView;
  disabled?: boolean;
  removing?: boolean;
  onInspect: () => void;
  onRemove: () => void;
};

export function StagedChangeCard({
  change,
  disabled,
  removing,
  onInspect,
  onRemove,
}: StagedChangeCardProps) {
  const blockers = (change.checks ?? []).filter(
    (check) => !check.passed && check.severity === "hard-blocker",
  );
  const warnings = (change.checks ?? []).filter(
    (check) => !check.passed && check.severity === "advisory",
  );
  const blocked = blockers.length > 0;
  const highRisk = blocked || change.risk === "high";
  const penalty = change.contractPenaltyCents ?? 0;
  const borderClass = highRisk
    ? "border-[var(--danger)]"
    : change.risk === "medium"
      ? "border-[var(--warning)]"
      : "border-[color:var(--accent)]";

  return (
    <article
      aria-label={`${change.productName} ${actionLabel(change.actionType)}`}
      className={`overflow-hidden rounded-xl border bg-[var(--surface)] ${borderClass}`}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-[var(--surface-raised)] text-xs font-semibold text-white ${highRisk ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
          >
            {initials(change.productName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-white">
                {change.productName}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${blocked ? "bg-[color:var(--danger)]/10 text-[var(--danger)]" : "bg-[color:var(--accent)]/10 text-[var(--accent)]"}`}
              >
                {blocked ? "Commit blocked" : "Shadow change"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              {change.planName ? `${change.planName} · ` : ""}
              {actionLabel(change.actionType)}
            </p>
            <div className="mt-4 flex min-w-0 items-center gap-3">
              <span className="truncate font-mono text-base text-[var(--text-muted)] sm:text-lg">
                {change.previousLabel}
              </span>
              <ArrowRight
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 ${highRisk ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}
              />
              <span className="truncate font-mono text-base text-white sm:text-lg">
                {change.proposedLabel}
              </span>
              {change.unitLabel ? (
                <span className="shrink-0 text-xs text-[var(--text-faint)]">
                  {change.unitLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          <p
            className={`font-mono text-base ${change.monthlySavingsCents >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
          >
            {change.monthlySavingsCents >= 0 ? "−" : "+"}
            {formatMoney(Math.abs(change.monthlySavingsCents))}/mo
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">
            {change.activeUsersAffected} active users affected
          </p>
          {penalty > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--danger)]">
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
              {formatMoney(penalty)} penalty
            </p>
          ) : null}
        </div>
      </div>

      {blockers.length > 0 || warnings.length > 0 ? (
        <div
          className={`border-t px-5 py-3.5 ${blocked ? "border-[var(--danger)] bg-[color:var(--danger)]/5" : "border-[var(--warning)] bg-[color:var(--warning)]/5"}`}
        >
          <div className="flex items-start gap-2.5">
            {blocked ? (
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
              <p
                className={`text-xs font-medium ${blocked ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
              >
                {blocked
                  ? `${blockers.length} hard constraint${blockers.length === 1 ? "" : "s"} failed`
                  : `${warnings.length} advisory warning${warnings.length === 1 ? "" : "s"}`}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
                {(blockers[0] ?? warnings[0])?.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-muted)]">
          {change.inactiveUsers90d !== undefined ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
              <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
              {change.inactiveUsers90d} inactive licenses
            </span>
          ) : null}
          {change.activeUsers90d !== undefined ? (
            <span>{change.activeUsers90d} active in 90 days</span>
          ) : null}
          <span
            className={`capitalize ${highRisk ? "text-[var(--danger)]" : change.risk === "medium" ? "text-[var(--warning)]" : ""}`}
          >
            {change.risk} risk
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onInspect}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <FileSearch aria-hidden="true" className="h-3.5 w-3.5" />
            Why?
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {removing ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : (
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
