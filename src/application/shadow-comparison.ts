import { validateEditableShadow } from "@/application/shadow-service";
import type {
  Impact,
  Result,
  Shadow,
  ShadowProjection,
  ShadowStrategy,
  SubscriptionState,
  WorkspaceState,
} from "@/domain/model";
import { projectShadow } from "@/domain/projection";

export type ComparisonFuture = {
  shadowId: string;
  name: string;
  strategy: ShadowStrategy;
  revision: number;
  changeCount: number;
  impact: Impact;
  hardBlockerCount: number;
  warningCount: number;
};

export type ComparisonSubscriptionState = {
  status: SubscriptionState["status"];
  planId: string;
  planName: string;
  seatCount: number;
  monthlyCostCents: number;
  monthlySavingsCents: number;
  changed: boolean;
  changeIds: string[];
};

export type ComparisonDifferenceKind =
  "status" | "plan" | "seats" | "monthly-cost";

export type ShadowComparisonRow = {
  subscriptionId: string;
  productName: string;
  reality: ComparisonSubscriptionState;
  left: ComparisonSubscriptionState;
  right: ComparisonSubscriptionState;
  differenceKinds: ComparisonDifferenceKind[];
};

export type ShadowComparison = {
  realityVersion: number;
  left: ComparisonFuture;
  right: ComparisonFuture;
  rows: ShadowComparisonRow[];
};

function comparisonFuture(
  shadow: Shadow,
  projection: ShadowProjection,
): ComparisonFuture {
  return {
    shadowId: shadow.id,
    name: shadow.name,
    strategy: shadow.strategy,
    revision: shadow.revision,
    changeCount: projection.changes.length,
    impact: { ...projection.totalImpact },
    hardBlockerCount: projection.hardBlockers.length,
    warningCount: projection.warnings.length,
  };
}

function subscriptionState(
  workspace: WorkspaceState,
  baseline: SubscriptionState,
  projected: SubscriptionState,
  projection: ShadowProjection | null,
): ComparisonSubscriptionState {
  const plan = workspace.catalog.plans[projected.planId];
  const changeIds =
    projection?.changes
      .filter((change) => change.change.subscriptionId === baseline.id)
      .map((change) => change.change.id) ?? [];
  return {
    status: projected.status,
    planId: projected.planId,
    planName: plan.name,
    seatCount: projected.seatCount,
    monthlyCostCents: projected.monthlyCostCents,
    monthlySavingsCents: baseline.monthlyCostCents - projected.monthlyCostCents,
    changed:
      baseline.status !== projected.status ||
      baseline.planId !== projected.planId ||
      baseline.seatCount !== projected.seatCount ||
      baseline.monthlyCostCents !== projected.monthlyCostCents,
    changeIds,
  };
}

export function compareShadows(
  workspace: WorkspaceState,
  leftShadowId: string,
  rightShadowId: string,
): Result<ShadowComparison> {
  const leftResult = validateEditableShadow(workspace, leftShadowId);
  if (!leftResult.ok) return leftResult;
  const rightResult = validateEditableShadow(workspace, rightShadowId);
  if (!rightResult.ok) return rightResult;
  const leftShadow = leftResult.value;
  const rightShadow = rightResult.value;
  if (leftShadow.id === rightShadow.id) {
    return {
      ok: false,
      error: {
        code: "CHANGE_CONFLICT",
        message: "Choose two different Shadows to compare.",
        retryable: true,
        details: { leftShadowId, rightShadowId },
      },
    };
  }
  if (leftShadow.baseRealityVersion !== rightShadow.baseRealityVersion) {
    return {
      ok: false,
      error: {
        code: "SHADOW_STALE",
        message: "Compared Shadows must share the same Reality version.",
        retryable: false,
        details: {
          leftRealityVersion: leftShadow.baseRealityVersion,
          rightRealityVersion: rightShadow.baseRealityVersion,
        },
      },
    };
  }
  const leftProjectionResult = projectShadow(
    workspace.reality,
    leftShadow,
    workspace.catalog,
  );
  if (!leftProjectionResult.ok) return leftProjectionResult;
  const rightProjectionResult = projectShadow(
    workspace.reality,
    rightShadow,
    workspace.catalog,
  );
  if (!rightProjectionResult.ok) return rightProjectionResult;
  const leftProjection = leftProjectionResult.value;
  const rightProjection = rightProjectionResult.value;
  const rows = Object.values(workspace.reality.subscriptions)
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((baseline) => {
      const leftState = subscriptionState(
        workspace,
        baseline,
        leftProjection.projectedReality.subscriptions[baseline.id],
        leftProjection,
      );
      const rightState = subscriptionState(
        workspace,
        baseline,
        rightProjection.projectedReality.subscriptions[baseline.id],
        rightProjection,
      );
      if (!leftState.changed && !rightState.changed) return [];
      const differenceKinds: ComparisonDifferenceKind[] = [];
      if (leftState.status !== rightState.status)
        differenceKinds.push("status");
      if (leftState.planId !== rightState.planId) differenceKinds.push("plan");
      if (leftState.seatCount !== rightState.seatCount) {
        differenceKinds.push("seats");
      }
      if (leftState.monthlyCostCents !== rightState.monthlyCostCents) {
        differenceKinds.push("monthly-cost");
      }
      const product = workspace.catalog.products[baseline.productId];
      return [
        {
          subscriptionId: baseline.id,
          productName: product.name,
          reality: subscriptionState(workspace, baseline, baseline, null),
          left: leftState,
          right: rightState,
          differenceKinds,
        } satisfies ShadowComparisonRow,
      ];
    });

  return {
    ok: true,
    value: {
      realityVersion: workspace.reality.version,
      left: comparisonFuture(leftShadow, leftProjection),
      right: comparisonFuture(rightShadow, rightProjection),
      rows,
    },
  };
}
