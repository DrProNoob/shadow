import { AlertTriangle, ArrowRight, Ban, CircleCheck } from "lucide-react";
import type { ComparedProductState } from "@/components/compare/compare-model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function Savings({ cents }: { cents?: number }) {
  if (!cents) return null;
  return (
    <span className="font-mono text-[10px] text-[var(--success)]">
      −{formatMoney(cents)}/mo
    </span>
  );
}

export function FutureStateCell({ state }: { state: ComparedProductState }) {
  switch (state.kind) {
    case "keep":
      return (
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CircleCheck
              aria-hidden="true"
              className="h-3.5 w-3.5 text-[var(--text-faint)]"
            />
            {state.label ?? "Keep"}
          </span>
          {state.planName || state.seatCount !== undefined ? (
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              {[
                state.planName,
                state.seatCount !== undefined
                  ? `${state.seatCount} seats`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      );

    case "cancel":
      return (
        <div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.blocked ? "text-[var(--danger)]" : "text-white"}`}
          >
            {state.blocked ? (
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Ban aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Cancel
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Savings cents={state.monthlySavingsCents} />
            {state.contractPenaltyCents ? (
              <span className="font-mono text-[10px] text-[var(--danger)]">
                {formatMoney(state.contractPenaltyCents)} penalty
              </span>
            ) : null}
          </div>
        </div>
      );

    case "seat":
      return (
        <div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[var(--text-muted)]">
              {state.previousSeats}
            </span>
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 text-[var(--accent)]"
            />
            <span className="text-white">{state.proposedSeats}</span>
            <span className="font-sans text-[10px] text-[var(--text-faint)]">
              seats
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Savings cents={state.monthlySavingsCents} />
            {state.activeUsersAffected ? (
              <span className="text-[10px] text-[var(--warning)]">
                {state.activeUsersAffected} active affected
              </span>
            ) : null}
          </div>
        </div>
      );

    case "plan":
      return (
        <div>
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span className="truncate text-[var(--text-muted)]">
              {state.previousPlanName}
            </span>
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
            />
            <span className="truncate text-white">
              {state.proposedPlanName}
            </span>
          </div>
          <div className="mt-1.5">
            <Savings cents={state.monthlySavingsCents} />
          </div>
        </div>
      );

    case "plan-and-seat":
      return (
        <div>
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span className="truncate text-[var(--text-muted)]">
              {state.previousPlanName}
            </span>
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
            />
            <span className="truncate text-white">
              {state.proposedPlanName}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span className="text-[var(--text-muted)]">
              {state.previousSeats}
            </span>
            <span aria-hidden="true" className="text-[var(--accent)]">
              →
            </span>
            <span className="text-white">{state.proposedSeats} seats</span>
            <Savings cents={state.monthlySavingsCents} />
          </div>
        </div>
      );
  }
}
