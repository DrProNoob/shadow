"use client";

import { loadExampleFutures } from "@/application/named-futures";
import { getSubscriptionContext } from "@/application/queries";
import {
  beginShadow,
  removeShadowChange,
  stageSeatChange,
} from "@/application/shadow-service";
import { OrbitOverview } from "@/components/reality/orbit-overview";
import { useWorkspace } from "@/components/shell/workspace-provider";
import {
  ShadowWorkbench,
  type CreateShadowInput,
} from "@/components/shadows/shadow-workbench";
import type { StagedChangeCardView } from "@/components/shadows/staged-change-card";
import type { ProjectedChange } from "@/domain/model";
import { projectShadow } from "@/domain/projection";

const ADOBE_SUBSCRIPTION_ID = "subscription-adobe";

function resultError(error: { message: string }): Error {
  return new Error(error.message);
}

function toStagedChangeCard(
  workspace: ReturnType<typeof useWorkspace>["workspace"],
  projectedChange: ProjectedChange,
): StagedChangeCardView {
  const { change, before, after, impact, checks } = projectedChange;
  const context = getSubscriptionContext(workspace, change.subscriptionId);
  const productName =
    workspace.catalog.products[before.productId]?.name ?? change.subscriptionId;
  const beforePlan =
    workspace.catalog.plans[before.planId]?.name ?? before.planId;
  const afterPlan = workspace.catalog.plans[after.planId]?.name ?? after.planId;

  const transition =
    change.actionType === "seat-count"
      ? {
          previousLabel: before.seatCount,
          proposedLabel: after.seatCount,
          unitLabel: "seats",
        }
      : change.actionType === "plan"
        ? {
            previousLabel: beforePlan,
            proposedLabel: afterPlan,
            unitLabel: undefined,
          }
        : {
            previousLabel: "Active",
            proposedLabel: "Cancelled",
            unitLabel: undefined,
          };

  return {
    id: change.id,
    subscriptionId: change.subscriptionId,
    productName,
    planName: change.actionType === "plan" ? undefined : beforePlan,
    actionType: change.actionType,
    ...transition,
    monthlySavingsCents: impact.monthlySavingsCents,
    annualSavingsCents: impact.annualSavingsCents,
    activeUsersAffected: impact.activeUsersAffected,
    activeEngineeringUsersAffected: impact.activeEngineeringUsersAffected,
    contractPenaltyCents: impact.contractPenaltyCents,
    risk: impact.risk,
    activeUsers90d: context?.subscription.activeUsers90d,
    inactiveUsers90d:
      change.actionType === "seat-count"
        ? context?.subscription.inactiveUsers90d
        : undefined,
    checks,
  };
}

export function ShadowWorkspace() {
  const { workspace, store, hydrated, activeShadowId, selectShadow } =
    useWorkspace();
  const activeShadow = activeShadowId
    ? workspace.shadows[activeShadowId]
    : undefined;
  const projectionResult = activeShadow
    ? projectShadow(workspace.reality, activeShadow, workspace.catalog)
    : null;
  const projection = projectionResult?.ok ? projectionResult.value : null;
  const projectedAdobe = projection?.changes.find(
    ({ change }) => change.subscriptionId === ADOBE_SUBSCRIPTION_ID,
  );
  const stagedChanges =
    projection?.changes.map((change) =>
      toStagedChangeCard(workspace, change),
    ) ?? [];
  const proofsByChangeId = Object.fromEntries(
    (projection?.proofs ?? []).map((proof) => [proof.changeId, proof]),
  );
  const protectedTeamNames = activeShadow?.intent.protectedTeamIds
    .map((teamId) => workspace.catalog.teams[teamId]?.name)
    .filter((name): name is string => Boolean(name));

  async function handleCreateShadow(input: CreateShadowInput) {
    const result = beginShadow(workspace, input);
    if (!result.ok) throw resultError(result.error);
    store.replace(result.value.workspace);
    selectShadow(result.value.shadow.id);
  }

  async function handleStageAdobe(shadowId: string) {
    const result = stageSeatChange(workspace, {
      shadowId,
      subscriptionId: ADOBE_SUBSCRIPTION_ID,
      seatCount: 17,
      source: "ui",
    });
    if (!result.ok) throw resultError(result.error);
    store.replace(result.value.workspace);
  }

  async function handleRemoveChange(shadowId: string, changeId: string) {
    const result = removeShadowChange(workspace, {
      shadowId,
      changeId,
      source: "ui",
    });
    if (!result.ok) throw resultError(result.error);
    store.replace(result.value.workspace);
  }

  async function handleLoadExampleFutures() {
    const result = loadExampleFutures(workspace);
    if (!result.ok) throw resultError(result.error);
    store.replace(result.value.workspace);
    selectShadow(result.value.conservative.id);
  }

  if (!activeShadow) {
    return (
      <div className="space-y-12">
        <OrbitOverview />
        <div className="border-t border-[var(--border)] pt-10">
          <ShadowWorkbench
            shadow={null}
            disabled={!hydrated}
            onCreateShadow={handleCreateShadow}
            onStageAdobe={handleStageAdobe}
            onRemoveChange={handleRemoveChange}
            onLoadExampleFutures={
              Object.keys(workspace.shadows).length === 0
                ? handleLoadExampleFutures
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <ShadowWorkbench
      shadow={activeShadow}
      stagedChanges={stagedChanges}
      impact={projection?.totalImpact}
      proofsByChangeId={proofsByChangeId}
      proof={projectedAdobe?.proof ?? null}
      blockers={projection?.hardBlockers}
      warnings={projection?.warnings}
      protectedTeamNames={protectedTeamNames}
      error={
        projectionResult && !projectionResult.ok
          ? projectionResult.error.message
          : null
      }
      disabled={!hydrated}
      onCreateShadow={handleCreateShadow}
      onStageAdobe={handleStageAdobe}
      onRemoveChange={handleRemoveChange}
    />
  );
}
