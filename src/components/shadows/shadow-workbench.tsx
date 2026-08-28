"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Layers3,
  LoaderCircle,
  Play,
  Plus,
} from "lucide-react";
import { ProofDrawer } from "@/components/proof/proof-drawer";
import {
  StagedChangeCard,
  type StagedChangeCardView,
} from "@/components/shadows/staged-change-card";
import type {
  ActionProof,
  ConstraintCheck,
  Impact,
  ShadowId,
  ShadowStrategy,
} from "@/domain/model";

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

export type CreateShadowInput = {
  name: string;
  strategy: ShadowStrategy;
};

export type ShadowWorkbenchHeader = {
  id: ShadowId;
  name: string;
  strategy: ShadowStrategy;
  baseRealityVersion: number;
  revision: number;
};

/** Legacy Slice 3 adapter retained for the Adobe-first vertical slice. */
export type StagedSeatChangeCard = {
  id: string;
  productName: string;
  planName: string;
  previousSeats: number;
  proposedSeats: number;
  activeUsers90d: number;
  inactiveUsers90d: number;
  monthlySavingsCents: number;
  activeUsersAffected: number;
  risk: Impact["risk"];
};

export type ShadowWorkbenchProps = {
  shadow: ShadowWorkbenchHeader | null;
  stagedChanges?: StagedChangeCardView[];
  stagedAdobeChange?: StagedSeatChangeCard | null;
  impact?: Impact | null;
  blockers?: ConstraintCheck[];
  warnings?: ConstraintCheck[];
  proofsByChangeId?: Record<string, ActionProof>;
  proof?: ActionProof | null;
  protectedTeamNames?: string[];
  error?: string | null;
  disabled?: boolean;
  onCreateShadow: (input: CreateShadowInput) => void | Promise<void>;
  onStageAdobe?: (shadowId: ShadowId) => void | Promise<void>;
  onRemoveChange: (
    shadowId: ShadowId,
    changeId: string,
  ) => void | Promise<void>;
  onInspectChange?: (shadowId: ShadowId, changeId: string) => void;
  onLoadExampleFutures?: () => void | Promise<void>;
};

export type ShadowStarterProps = Pick<
  ShadowWorkbenchProps,
  "disabled" | "onCreateShadow" | "onLoadExampleFutures"
>;

type PendingAction =
  { kind: "stage-adobe" } | { kind: "remove"; changeId: string } | null;

const strategies: Array<{
  id: ShadowStrategy;
  label: string;
  description: string;
}> = [
  {
    id: "conservative",
    label: "Conservative",
    description: "Protect active users and favor clearly reversible savings.",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Explore more savings while keeping hard constraints visible.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start from Reality without a predefined posture.",
  },
];

function ShadowStarter({
  disabled,
  onCreateShadow,
  onLoadExampleFutures,
}: ShadowStarterProps) {
  const [name, setName] = useState("Conservative");
  const [strategy, setStrategy] = useState<ShadowStrategy>("conservative");
  const [pending, setPending] = useState<"create" | "examples" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setLocalError("Give this future a name with at least two characters.");
      return;
    }

    setPending("create");
    setLocalError(null);
    try {
      await onCreateShadow({ name: normalizedName, strategy });
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "The Shadow could not be created.",
      );
    } finally {
      setPending(null);
    }
  }

  async function loadExamples() {
    if (!onLoadExampleFutures) return;
    setPending("examples");
    setLocalError(null);
    try {
      await onLoadExampleFutures();
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Example futures could not be loaded.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      className="mx-auto max-w-3xl"
      aria-labelledby="create-shadow-title"
    >
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
            <Layers3
              aria-hidden="true"
              className="h-4.5 w-4.5 text-[var(--accent)]"
            />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Create staged future
            </p>
            <h2
              id="create-shadow-title"
              className="mt-2 text-xl font-medium tracking-[-0.025em] text-white sm:text-2xl"
            >
              Begin a Shadow
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
              Branch from Reality v1. Proposed changes stay isolated until a
              human deliberately commits them.
            </p>
          </div>
        </div>

        <form className="mt-7" onSubmit={handleSubmit}>
          <label
            htmlFor="shadow-name"
            className="text-xs font-medium text-[var(--text-secondary)]"
          >
            Shadow name
          </label>
          <input
            id="shadow-name"
            name="shadowName"
            type="text"
            value={name}
            maxLength={48}
            autoComplete="off"
            disabled={disabled || pending !== null}
            aria-describedby={localError ? "shadow-create-error" : undefined}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <fieldset className="mt-6">
            <legend className="text-xs font-medium text-[var(--text-secondary)]">
              Strategy
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {strategies.map((option) => (
                <label
                  key={option.id}
                  className={`cursor-pointer rounded-lg border p-3.5 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)] ${strategy === option.id ? "border-[var(--accent)] bg-[color:var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface-subtle)] hover:border-[var(--border-strong)]"}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="strategy"
                      value={option.id}
                      checked={strategy === option.id}
                      disabled={disabled || pending !== null}
                      onChange={() => setStrategy(option.id)}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    <span className="text-xs font-medium text-white">
                      {option.label}
                    </span>
                  </span>
                  <span className="mt-2 block text-[11px] leading-5 text-[var(--text-faint)]">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {localError ? (
            <p
              id="shadow-create-error"
              role="alert"
              className="mt-4 text-xs text-[var(--danger)]"
            >
              {localError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={disabled || pending !== null}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending === "create" ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : (
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {pending === "create" ? "Creating…" : "Begin Shadow"}
          </button>
        </form>

        {onLoadExampleFutures ? (
          <div className="mt-7 flex flex-col gap-4 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-white">
                Demo replay fallback
              </p>
              <p className="mt-1 max-w-md text-[11px] leading-5 text-[var(--text-muted)]">
                Dispatch the same application commands to create the named
                Conservative and Aggressive futures. This is not a live agent.
              </p>
            </div>
            <button
              type="button"
              disabled={disabled || pending !== null}
              onClick={() => void loadExamples()}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending === "examples" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <Play aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {pending === "examples"
                ? "Loading examples…"
                : "Load example futures"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AggregateImpact({ impact }: { impact: Impact | null | undefined }) {
  const safeImpact: Impact = impact ?? {
    monthlySavingsCents: 0,
    annualSavingsCents: 0,
    savingsBasisPoints: 0,
    contractPenaltyCents: 0,
    activeUsersAffected: 0,
    activeEngineeringUsersAffected: 0,
    risk: "low",
  };

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Monthly savings
        </dt>
        <dd className="mt-3 font-mono text-xl text-[var(--success)]">
          {formatMoney(safeImpact.monthlySavingsCents)}
        </dd>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Annual savings
        </dt>
        <dd className="mt-3 font-mono text-xl text-white">
          {formatMoney(safeImpact.annualSavingsCents)}
        </dd>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Savings rate
        </dt>
        <dd className="mt-3 font-mono text-xl text-white">
          {percentageFormatter.format(safeImpact.savingsBasisPoints / 100)}%
        </dd>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Active users affected
        </dt>
        <dd className="mt-3 font-mono text-xl text-white">
          {safeImpact.activeUsersAffected}
        </dd>
      </div>
    </dl>
  );
}

function ConstraintSummary({
  impact,
  blockers,
  warnings,
}: {
  impact: Impact | null | undefined;
  blockers: ConstraintCheck[];
  warnings: ConstraintCheck[];
}) {
  const blocked = blockers.length > 0;
  const warned = warnings.length > 0;
  const risk = blocked ? "high" : (impact?.risk ?? "low");

  return (
    <div
      className={`mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${blocked ? "border-[var(--danger)] bg-[color:var(--danger)]/5" : warned ? "border-[var(--warning)] bg-[color:var(--warning)]/5" : "border-[var(--border)] bg-[var(--surface-subtle)]"}`}
    >
      <div className="flex items-start gap-3">
        {blocked ? (
          <CircleX
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]"
          />
        ) : warned ? (
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]"
          />
        ) : (
          <CircleCheck
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]"
          />
        )}
        <div>
          <p
            className={`text-xs font-medium ${blocked ? "text-[var(--danger)]" : warned ? "text-[var(--warning)]" : "text-white"}`}
          >
            {blocked
              ? "This future cannot be committed"
              : warned
                ? "This future needs human acknowledgement"
                : "No critical constraints violated"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
            {blocked
              ? `${blockers.length} hard blocker${blockers.length === 1 ? "" : "s"} must be resolved.`
              : warned
                ? `${warnings.length} advisory warning${warnings.length === 1 ? "" : "s"} remains visible for review.`
                : "Every calculated hard constraint currently passes."}
          </p>
        </div>
      </div>
      <span
        className={`w-fit rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${risk === "high" ? "border-[var(--danger)] text-[var(--danger)]" : risk === "medium" ? "border-[var(--warning)] text-[var(--warning)]" : "border-[var(--success)] text-[var(--success)]"}`}
      >
        {risk} risk
      </span>
    </div>
  );
}

function legacyAdobeChange(
  change: StagedSeatChangeCard,
  proof: ActionProof | null | undefined,
): StagedChangeCardView {
  return {
    id: change.id,
    productName: change.productName,
    planName: change.planName,
    actionType: "seat-count",
    previousLabel: change.previousSeats,
    proposedLabel: change.proposedSeats,
    unitLabel: "seats",
    monthlySavingsCents: change.monthlySavingsCents,
    activeUsersAffected: change.activeUsersAffected,
    activeUsers90d: change.activeUsers90d,
    inactiveUsers90d: change.inactiveUsers90d,
    contractPenaltyCents: proof?.impact.contractPenaltyCents ?? 0,
    risk: change.risk,
    checks: proof?.checks,
  };
}

function uniqueChecks(checks: ConstraintCheck[]): ConstraintCheck[] {
  return Array.from(
    new Map(checks.map((check) => [check.code, check])).values(),
  );
}

export function ShadowWorkbench({
  shadow,
  stagedChanges,
  stagedAdobeChange = null,
  impact,
  blockers = [],
  warnings = [],
  proofsByChangeId = {},
  proof = null,
  protectedTeamNames,
  error,
  disabled,
  onCreateShadow,
  onStageAdobe,
  onRemoveChange,
  onInspectChange,
  onLoadExampleFutures,
}: ShadowWorkbenchProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!shadow) {
    return (
      <ShadowStarter
        disabled={disabled}
        onCreateShadow={onCreateShadow}
        onLoadExampleFutures={onLoadExampleFutures}
      />
    );
  }
  const activeShadow = shadow;
  const changes =
    stagedChanges ??
    (stagedAdobeChange ? [legacyAdobeChange(stagedAdobeChange, proof)] : []);
  const derivedBlockers = uniqueChecks(
    blockers.length > 0
      ? blockers
      : changes.flatMap((change) =>
          (change.checks ?? []).filter(
            (check) => !check.passed && check.severity === "hard-blocker",
          ),
        ),
  );
  const derivedWarnings = uniqueChecks(
    warnings.length > 0
      ? warnings
      : changes.flatMap((change) =>
          (change.checks ?? []).filter(
            (check) => !check.passed && check.severity === "advisory",
          ),
        ),
  );
  const selectedChange = changes.find(
    (change) => change.id === selectedChangeId,
  );
  const selectedProof = selectedChangeId
    ? (proofsByChangeId[selectedChangeId] ??
      (stagedAdobeChange?.id === selectedChangeId ? proof : null))
    : null;

  async function runAction(
    action: Exclude<PendingAction, null>,
    callback: () => void | Promise<void>,
  ) {
    setPendingAction(action);
    setLocalError(null);
    try {
      await callback();
    } catch (caught) {
      setLocalError(
        caught instanceof Error
          ? caught.message
          : "The change could not be applied.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function inspectProof(change: StagedChangeCardView) {
    onInspectChange?.(activeShadow.id, change.id);
    setSelectedChangeId(change.id);
    setProofOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Shadow · Reality v{activeShadow.baseRealityVersion}
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl">
            {activeShadow.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Revision {activeShadow.revision} · {activeShadow.strategy} strategy
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--accent)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Staged future
        </span>
      </header>

      <div className="pt-7">
        <AggregateImpact impact={impact} />
        <ConstraintSummary
          impact={impact}
          blockers={derivedBlockers}
          warnings={derivedWarnings}
        />

        <section className="mt-8" aria-labelledby="staged-changes-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="staged-changes-title"
                className="text-sm font-medium text-white"
              >
                Staged changes
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Reality remains unchanged while this future is edited.
              </p>
            </div>
            <span className="font-mono text-xs text-[var(--text-faint)]">
              {changes.length} {changes.length === 1 ? "change" : "changes"}
            </span>
          </div>

          {changes.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {changes.map((change) => (
                <StagedChangeCard
                  key={change.id}
                  change={change}
                  disabled={disabled || pendingAction !== null}
                  removing={
                    pendingAction?.kind === "remove" &&
                    pendingAction.changeId === change.id
                  }
                  onInspect={() => inspectProof(change)}
                  onRemove={() =>
                    void runAction(
                      { kind: "remove", changeId: change.id },
                      () => onRemoveChange(activeShadow.id, change.id),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] p-6 text-center sm:p-8">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--accent)]"
                />
              </span>
              <h3 className="mt-4 text-sm font-medium text-white">
                Stage the first reversible action
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--text-muted)]">
                Read usage and contract evidence, then stage a semantic change
                without mutating Reality.
              </p>
              {onStageAdobe ? (
                <button
                  type="button"
                  disabled={disabled || pendingAction !== null}
                  onClick={() =>
                    void runAction({ kind: "stage-adobe" }, () =>
                      onStageAdobe(activeShadow.id),
                    )
                  }
                  className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction?.kind === "stage-adobe" ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                  ) : (
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {pendingAction?.kind === "stage-adobe"
                    ? "Staging…"
                    : "Stage Adobe 63 → 17"}
                </button>
              ) : null}
            </div>
          )}

          {error || localError ? (
            <p role="alert" className="mt-4 text-xs text-[var(--danger)]">
              {localError ?? error}
            </p>
          ) : null}
        </section>
      </div>

      <ProofDrawer
        open={proofOpen}
        proof={selectedProof}
        productName={selectedChange?.productName ?? "Staged change"}
        protectedTeamNames={protectedTeamNames}
        onClose={() => setProofOpen(false)}
      />
    </div>
  );
}

export { ShadowStarter };
