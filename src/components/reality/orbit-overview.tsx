"use client";

import { ArrowUpRight, Building2, Layers3, Users } from "lucide-react";
import { getCompanySummary } from "@/application/queries";
import { useWorkspace } from "@/components/shell/workspace-provider";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function OrbitOverview() {
  const { workspace } = useWorkspace();
  const summary = getCompanySummary(workspace);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-6 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            Fictional company, contracts, usage, and pricing
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-faint)]">
            Current Reality
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-white sm:text-4xl">
            ORBIT software operations
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
            A deterministic synthetic workspace for exploring possible futures
            before any change becomes real.
          </p>
        </div>
        <div className="font-mono text-xs text-[var(--text-faint)]">
          As of {summary.asOfDate}
        </div>
      </div>

      <section aria-labelledby="spend-title" className="py-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p id="spend-title" className="text-sm text-[var(--text-muted)]">
                Monthly SaaS cost
              </p>
              <p
                data-testid="monthly-software-cost"
                className="mt-3 text-4xl font-medium tracking-[-0.055em] text-white sm:text-5xl"
              >
                {money.format(summary.monthlySoftwareCostCents / 100)}
              </p>
            </div>
            <div className="rounded-md border border-[var(--border)] p-2 text-[var(--text-faint)]">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-8 h-px bg-[var(--border)]" />
          <p className="mt-5 text-xs leading-5 text-[var(--text-faint)]">
            Reality stays immutable while an agent explores Shadows. Only a
            deliberate human review can commit one of those futures.
          </p>
        </div>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Company metrics"
      >
        <Metric
          icon={Users}
          label="Employees"
          value={String(summary.employeeCount)}
        />
        <Metric
          icon={Layers3}
          label="Subscriptions"
          value={String(summary.subscriptionCount)}
        />
        <Metric
          icon={Building2}
          label="Reality version"
          value={`v${summary.realityVersion}`}
        />
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
      <Icon className="h-4 w-4 text-[var(--text-faint)]" />
      <p className="mt-5 text-xs text-[var(--text-faint)]">{label}</p>
      <p className="mt-1 text-lg font-medium text-white">{value}</p>
    </div>
  );
}
