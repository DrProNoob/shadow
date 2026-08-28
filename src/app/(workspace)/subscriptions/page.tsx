"use client";

import {
  listProjectedSubscriptions,
  listSubscriptions,
  type ProjectedSubscriptionView,
  type SubscriptionView,
} from "@/application/queries";
import {
  SubscriptionsView,
  type SubscriptionPortfolioContext,
  type SubscriptionPortfolioRow,
  type SubscriptionRowSafety,
} from "@/components/reality/subscriptions-view";
import { useWorkspace } from "@/components/shell/workspace-provider";
import type { RiskLevel, ShadowProjection } from "@/domain/model";
import { projectShadow } from "@/domain/projection";

const riskRank: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const safeBaseline: SubscriptionRowSafety = {
  activeUsersAffected: 0,
  activeEngineeringUsersAffected: 0,
  contractPenaltyCents: 0,
  risk: "low",
  hardBlockerCount: 0,
  warningCount: 0,
};

function toRealityRows(
  subscriptions: SubscriptionView[],
): SubscriptionPortfolioRow[] {
  return subscriptions.map((subscription) => ({
    id: subscription.id,
    productId: subscription.productId,
    productName: subscription.productName,
    baseline: subscription,
    projected: subscription,
    changed: false,
    changeKinds: [],
    changeIds: [],
    monthlySavingsCents: 0,
    annualSavingsCents: 0,
    safety: safeBaseline,
  }));
}

function getRowSafety(
  row: ProjectedSubscriptionView,
  projection: ShadowProjection,
): SubscriptionRowSafety {
  const projectedChanges = projection.changes.filter(
    (change) => change.change.subscriptionId === row.id,
  );
  const checks = projectedChanges.flatMap((change) => change.checks);
  const activeUsersAffected = new Set(
    projectedChanges.flatMap((change) => change.affectedPersonIds),
  ).size;
  const activeEngineeringUsersAffected = new Set(
    projectedChanges.flatMap((change) => change.affectedEngineeringPersonIds),
  ).size;
  const risk = projectedChanges.reduce<RiskLevel>(
    (highest, change) =>
      riskRank[change.impact.risk] > riskRank[highest]
        ? change.impact.risk
        : highest,
    "low",
  );

  return {
    activeUsersAffected,
    activeEngineeringUsersAffected,
    contractPenaltyCents: projectedChanges.reduce(
      (total, change) => total + change.impact.contractPenaltyCents,
      0,
    ),
    risk,
    hardBlockerCount: checks.filter(
      (check) => check.severity === "hard-blocker" && !check.passed,
    ).length,
    warningCount: checks.filter(
      (check) => check.severity === "advisory" && !check.passed,
    ).length,
  };
}

function toProjectedRows(
  subscriptions: ProjectedSubscriptionView[],
  projection: ShadowProjection,
): SubscriptionPortfolioRow[] {
  return subscriptions.map((subscription) => ({
    ...subscription,
    safety: getRowSafety(subscription, projection),
  }));
}

export default function SubscriptionsPage() {
  const { workspace, activeShadowId } = useWorkspace();
  const baseline = listSubscriptions(workspace);

  if (!activeShadowId) {
    return (
      <SubscriptionsView
        rows={toRealityRows(baseline)}
        context={{ kind: "reality", realityVersion: workspace.reality.version }}
      />
    );
  }

  const shadow = workspace.shadows[activeShadowId];
  if (!shadow) {
    return (
      <SubscriptionsView
        rows={toRealityRows(baseline)}
        context={{ kind: "reality", realityVersion: workspace.reality.version }}
      />
    );
  }

  const projectionResult = projectShadow(
    workspace.reality,
    shadow,
    workspace.catalog,
  );

  if (!projectionResult.ok) {
    const context: SubscriptionPortfolioContext = {
      kind: "shadow",
      shadowId: shadow.id,
      name: shadow.name,
      strategy: shadow.strategy,
      status: shadow.status,
      baseRealityVersion: shadow.baseRealityVersion,
      currentRealityVersion: workspace.reality.version,
      revision: shadow.revision,
      changeCount: shadow.changes.length,
      hardBlockerCount: 0,
      warningCount: 0,
      projectionError: projectionResult.error.message,
    };
    return (
      <SubscriptionsView rows={toRealityRows(baseline)} context={context} />
    );
  }

  const projection = projectionResult.value;
  return (
    <SubscriptionsView
      rows={toProjectedRows(
        listProjectedSubscriptions(workspace, projection),
        projection,
      )}
      context={{
        kind: "shadow",
        shadowId: shadow.id,
        name: shadow.name,
        strategy: shadow.strategy,
        status: shadow.status,
        baseRealityVersion: shadow.baseRealityVersion,
        currentRealityVersion: workspace.reality.version,
        revision: shadow.revision,
        changeCount: shadow.changes.length,
        totalImpact: projection.totalImpact,
        hardBlockerCount: projection.hardBlockers.length,
        warningCount: projection.warnings.length,
      }}
    />
  );
}
