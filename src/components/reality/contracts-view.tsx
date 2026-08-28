import { AlertTriangle, CalendarDays } from "lucide-react";
import type { ContractView } from "@/application/queries";
import {
  MetricCard,
  RealityPageFrame,
  SectionHeading,
} from "@/components/reality/reality-page-frame";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function ContractsView({ contracts }: { contracts: ContractView[] }) {
  const penaltyContracts = contracts.filter(
    (contract) => contract.cancellationPenaltyCents > 0,
  );
  const flexibleContracts = contracts.filter(
    (contract) =>
      contract.billingCadence.toLowerCase().includes("month") ||
      contract.seatReductionCadence.toLowerCase().includes("month"),
  );

  return (
    <RealityPageFrame
      eyebrow="Reality · Contract terms"
      title="Contracts"
      description="Terms constrain which futures are safe. SHADOW evaluates staged actions against reduction windows, floors, penalties, and operational dependencies."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Tracked agreements"
          value={String(contracts.length)}
          detail="One agreement per product"
        />
        <MetricCard
          label="Flexible terms"
          value={String(flexibleContracts.length)}
          detail="Monthly reductions available"
        />
        <MetricCard
          label="Blocking penalties"
          value={String(penaltyContracts.length)}
          detail="Miro cancellation is the designed trap"
        />
      </div>

      <section className="mt-8" aria-labelledby="contract-register">
        <SectionHeading
          id="contract-register"
          title="Contract register"
          description="All dates, prices, and clauses are synthetic and evaluated against 28 Aug 2026."
        />

        <div className="mt-4 grid gap-3">
          {contracts.map((contract) => (
            <article
              key={contract.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)] text-[10px] font-semibold text-[var(--text-secondary)]">
                    {contract.productName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white">
                      {contract.productName}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {contract.billingCadence} billing
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  {contract.renewsAt === "Monthly"
                    ? "Renews monthly"
                    : `Renews ${contract.renewsAt}`}
                </div>
              </div>

              <dl className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    Reduction
                  </dt>
                  <dd className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {contract.seatReductionCadence}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    Cancellation
                  </dt>
                  <dd className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {contract.cancellationNoticeDays === 0
                      ? "No notice required"
                      : `${contract.cancellationNoticeDays}-day notice`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    Contract floor
                  </dt>
                  <dd className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {contract.minimumSeats === 0
                      ? "None / not seat-based"
                      : `${contract.minimumSeats} seats`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    Early termination
                  </dt>
                  <dd
                    className={`mt-2 inline-flex items-center gap-1.5 text-xs leading-5 ${contract.cancellationPenaltyCents > 0 ? "text-[var(--warning)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {contract.cancellationPenaltyCents > 0 && (
                      <AlertTriangle
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    )}
                    {contract.cancellationPenaltyCents > 0
                      ? `${formatMoney(contract.cancellationPenaltyCents)} penalty`
                      : "No fixed penalty"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <aside className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <div>
          <p className="text-xs font-medium text-white">Contract evaluation</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Seat floors and early-termination penalties are checked against
            every staged future before the human can commit.
          </p>
        </div>
      </aside>
    </RealityPageFrame>
  );
}
