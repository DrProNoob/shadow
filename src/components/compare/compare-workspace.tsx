"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitCompareArrows, Play } from "lucide-react";
import {
  compareShadows,
  type ComparisonSubscriptionState,
  type ShadowComparison,
  type ShadowComparisonRow,
} from "@/application/shadow-comparison";
import { loadExampleFutures } from "@/application/named-futures";
import {
  copyChangeBetweenShadows,
  forkShadow,
} from "@/application/shadow-service";
import { CompareFutures } from "@/components/compare/compare-futures";
import type {
  CompareFuturesView,
  ComparedFutureView,
  ComparedProductState,
  HybridProposalView,
} from "@/components/compare/compare-model";
import { useWorkspace } from "@/components/shell/workspace-provider";
import type {
  Shadow,
  ShadowProjection,
  SubscriptionId,
  WorkspaceState,
} from "@/domain/model";
import { projectShadow } from "@/domain/projection";

const FIGMA_SUBSCRIPTION_ID = "subscription-figma";

function resultError(error: { message: string }): Error {
  return new Error(error.message);
}

function affectedUsers(
  projection: ShadowProjection,
  subscriptionId: SubscriptionId,
): number {
  return new Set(
    projection.changes
      .filter((item) => item.change.subscriptionId === subscriptionId)
      .flatMap((item) => item.affectedPersonIds),
  ).size;
}

function productState(
  row: ShadowComparisonRow,
  state: ComparisonSubscriptionState,
  projection: ShadowProjection,
): ComparedProductState {
  const projectedChanges = projection.changes.filter(
    (item) => item.change.subscriptionId === row.subscriptionId,
  );
  const contractPenaltyCents = projectedChanges.reduce(
    (total, item) => total + item.impact.contractPenaltyCents,
    0,
  );
  const blocked = projectedChanges.some((item) =>
    item.checks.some(
      (check) => !check.passed && check.severity === "hard-blocker",
    ),
  );
  const activeUsersAffected = affectedUsers(projection, row.subscriptionId);
  const planChanged = state.planId !== row.reality.planId;
  const seatsChanged = state.seatCount !== row.reality.seatCount;

  if (state.status === "cancelled") {
    return {
      kind: "cancel",
      previousPlanName: row.reality.planName,
      monthlySavingsCents: state.monthlySavingsCents,
      contractPenaltyCents,
      blocked,
    };
  }
  if (planChanged && seatsChanged) {
    return {
      kind: "plan-and-seat",
      previousPlanName: row.reality.planName,
      proposedPlanName: state.planName,
      previousSeats: row.reality.seatCount,
      proposedSeats: state.seatCount,
      monthlySavingsCents: state.monthlySavingsCents,
      activeUsersAffected,
    };
  }
  if (planChanged) {
    return {
      kind: "plan",
      previousPlanName: row.reality.planName,
      proposedPlanName: state.planName,
      monthlySavingsCents: state.monthlySavingsCents,
    };
  }
  if (seatsChanged) {
    return {
      kind: "seat",
      planName: state.planName,
      previousSeats: row.reality.seatCount,
      proposedSeats: state.seatCount,
      monthlySavingsCents: state.monthlySavingsCents,
      activeUsersAffected,
    };
  }
  return {
    kind: "keep",
    label: "Keep",
    planName: state.planName,
    seatCount: state.seatCount,
  };
}

function futureView(
  shadow: Shadow,
  comparison: ShadowComparison["left"],
): ComparedFutureView {
  return {
    shadowId: comparison.shadowId,
    name: comparison.name,
    strategy: comparison.strategy,
    baseRealityVersion: shadow.baseRealityVersion,
    revision: comparison.revision,
    monthlySavingsCents: comparison.impact.monthlySavingsCents,
    annualSavingsCents: comparison.impact.annualSavingsCents,
    savingsBasisPoints: comparison.impact.savingsBasisPoints,
    actionCount: comparison.changeCount,
    activeUsersAffected: comparison.impact.activeUsersAffected,
    activeEngineeringUsersAffected:
      comparison.impact.activeEngineeringUsersAffected,
    contractPenaltyCents: comparison.impact.contractPenaltyCents,
    risk: comparison.impact.risk,
    blockerCount: comparison.hardBlockerCount,
    warningCount: comparison.warningCount,
  };
}

function toCompareFuturesView(
  workspace: WorkspaceState,
  comparison: ShadowComparison,
  leftProjection: ShadowProjection,
  rightProjection: ShadowProjection,
): CompareFuturesView {
  const leftShadow = workspace.shadows[comparison.left.shadowId];
  const rightShadow = workspace.shadows[comparison.right.shadowId];
  const figmaChange = rightShadow.changes.find(
    (change) =>
      change.subscriptionId === FIGMA_SUBSCRIPTION_ID &&
      change.actionType === "seat-count" &&
      leftShadow.changes.every(
        (leftChange) =>
          leftChange.subscriptionId !== FIGMA_SUBSCRIPTION_ID ||
          leftChange.actionType !== "seat-count" ||
          leftChange.proposedValue !== change.proposedValue,
      ),
  );
  const hybridProposal: HybridProposalView | undefined = figmaChange
    ? {
        baseShadowId: leftShadow.id,
        sourceShadowId: rightShadow.id,
        sourceChangeId: figmaChange.id,
        sourceProductName: "Figma",
        name: "Hybrid",
        description: `Fork ${leftShadow.name}, then copy only the Figma optimization from ${rightShadow.name}.`,
      }
    : undefined;

  return {
    realityVersion: comparison.realityVersion,
    left: futureView(leftShadow, comparison.left),
    right: futureView(rightShadow, comparison.right),
    products: comparison.rows.map((row) => ({
      subscriptionId: row.subscriptionId,
      productName: row.productName,
      category:
        workspace.catalog.products[
          workspace.reality.subscriptions[row.subscriptionId].productId
        ]?.category,
      different: row.differenceKinds.length > 0,
      left: productState(row, row.left, leftProjection),
      right: productState(row, row.right, rightProjection),
    })),
    hybridProposal,
  };
}

function EmptyCompare({
  canLoadExamples,
  disabled,
  onLoadExamples,
}: {
  canLoadExamples: boolean;
  disabled: boolean;
  onLoadExamples: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-10">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
        <GitCompareArrows className="h-4.5 w-4.5 text-[var(--accent)]" />
      </span>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Compare Futures
      </p>
      <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-white">
        Two Shadows are required
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--text-muted)]">
        Create two staged futures from the same Reality version to inspect their
        financial and operational differences side by side.
      </p>
      {canLoadExamples ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onLoadExamples}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
        >
          <Play aria-hidden="true" className="h-3.5 w-3.5" />
          Load example futures
        </button>
      ) : (
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-xs font-medium text-white hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Return to workspace
        </Link>
      )}
    </section>
  );
}

export function CompareWorkspace({
  requestedLeftId,
  requestedRightId,
}: {
  requestedLeftId?: string;
  requestedRightId?: string;
}) {
  const router = useRouter();
  const { workspace, store, hydrated, activeShadowId, selectShadow } =
    useWorkspace();
  const shadows = Object.values(workspace.shadows).filter(
    (shadow) =>
      shadow.status === "draft" &&
      shadow.baseRealityVersion === workspace.reality.version,
  );
  const leftShadow =
    shadows.find((shadow) => shadow.id === requestedLeftId) ??
    shadows.find((shadow) => shadow.name === "Conservative") ??
    shadows[0];
  const rightShadow =
    shadows.find(
      (shadow) =>
        shadow.id === requestedRightId && shadow.id !== leftShadow?.id,
    ) ??
    shadows.find(
      (shadow) => shadow.name === "Aggressive" && shadow.id !== leftShadow?.id,
    ) ??
    shadows.find((shadow) => shadow.id !== leftShadow?.id);

  async function loadExamples() {
    const result = loadExampleFutures(workspace);
    if (!result.ok) throw resultError(result.error);
    store.replace(result.value.workspace);
    selectShadow(result.value.conservative.id);
  }

  if (!leftShadow || !rightShadow) {
    return (
      <EmptyCompare
        canLoadExamples={shadows.length === 0}
        disabled={!hydrated}
        onLoadExamples={() => void loadExamples()}
      />
    );
  }

  const comparisonResult = compareShadows(
    workspace,
    leftShadow.id,
    rightShadow.id,
  );
  const leftProjectionResult = projectShadow(
    workspace.reality,
    leftShadow,
    workspace.catalog,
  );
  const rightProjectionResult = projectShadow(
    workspace.reality,
    rightShadow,
    workspace.catalog,
  );
  if (
    !comparisonResult.ok ||
    !leftProjectionResult.ok ||
    !rightProjectionResult.ok
  ) {
    const message = !comparisonResult.ok
      ? comparisonResult.error.message
      : !leftProjectionResult.ok
        ? leftProjectionResult.error.message
        : rightProjectionResult.ok
          ? "The comparison could not be calculated."
          : rightProjectionResult.error.message;
    return (
      <div
        role="alert"
        className="rounded-xl border border-[var(--danger)] p-5 text-sm text-[var(--danger)]"
      >
        {message}
      </div>
    );
  }
  const view = toCompareFuturesView(
    workspace,
    comparisonResult.value,
    leftProjectionResult.value,
    rightProjectionResult.value,
  );

  async function createHybrid(proposal: HybridProposalView) {
    const forked = forkShadow(workspace, {
      sourceShadowId: proposal.baseShadowId,
      name: proposal.name,
      strategy: "custom",
      source: "ui",
    });
    if (!forked.ok) throw resultError(forked.error);
    const copied = copyChangeBetweenShadows(forked.value.workspace, {
      sourceShadowId: proposal.sourceShadowId,
      targetShadowId: forked.value.shadow.id,
      changeId: proposal.sourceChangeId,
      source: "ui",
    });
    if (!copied.ok) throw resultError(copied.error);
    store.replace(copied.value.workspace);
    selectShadow(copied.value.targetShadow.id);
    router.push("/");
  }

  return (
    <CompareFutures
      comparison={view}
      selectedShadowId={activeShadowId}
      onSelectLeft={selectShadow}
      onSelectRight={selectShadow}
      onCreateHybrid={createHybrid}
    />
  );
}
