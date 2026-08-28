import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CircleCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { SubscriptionView } from "@/application/queries";
import {
  MetricCard,
  RealityPageFrame,
  SectionHeading,
} from "@/components/reality/reality-page-frame";
import type {
  DependencyCriticality,
  Impact,
  RiskLevel,
  ShadowChange,
  ShadowStrategy,
} from "@/domain/model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function formatPercent(basisPoints: number): string {
  return `${percentFormatter.format(basisPoints / 100)}%`;
}

export type SubscriptionRowSafety = {
  activeUsersAffected: number;
  activeEngineeringUsersAffected: number;
  contractPenaltyCents: number;
  risk: RiskLevel;
  hardBlockerCount: number;
  warningCount: number;
};

export type SubscriptionPortfolioRow = {
  id: string;
  productId: string;
  productName: string;
  baseline: SubscriptionView;
  projected: SubscriptionView;
  changed: boolean;
  changeKinds: ShadowChange["actionType"][];
  changeIds: string[];
  monthlySavingsCents: number;
  annualSavingsCents: number;
  safety: SubscriptionRowSafety;
};

export type SubscriptionPortfolioContext =
  | {
      kind: "reality";
      realityVersion: number;
    }
  | {
      kind: "shadow";
      shadowId: string;
      name: string;
      strategy: ShadowStrategy;
      status: "draft" | "committed";
      baseRealityVersion: number;
      currentRealityVersion: number;
      revision: number;
      changeCount: number;
      totalImpact?: Impact;
      hardBlockerCount: number;
      warningCount: number;
      projectionError?: string;
    };

function CriticalityLabel({ value }: { value: DependencyCriticality }) {
  if (value === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--warning)]">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        Critical
      </span>
    );
  }

  if (value === "important") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
        Broad dependency
      </span>
    );
  }

  return <span className="text-xs text-[var(--text-faint)]">Supporting</span>;
}

function Utilization({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-xs text-[var(--text-faint)]">Not applicable</span>
    );
  }

  return (
    <div className="flex min-w-24 items-center gap-2">
      <div
        aria-hidden="true"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[11px] text-[var(--text-muted)]">
        {value}%
      </span>
    </div>
  );
}

function ChangeKindLabel({ kind }: { kind: ShadowChange["actionType"] }) {
  const label =
    kind === "seat-count"
      ? "Seat change"
      : kind === "plan"
        ? "Plan change"
        : "Cancellation";

  return (
    <span className="rounded-full border border-[color:rgba(77,141,255,0.34)] bg-[color:rgba(77,141,255,0.09)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
      {label}
    </span>
  );
}

function RiskLabel({ safety }: { safety: SubscriptionRowSafety }) {
  if (safety.hardBlockerCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
        <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
        {safety.hardBlockerCount} commit blocker
        {safety.hardBlockerCount === 1 ? "" : "s"}
      </span>
    );
  }

  if (safety.activeEngineeringUsersAffected > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
        <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
        {safety.activeEngineeringUsersAffected} Engineering affected
      </span>
    );
  }

  if (safety.activeUsersAffected > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--warning)]">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        {safety.activeUsersAffected} active affected
      </span>
    );
  }

  if (safety.warningCount > 0 || safety.risk === "medium") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--warning)]">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        Medium risk · no active users affected
      </span>
    );
  }

  if (safety.risk === "high") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
        <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
        High risk · review required
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success)]">
      <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
      Low risk · no active users affected
    </span>
  );
}

function StateTransition({ row }: { row: SubscriptionPortfolioRow }) {
  const { baseline, projected } = row;
  const planChanged = baseline.planId !== projected.planId;
  const seatsChanged = baseline.seatCount !== projected.seatCount;
  const cancelled =
    baseline.status !== "cancelled" && projected.status === "cancelled";

  if (!row.changed) {
    return (
      <div>
        <p className="text-xs text-[var(--text-muted)]">
          {baseline.planName} · {baseline.seatCount} seats
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-faint)]">
          {baseline.activeUsers90d} active · Renews {baseline.renewalDate}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {row.changeKinds.map((kind) => (
          <ChangeKindLabel key={kind} kind={kind} />
        ))}
      </div>
      {cancelled ? (
        <p className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">{baseline.planName}</span>
          <ArrowRight
            aria-hidden="true"
            className="h-3 w-3 text-[var(--text-faint)]"
          />
          <span className="inline-flex items-center gap-1 font-medium text-[var(--danger)]">
            <Ban aria-hidden="true" className="h-3 w-3" />
            Cancelled
          </span>
        </p>
      ) : (
        <div className="space-y-1.5">
          {planChanged ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[var(--text-muted)]">
                {baseline.planName}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-3 w-3 text-[var(--accent)]"
              />
              <span className="font-medium text-white">
                {projected.planName}
              </span>
            </p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">
              {projected.planName}
            </p>
          )}
          {seatsChanged ? (
            <p className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[var(--text-muted)]">
                {baseline.seatCount}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-3 w-3 text-[var(--accent)]"
              />
              <span className="font-medium text-white">
                {projected.seatCount} seats
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-[var(--text-faint)]">
              {projected.seatCount} seats
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MonthlyTransition({ row }: { row: SubscriptionPortfolioRow }) {
  if (!row.changed) {
    return (
      <span className="font-mono text-xs text-[var(--text-secondary)]">
        {formatMoney(row.baseline.monthlyCostCents)}
      </span>
    );
  }

  return (
    <div className="space-y-1.5 text-right">
      <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
        <span className="text-[var(--text-faint)] line-through decoration-[var(--text-faint)]">
          {formatMoney(row.baseline.monthlyCostCents)}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-3 w-3 text-[var(--accent)]"
        />
        <span className="font-medium text-white">
          {formatMoney(row.projected.monthlyCostCents)}
        </span>
      </div>
      <p
        className={`font-mono text-[11px] ${
          row.monthlySavingsCents >= 0
            ? "text-[var(--success)]"
            : "text-[var(--danger)]"
        }`}
      >
        {row.monthlySavingsCents >= 0 ? "−" : "+"}
        {formatMoney(Math.abs(row.monthlySavingsCents))}/mo
      </p>
      {row.safety.contractPenaltyCents > 0 ? (
        <p className="text-[10px] text-[var(--danger)]">
          {formatMoney(row.safety.contractPenaltyCents)} penalty
        </p>
      ) : null}
    </div>
  );
}

function ContextSummary({
  context,
}: {
  context: SubscriptionPortfolioContext;
}) {
  if (context.kind === "reality") {
    return (
      <div
        aria-live="polite"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
            Current Reality · v{context.realityVersion}
          </p>
          <p className="mt-1.5 text-sm text-white">
            You are viewing ORBIT&apos;s committed software portfolio.
          </p>
        </div>
        <p className="max-w-md text-xs leading-5 text-[var(--text-muted)] sm:text-right">
          Select a Shadow to project its changes here without mutating this
          baseline.
        </p>
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className={`mb-6 rounded-xl border p-4 sm:p-5 ${
        context.projectionError || context.hardBlockerCount > 0
          ? "border-[color:rgba(224,106,114,0.42)] bg-[color:rgba(224,106,114,0.055)]"
          : "border-[color:rgba(77,141,255,0.4)] bg-[color:rgba(77,141,255,0.06)]"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:rgba(77,141,255,0.38)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Shadow future
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              {context.strategy} · revision {context.revision}
            </span>
          </div>
          <p className="mt-3 text-base font-medium text-white">
            {context.name}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Projected from Reality v{context.baseRealityVersion}. Reality v
            {context.currentRealityVersion} remains unchanged until a human
            commits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:max-w-sm sm:justify-end">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
            {context.changeCount} change{context.changeCount === 1 ? "" : "s"}
          </span>
          {context.hardBlockerCount > 0 ? (
            <span className="rounded-full border border-[color:rgba(224,106,114,0.4)] bg-[color:rgba(224,106,114,0.08)] px-2.5 py-1 text-[10px] text-[var(--danger)]">
              {context.hardBlockerCount} blocker
              {context.hardBlockerCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="rounded-full border border-[color:rgba(56,201,151,0.3)] bg-[color:rgba(56,201,151,0.06)] px-2.5 py-1 text-[10px] text-[var(--success)]">
              No hard blockers
            </span>
          )}
          {context.warningCount > 0 ? (
            <span className="rounded-full border border-[color:rgba(213,168,75,0.34)] bg-[color:rgba(213,168,75,0.06)] px-2.5 py-1 text-[10px] text-[var(--warning)]">
              {context.warningCount} advisory
              {context.warningCount === 1 ? "" : " warnings"}
            </span>
          ) : null}
        </div>
      </div>
      {context.projectionError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 border-t border-[color:rgba(224,106,114,0.25)] pt-4 text-xs leading-5 text-[var(--danger)]"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{context.projectionError}</span>
        </div>
      ) : null}
    </div>
  );
}

export function SubscriptionsView({
  rows,
  context,
}: {
  rows: SubscriptionPortfolioRow[];
  context: SubscriptionPortfolioContext;
}) {
  const baselineMonthlyCostCents = rows.reduce(
    (total, row) => total + row.baseline.monthlyCostCents,
    0,
  );
  const projectedMonthlyCostCents = rows.reduce(
    (total, row) => total + row.projected.monthlyCostCents,
    0,
  );
  const changedRows = rows.filter((row) => row.changed);
  const measured = rows.filter(
    (row) => row.projected.status === "active" && row.projected.seatCount > 0,
  );
  const weightedUtilization = measured.length
    ? Math.round(
        measured.reduce(
          (total, row) =>
            total +
            (row.projected.activeUsers90d / row.projected.seatCount) * 100,
          0,
        ) / measured.length,
      )
    : 0;
  const isShadow = context.kind === "shadow";
  const totalImpact = isShadow ? context.totalImpact : undefined;

  return (
    <RealityPageFrame
      eyebrow={
        isShadow
          ? `Shadow · ${context.name}`
          : `Reality v${context.realityVersion} · Subscription portfolio`
      }
      title={isShadow ? "Projected subscriptions" : "Software subscriptions"}
      description={
        isShadow
          ? "The same ORBIT portfolio, with staged changes applied as a deterministic projection. Compare every future value with its committed baseline."
          : "ORBIT's committed software portfolio. Select a Shadow to inspect what could change before Reality is touched."
      }
    >
      <ContextSummary context={context} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={isShadow ? "Projected monthly spend" : "Monthly spend"}
          value={formatMoney(
            isShadow ? projectedMonthlyCostCents : baselineMonthlyCostCents,
          )}
          detail={
            isShadow
              ? `${formatMoney(baselineMonthlyCostCents)} committed baseline`
              : "Current Reality baseline"
          }
        />
        <MetricCard
          label={isShadow ? "Projected savings" : "Annual run rate"}
          value={
            isShadow && totalImpact
              ? `${formatMoney(totalImpact.monthlySavingsCents)}/mo`
              : formatMoney(baselineMonthlyCostCents * 12)
          }
          detail={
            isShadow && totalImpact
              ? `${formatPercent(totalImpact.savingsBasisPoints)} of baseline · ${formatMoney(totalImpact.annualSavingsCents)}/yr`
              : "Before staged changes"
          }
        />
        <MetricCard
          label={isShadow ? "Portfolio changes" : "Subscriptions"}
          value={isShadow ? String(changedRows.length) : String(rows.length)}
          detail={
            isShadow
              ? `${context.changeCount} staged operation${context.changeCount === 1 ? "" : "s"}`
              : "Synthetic vendor agreements"
          }
        />
        <MetricCard
          label={isShadow ? "Affected active users" : "Measured utilization"}
          value={
            isShadow && totalImpact
              ? String(totalImpact.activeUsersAffected)
              : `${weightedUtilization}%`
          }
          detail={
            isShadow && totalImpact
              ? `${totalImpact.activeEngineeringUsersAffected} protected Engineering users`
              : "Across active seat-based products"
          }
        />
      </div>

      <section className="mt-8" aria-labelledby="subscription-portfolio">
        <SectionHeading
          id="subscription-portfolio"
          title={isShadow ? "Reality → projected future" : "Current portfolio"}
          description={
            isShadow
              ? "Changed products are highlighted. Unchanged rows stay visible so the future can be audited against the full portfolio."
              : "Prices are fictional blended contract costs. Usage reflects the fixed 90-day demo window."
          }
        />

        <div className="mt-4 hidden overflow-hidden rounded-xl border border-[var(--border)] xl:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              {isShadow
                ? `${context.name} projected subscription portfolio compared with Reality`
                : "ORBIT software subscriptions in current Reality"}
            </caption>
            <thead className="bg-[var(--surface-subtle)]">
              <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                <th scope="col" className="px-4 py-3.5">
                  Product
                </th>
                <th scope="col" className="px-4 py-3.5">
                  {isShadow ? "Reality → Shadow" : "Current state"}
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Utilization
                </th>
                <th scope="col" className="px-4 py-3.5">
                  {isShadow ? "Safety" : "Dependency"}
                </th>
                <th scope="col" className="px-4 py-3.5 text-right">
                  Monthly
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.changed
                      ? "bg-[color:rgba(77,141,255,0.035)]"
                      : "bg-[var(--surface)]"
                  }
                >
                  <th scope="row" className="px-4 py-4 font-normal">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-md border text-[10px] font-semibold ${
                          row.changed
                            ? "border-[color:rgba(77,141,255,0.35)] bg-[color:rgba(77,141,255,0.08)] text-[var(--accent)]"
                            : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]"
                        }`}
                      >
                        {row.productName.slice(0, 2).toUpperCase()}
                      </span>
                      <span>
                        <span
                          className={`block text-sm font-medium ${row.changed ? "text-white" : "text-[var(--text-secondary)]"}`}
                        >
                          {row.productName}
                        </span>
                        <span className="mt-0.5 block text-[11px] capitalize text-[var(--text-faint)]">
                          {row.baseline.category}
                        </span>
                      </span>
                    </div>
                  </th>
                  <td className="px-4 py-4">
                    <StateTransition row={row} />
                  </td>
                  <td className="px-4 py-4">
                    <Utilization
                      value={
                        row.projected.status === "cancelled" ||
                        row.projected.seatCount === 0
                          ? null
                          : Math.round(
                              (row.projected.activeUsers90d /
                                row.projected.seatCount) *
                                100,
                            )
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    {row.changed ? (
                      <RiskLabel safety={row.safety} />
                    ) : (
                      <CriticalityLabel value={row.baseline.criticality} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <MonthlyTransition row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul
          className="mt-4 grid gap-3 xl:hidden"
          aria-label={isShadow ? "Projected subscriptions" : "Subscriptions"}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded-xl border p-4 ${
                row.changed
                  ? "border-[color:rgba(77,141,255,0.34)] bg-[color:rgba(77,141,255,0.045)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-medium ${row.changed ? "text-white" : "text-[var(--text-secondary)]"}`}
                    >
                      {row.productName}
                    </p>
                    {row.changed ? (
                      <span className="rounded-full bg-[color:rgba(77,141,255,0.1)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                        Shadow change
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs capitalize text-[var(--text-faint)]">
                    {row.baseline.category}
                  </p>
                </div>
                <MonthlyTransition row={row} />
              </div>

              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <StateTransition row={row} />
              </div>

              <dl className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--text-faint)]">
                    {row.changed ? "Safety" : "Dependency"}
                  </dt>
                  <dd className="mt-1.5">
                    {row.changed ? (
                      <RiskLabel safety={row.safety} />
                    ) : (
                      <CriticalityLabel value={row.baseline.criticality} />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-faint)]">Projected usage</dt>
                  <dd className="mt-1.5 text-[var(--text-secondary)]">
                    {row.projected.status === "cancelled"
                      ? "Cancelled"
                      : `${row.projected.activeUsers90d} active · ${row.projected.inactiveUsers90d} inactive`}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </RealityPageFrame>
  );
}
