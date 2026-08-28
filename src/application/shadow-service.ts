import {
  recordSuccessfulActivity,
  realityDateActivityClock,
  type ActivityClock,
} from "@/application/activity";
import type {
  CancellationChange,
  ChangeId,
  ChangeProvenance,
  DomainError,
  IntentSpec,
  PlanChange,
  PlanId,
  Result,
  SeatCountChange,
  Shadow,
  ShadowChange,
  ShadowId,
  ShadowProjection,
  ShadowStrategy,
  WorkspaceState,
} from "@/domain/model";
import { projectShadow } from "@/domain/projection";

export type ShadowIdFactory = {
  shadowId(sequence: number): ShadowId;
  changeId(sequence: number): ChangeId;
};

export const deterministicShadowIdFactory: ShadowIdFactory = {
  shadowId: (sequence) => `shadow-${String(sequence).padStart(3, "0")}`,
  changeId: (sequence) => `change-${String(sequence).padStart(3, "0")}`,
};

export type BeginShadowInput = {
  name: string;
  strategy?: ShadowStrategy;
  intent?: Partial<IntentSpec>;
  source?: ChangeProvenance["source"];
};

export type BeginShadowOutput = {
  workspace: WorkspaceState;
  shadow: Shadow;
};

export type StageSeatChangeInput = {
  shadowId: ShadowId;
  subscriptionId: string;
  seatCount: number;
  source?: ChangeProvenance["source"];
};

export type StageSeatChangeOutput = {
  workspace: WorkspaceState;
  shadow: Shadow;
  change: SeatCountChange;
  projection: ShadowProjection;
};

export type StagePlanChangeInput = {
  shadowId: ShadowId;
  subscriptionId: string;
  planId: PlanId;
  source?: ChangeProvenance["source"];
};

export type StagePlanChangeOutput = {
  workspace: WorkspaceState;
  shadow: Shadow;
  change: PlanChange;
  projection: ShadowProjection;
};

export type StageCancellationInput = {
  shadowId: ShadowId;
  subscriptionId: string;
  source?: ChangeProvenance["source"];
};

export type StageCancellationOutput = {
  workspace: WorkspaceState;
  shadow: Shadow;
  change: CancellationChange;
  projection: ShadowProjection;
};

export type RemoveShadowChangeInput = {
  shadowId: ShadowId;
  changeId: ChangeId;
  source?: ChangeProvenance["source"];
};

export type RemoveShadowChangeOutput = {
  workspace: WorkspaceState;
  shadow: Shadow;
  projection: ShadowProjection;
};

export type ForkShadowInput = {
  sourceShadowId: ShadowId;
  name: string;
  strategy?: ShadowStrategy;
  source?: ChangeProvenance["source"];
};

export type ForkShadowOutput = {
  workspace: WorkspaceState;
  parent: Shadow;
  shadow: Shadow;
  projection: ShadowProjection;
};

export type CopyChangeBetweenShadowsInput = {
  sourceShadowId: ShadowId;
  targetShadowId: ShadowId;
  changeId: ChangeId;
  source?: ChangeProvenance["source"];
};

export type CopyChangeBetweenShadowsOutput = {
  workspace: WorkspaceState;
  sourceShadow: Shadow;
  targetShadow: Shadow;
  change: ShadowChange;
  projection: ShadowProjection;
};

function failure<T>(error: DomainError): Result<T> {
  return { ok: false, error };
}

function canonicalChanges(changes: ShadowChange[]): ShadowChange[] {
  const rank: Record<ShadowChange["actionType"], number> = {
    plan: 0,
    "seat-count": 1,
    cancellation: 2,
  };
  return [...changes].sort(
    (left, right) =>
      left.subscriptionId.localeCompare(right.subscriptionId) ||
      rank[left.actionType] - rank[right.actionType] ||
      left.id.localeCompare(right.id),
  );
}

function changeIdExists(workspace: WorkspaceState, changeId: ChangeId) {
  return Object.values(workspace.shadows).some((shadow) =>
    shadow.changes.some((change) => change.id === changeId),
  );
}

function copyOperation(
  sourceChange: ShadowChange,
  targetShadowId: ShadowId,
  changeId: ChangeId,
  source: ChangeProvenance["source"],
  workspace: WorkspaceState,
  commandName:
    | "fork_shadow"
    | "copy_change_between_shadows" = "copy_change_between_shadows",
): ShadowChange {
  const subscription =
    workspace.reality.subscriptions[sourceChange.subscriptionId];
  const provenance: ChangeProvenance = {
    source,
    commandName,
    copiedFromChangeId: sourceChange.id,
  };
  if (sourceChange.actionType === "seat-count") {
    return {
      ...sourceChange,
      id: changeId,
      shadowId: targetShadowId,
      previousValue: subscription.seatCount,
      provenance,
    };
  }
  if (sourceChange.actionType === "plan") {
    return {
      ...sourceChange,
      id: changeId,
      shadowId: targetShadowId,
      previousValue: subscription.planId,
      provenance,
    };
  }
  return {
    ...sourceChange,
    id: changeId,
    shadowId: targetShadowId,
    previousValue: "active",
    provenance,
  };
}

function resolveIntent(
  workspace: WorkspaceState,
  input?: Partial<IntentSpec>,
): Result<IntentSpec> {
  const policyProtectedTeams =
    workspace.catalog.policies.protectedActiveTeamIds;
  const requestedPenaltyLimit =
    input?.maximumContractPenaltyCents ??
    workspace.catalog.policies.maximumContractPenaltyCents;
  const intent: IntentSpec = {
    minimumSavingsBasisPoints: input?.minimumSavingsBasisPoints ?? 2_000,
    protectedTeamIds: Array.from(
      new Set([...policyProtectedTeams, ...(input?.protectedTeamIds ?? [])]),
    ),
    maximumContractPenaltyCents: Math.min(
      requestedPenaltyLimit,
      workspace.catalog.policies.maximumContractPenaltyCents,
    ),
  };
  const invalidProtectedTeam = intent.protectedTeamIds.find(
    (teamId) => !workspace.catalog.teams[teamId],
  );
  if (
    !Number.isSafeInteger(intent.minimumSavingsBasisPoints) ||
    intent.minimumSavingsBasisPoints < 0 ||
    !Number.isSafeInteger(requestedPenaltyLimit) ||
    requestedPenaltyLimit < 0 ||
    invalidProtectedTeam
  ) {
    return failure({
      code: "INVALID_INTENT",
      message:
        "Intent savings and penalty values must be non-negative integers, and protected teams must exist.",
      retryable: true,
      details: invalidProtectedTeam ? { invalidProtectedTeam } : { intent },
    });
  }
  return { ok: true, value: intent };
}

export function validateEditableShadow(
  workspace: WorkspaceState,
  shadowId: ShadowId,
): Result<Shadow> {
  const shadow = workspace.shadows[shadowId];
  if (!shadow) {
    return failure({
      code: "SHADOW_NOT_FOUND",
      message: `Shadow ${shadowId} does not exist.`,
      retryable: true,
      details: { shadowId },
    });
  }
  if (shadow.status !== "draft") {
    return failure({
      code: "SHADOW_NOT_DRAFT",
      message: `Shadow ${shadowId} is ${shadow.status} and cannot be edited.`,
      retryable: false,
      details: { shadowId, status: shadow.status },
    });
  }
  if (shadow.baseRealityVersion !== workspace.reality.version) {
    return failure({
      code: "SHADOW_STALE",
      message: `Shadow ${shadowId} is based on Reality v${shadow.baseRealityVersion}; current Reality is v${workspace.reality.version}.`,
      retryable: false,
      details: {
        shadowId,
        baseRealityVersion: shadow.baseRealityVersion,
        realityVersion: workspace.reality.version,
      },
    });
  }
  return { ok: true, value: shadow };
}

export function beginShadow(
  workspace: WorkspaceState,
  input: BeginShadowInput,
  idFactory: ShadowIdFactory = deterministicShadowIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<BeginShadowOutput> {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 80) {
    return failure({
      code: "INVALID_SHADOW_NAME",
      message: "Shadow name must contain between 1 and 80 characters.",
      retryable: true,
      details: { suppliedLength: name.length },
    });
  }
  const intentResult = resolveIntent(workspace, input.intent);
  if (!intentResult.ok) return intentResult;

  const nextSequence = workspace.counters.shadow + 1;
  const shadowId = idFactory.shadowId(nextSequence);
  if (workspace.shadows[shadowId]) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated Shadow ID ${shadowId} already exists.`,
      retryable: false,
      details: { shadowId },
    });
  }
  const shadow: Shadow = {
    id: shadowId,
    name,
    strategy: input.strategy ?? "custom",
    baseRealityVersion: workspace.reality.version,
    revision: 0,
    status: "draft",
    intent: intentResult.value,
    changes: [],
  };
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: { ...workspace.counters, shadow: nextSequence },
    shadows: { ...workspace.shadows, [shadow.id]: shadow },
  };
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "begin_shadow",
      arguments: {
        name,
        strategy: shadow.strategy,
        intent: {
          ...shadow.intent,
          protectedTeamIds: [...shadow.intent.protectedTeamIds],
        },
      },
      shadowId: shadow.id,
      shadowRevision: shadow.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: { workspace: nextWorkspace, shadow },
  };
}

export function stageSeatChange(
  workspace: WorkspaceState,
  input: StageSeatChangeInput,
  idFactory: ShadowIdFactory = deterministicShadowIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<StageSeatChangeOutput> {
  const shadowResult = validateEditableShadow(workspace, input.shadowId);
  if (!shadowResult.ok) return shadowResult;
  const shadow = shadowResult.value;
  const subscription = workspace.reality.subscriptions[input.subscriptionId];
  if (!subscription || subscription.status !== "active") {
    return failure({
      code: "SUBSCRIPTION_NOT_FOUND",
      message: `Active subscription ${input.subscriptionId} does not exist.`,
      retryable: true,
      details: { subscriptionId: input.subscriptionId },
    });
  }
  if (!Number.isSafeInteger(input.seatCount) || input.seatCount < 0) {
    return failure({
      code: "INVALID_SEAT_COUNT",
      message: "Seat count must be a non-negative safe integer.",
      retryable: true,
      details: { seatCount: input.seatCount },
    });
  }
  if (
    shadow.changes.some(
      (change) =>
        change.subscriptionId === input.subscriptionId &&
        change.actionType === "cancellation",
    )
  ) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Remove the staged cancellation for ${input.subscriptionId} before changing its seats.`,
      retryable: true,
      details: { shadowId: shadow.id, subscriptionId: input.subscriptionId },
    });
  }
  if (input.seatCount === subscription.seatCount) {
    return failure({
      code: "NO_CHANGE",
      message: `Subscription ${input.subscriptionId} already has ${input.seatCount} seats in Reality. Remove the staged change instead.`,
      retryable: true,
      details: {
        subscriptionId: input.subscriptionId,
        seatCount: input.seatCount,
      },
    });
  }

  const existingChange = shadow.changes.find(
    (change): change is SeatCountChange =>
      change.subscriptionId === input.subscriptionId &&
      change.actionType === "seat-count",
  );
  const nextChangeSequence = existingChange
    ? workspace.counters.change
    : workspace.counters.change + 1;
  const changeId = existingChange?.id ?? idFactory.changeId(nextChangeSequence);
  const generatedIdAlreadyExists =
    !existingChange &&
    Object.values(workspace.shadows).some((candidateShadow) =>
      candidateShadow.changes.some((candidate) => candidate.id === changeId),
    );
  if (generatedIdAlreadyExists) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated change ID ${changeId} already exists.`,
      retryable: false,
      details: { changeId },
    });
  }
  const change: SeatCountChange = {
    id: changeId,
    shadowId: shadow.id,
    subscriptionId: input.subscriptionId,
    actionType: "seat-count",
    previousValue: subscription.seatCount,
    proposedValue: input.seatCount,
    provenance: {
      source: input.source ?? "ui",
      commandName: "stage_seat_change",
    },
  };
  const changes = existingChange
    ? shadow.changes.map((candidate) =>
        candidate.id === existingChange.id ? change : candidate,
      )
    : [...shadow.changes, change];
  const nextShadow: Shadow = {
    ...shadow,
    revision: shadow.revision + 1,
    intent: {
      ...shadow.intent,
      protectedTeamIds: [...shadow.intent.protectedTeamIds],
    },
    changes,
  };
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: { ...workspace.counters, change: nextChangeSequence },
    shadows: { ...workspace.shadows, [shadow.id]: nextShadow },
  };
  const projectionResult = projectShadow(
    workspace.reality,
    nextShadow,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "stage_seat_change",
      arguments: {
        shadowId: nextShadow.id,
        subscriptionId: subscription.id,
        seatCount: input.seatCount,
      },
      shadowId: nextShadow.id,
      shadowRevision: nextShadow.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      shadow: nextShadow,
      change,
      projection: projectionResult.value,
    },
  };
}

export function stagePlanChange(
  workspace: WorkspaceState,
  input: StagePlanChangeInput,
  idFactory: ShadowIdFactory = deterministicShadowIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<StagePlanChangeOutput> {
  const shadowResult = validateEditableShadow(workspace, input.shadowId);
  if (!shadowResult.ok) return shadowResult;
  const shadow = shadowResult.value;
  const subscription = workspace.reality.subscriptions[input.subscriptionId];
  if (!subscription || subscription.status !== "active") {
    return failure({
      code: "SUBSCRIPTION_NOT_FOUND",
      message: `Active subscription ${input.subscriptionId} does not exist.`,
      retryable: true,
      details: { subscriptionId: input.subscriptionId },
    });
  }
  const plan = workspace.catalog.plans[input.planId];
  if (!plan) {
    return failure({
      code: "PLAN_NOT_FOUND",
      message: `Plan ${input.planId} does not exist.`,
      retryable: true,
      details: { planId: input.planId },
    });
  }
  if (plan.productId !== subscription.productId) {
    return failure({
      code: "PLAN_PRODUCT_MISMATCH",
      message: `Plan ${plan.id} does not belong to subscription ${subscription.id}.`,
      retryable: true,
      details: {
        planId: plan.id,
        planProductId: plan.productId,
        subscriptionProductId: subscription.productId,
      },
    });
  }
  if (
    shadow.changes.some(
      (change) =>
        change.subscriptionId === subscription.id &&
        change.actionType === "cancellation",
    )
  ) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Remove the staged cancellation for ${subscription.id} before changing its plan.`,
      retryable: true,
      details: { shadowId: shadow.id, subscriptionId: subscription.id },
    });
  }
  if (plan.id === subscription.planId) {
    return failure({
      code: "NO_CHANGE",
      message: `Subscription ${subscription.id} already uses plan ${plan.id}. Remove the staged plan change instead.`,
      retryable: true,
      details: { subscriptionId: subscription.id, planId: plan.id },
    });
  }

  const existingChange = shadow.changes.find(
    (change): change is PlanChange =>
      change.subscriptionId === subscription.id && change.actionType === "plan",
  );
  const nextChangeSequence = existingChange
    ? workspace.counters.change
    : workspace.counters.change + 1;
  const changeId = existingChange?.id ?? idFactory.changeId(nextChangeSequence);
  const generatedIdAlreadyExists =
    !existingChange &&
    Object.values(workspace.shadows).some((candidateShadow) =>
      candidateShadow.changes.some((candidate) => candidate.id === changeId),
    );
  if (generatedIdAlreadyExists) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated change ID ${changeId} already exists.`,
      retryable: false,
      details: { changeId },
    });
  }
  const change: PlanChange = {
    id: changeId,
    shadowId: shadow.id,
    subscriptionId: subscription.id,
    actionType: "plan",
    previousValue: subscription.planId,
    proposedValue: plan.id,
    provenance: {
      source: input.source ?? "ui",
      commandName: "stage_plan_change",
    },
  };
  const changes = existingChange
    ? shadow.changes.map((candidate) =>
        candidate.id === existingChange.id ? change : candidate,
      )
    : [...shadow.changes, change];
  const nextShadow: Shadow = {
    ...shadow,
    revision: shadow.revision + 1,
    intent: {
      ...shadow.intent,
      protectedTeamIds: [...shadow.intent.protectedTeamIds],
    },
    changes,
  };
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: { ...workspace.counters, change: nextChangeSequence },
    shadows: { ...workspace.shadows, [shadow.id]: nextShadow },
  };
  const projectionResult = projectShadow(
    workspace.reality,
    nextShadow,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "stage_plan_change",
      arguments: {
        shadowId: nextShadow.id,
        subscriptionId: subscription.id,
        planId: plan.id,
      },
      shadowId: nextShadow.id,
      shadowRevision: nextShadow.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      shadow: nextShadow,
      change,
      projection: projectionResult.value,
    },
  };
}

export function stageCancellation(
  workspace: WorkspaceState,
  input: StageCancellationInput,
  idFactory: ShadowIdFactory = deterministicShadowIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<StageCancellationOutput> {
  const shadowResult = validateEditableShadow(workspace, input.shadowId);
  if (!shadowResult.ok) return shadowResult;
  const shadow = shadowResult.value;
  const subscription = workspace.reality.subscriptions[input.subscriptionId];
  if (!subscription || subscription.status !== "active") {
    return failure({
      code: "SUBSCRIPTION_NOT_FOUND",
      message: `Active subscription ${input.subscriptionId} does not exist.`,
      retryable: true,
      details: { subscriptionId: input.subscriptionId },
    });
  }
  const conflictingChange = shadow.changes.find(
    (change) =>
      change.subscriptionId === subscription.id &&
      change.actionType !== "cancellation",
  );
  if (conflictingChange) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Remove staged ${conflictingChange.actionType} change ${conflictingChange.id} before cancelling ${subscription.id}.`,
      retryable: true,
      details: {
        shadowId: shadow.id,
        subscriptionId: subscription.id,
        conflictingChangeId: conflictingChange.id,
      },
    });
  }
  const existingChange = shadow.changes.find(
    (change): change is CancellationChange =>
      change.subscriptionId === subscription.id &&
      change.actionType === "cancellation",
  );
  const nextChangeSequence = existingChange
    ? workspace.counters.change
    : workspace.counters.change + 1;
  const changeId = existingChange?.id ?? idFactory.changeId(nextChangeSequence);
  const generatedIdAlreadyExists =
    !existingChange &&
    Object.values(workspace.shadows).some((candidateShadow) =>
      candidateShadow.changes.some((candidate) => candidate.id === changeId),
    );
  if (generatedIdAlreadyExists) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated change ID ${changeId} already exists.`,
      retryable: false,
      details: { changeId },
    });
  }
  const change: CancellationChange = {
    id: changeId,
    shadowId: shadow.id,
    subscriptionId: subscription.id,
    actionType: "cancellation",
    previousValue: "active",
    proposedValue: "cancelled",
    provenance: {
      source: input.source ?? "ui",
      commandName: "stage_cancellation",
    },
  };
  const changes = existingChange
    ? shadow.changes.map((candidate) =>
        candidate.id === existingChange.id ? change : candidate,
      )
    : [...shadow.changes, change];
  const nextShadow: Shadow = {
    ...shadow,
    revision: shadow.revision + 1,
    intent: {
      ...shadow.intent,
      protectedTeamIds: [...shadow.intent.protectedTeamIds],
    },
    changes,
  };
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: { ...workspace.counters, change: nextChangeSequence },
    shadows: { ...workspace.shadows, [shadow.id]: nextShadow },
  };
  const projectionResult = projectShadow(
    workspace.reality,
    nextShadow,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "stage_cancellation",
      arguments: {
        shadowId: nextShadow.id,
        subscriptionId: subscription.id,
      },
      shadowId: nextShadow.id,
      shadowRevision: nextShadow.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      shadow: nextShadow,
      change,
      projection: projectionResult.value,
    },
  };
}

export function forkShadow(
  workspace: WorkspaceState,
  input: ForkShadowInput,
  idFactory: ShadowIdFactory = deterministicShadowIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<ForkShadowOutput> {
  const parentResult = validateEditableShadow(workspace, input.sourceShadowId);
  if (!parentResult.ok) return parentResult;
  const parent = parentResult.value;
  const name = input.name.trim();
  if (name.length === 0 || name.length > 80) {
    return failure({
      code: "INVALID_SHADOW_NAME",
      message: "Shadow name must contain between 1 and 80 characters.",
      retryable: true,
      details: { suppliedLength: name.length },
    });
  }

  const nextShadowSequence = workspace.counters.shadow + 1;
  const childId = idFactory.shadowId(nextShadowSequence);
  if (workspace.shadows[childId]) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated Shadow ID ${childId} already exists.`,
      retryable: false,
      details: { shadowId: childId },
    });
  }
  let nextChangeSequence = workspace.counters.change;
  const generatedIds = new Set<string>();
  const clonedChanges: ShadowChange[] = [];
  for (const sourceChange of canonicalChanges(parent.changes)) {
    nextChangeSequence += 1;
    const changeId = idFactory.changeId(nextChangeSequence);
    if (changeIdExists(workspace, changeId) || generatedIds.has(changeId)) {
      return failure({
        code: "CHANGE_CONFLICT",
        message: `Generated change ID ${changeId} already exists.`,
        retryable: false,
        details: { changeId },
      });
    }
    generatedIds.add(changeId);
    clonedChanges.push(
      copyOperation(
        sourceChange,
        childId,
        changeId,
        input.source ?? "ui",
        workspace,
        "fork_shadow",
      ),
    );
  }
  const child: Shadow = {
    id: childId,
    name,
    strategy: input.strategy ?? "custom",
    parentShadowId: parent.id,
    baseRealityVersion: parent.baseRealityVersion,
    revision: 0,
    status: "draft",
    intent: {
      ...parent.intent,
      protectedTeamIds: [...parent.intent.protectedTeamIds],
    },
    changes: clonedChanges,
  };
  const projectionResult = projectShadow(
    workspace.reality,
    child,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: {
      ...workspace.counters,
      shadow: nextShadowSequence,
      change: nextChangeSequence,
    },
    shadows: { ...workspace.shadows, [child.id]: child },
  };
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "fork_shadow",
      arguments: {
        sourceShadowId: parent.id,
        name,
        strategy: child.strategy,
        clonedChangeCount: child.changes.length,
      },
      shadowId: child.id,
      shadowRevision: child.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      parent,
      shadow: child,
      projection: projectionResult.value,
    },
  };
}

export function copyChangeBetweenShadows(
  workspace: WorkspaceState,
  input: CopyChangeBetweenShadowsInput,
  idFactory: ShadowIdFactory = deterministicShadowIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<CopyChangeBetweenShadowsOutput> {
  const sourceResult = validateEditableShadow(workspace, input.sourceShadowId);
  if (!sourceResult.ok) return sourceResult;
  const targetResult = validateEditableShadow(workspace, input.targetShadowId);
  if (!targetResult.ok) return targetResult;
  const sourceShadow = sourceResult.value;
  const targetShadow = targetResult.value;
  if (sourceShadow.id === targetShadow.id) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: "Source and target must be different Shadows.",
      retryable: true,
      details: {
        sourceShadowId: sourceShadow.id,
        targetShadowId: targetShadow.id,
      },
    });
  }
  if (sourceShadow.baseRealityVersion !== targetShadow.baseRealityVersion) {
    return failure({
      code: "SHADOW_STALE",
      message: "Source and target Shadows must share the same Reality version.",
      retryable: false,
      details: {
        sourceRealityVersion: sourceShadow.baseRealityVersion,
        targetRealityVersion: targetShadow.baseRealityVersion,
      },
    });
  }
  const sourceChange = sourceShadow.changes.find(
    (change) => change.id === input.changeId,
  );
  if (!sourceChange) {
    return failure({
      code: "CHANGE_NOT_FOUND",
      message: `Change ${input.changeId} does not exist in source Shadow ${sourceShadow.id}.`,
      retryable: true,
      details: { shadowId: sourceShadow.id, changeId: input.changeId },
    });
  }

  const targetChangesForSubscription = targetShadow.changes.filter(
    (change) => change.subscriptionId === sourceChange.subscriptionId,
  );
  const conflictingChanges = targetChangesForSubscription.filter((change) =>
    sourceChange.actionType === "cancellation"
      ? change.actionType !== "cancellation"
      : change.actionType === "cancellation",
  );
  if (conflictingChanges.length > 0) {
    const conflictingChangeIds = conflictingChanges.map((change) => change.id);
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Remove conflicting change${conflictingChangeIds.length === 1 ? "" : "s"} ${conflictingChangeIds.join(", ")} from target Shadow ${targetShadow.id} before copying ${sourceChange.id}.`,
      retryable: true,
      details: {
        subscriptionId: sourceChange.subscriptionId,
        conflictingChangeIds,
        resolution: "Remove the listed target changes, then retry the copy.",
      },
    });
  }
  const existingSameKind = targetChangesForSubscription.find(
    (change) => change.actionType === sourceChange.actionType,
  );
  const nextChangeSequence = existingSameKind
    ? workspace.counters.change
    : workspace.counters.change + 1;
  const changeId =
    existingSameKind?.id ?? idFactory.changeId(nextChangeSequence);
  if (!existingSameKind && changeIdExists(workspace, changeId)) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated change ID ${changeId} already exists.`,
      retryable: false,
      details: { changeId },
    });
  }
  const copiedChange = copyOperation(
    sourceChange,
    targetShadow.id,
    changeId,
    input.source ?? "ui",
    workspace,
  );
  const changes = existingSameKind
    ? targetShadow.changes.map((change) =>
        change.id === existingSameKind.id ? copiedChange : change,
      )
    : [...targetShadow.changes, copiedChange];
  const nextTarget: Shadow = {
    ...targetShadow,
    revision: targetShadow.revision + 1,
    intent: {
      ...targetShadow.intent,
      protectedTeamIds: [...targetShadow.intent.protectedTeamIds],
    },
    changes: canonicalChanges(changes),
  };
  const projectionResult = projectShadow(
    workspace.reality,
    nextTarget,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: { ...workspace.counters, change: nextChangeSequence },
    shadows: { ...workspace.shadows, [nextTarget.id]: nextTarget },
  };
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "copy_change_between_shadows",
      arguments: {
        sourceShadowId: sourceShadow.id,
        targetShadowId: nextTarget.id,
        changeId: sourceChange.id,
      },
      shadowId: nextTarget.id,
      shadowRevision: nextTarget.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      sourceShadow,
      targetShadow: nextTarget,
      change: copiedChange,
      projection: projectionResult.value,
    },
  };
}

export function removeShadowChange(
  workspace: WorkspaceState,
  input: RemoveShadowChangeInput,
  clock: ActivityClock = realityDateActivityClock,
): Result<RemoveShadowChangeOutput> {
  const shadowResult = validateEditableShadow(workspace, input.shadowId);
  if (!shadowResult.ok) return shadowResult;
  const shadow = shadowResult.value;
  if (!shadow.changes.some((change) => change.id === input.changeId)) {
    return failure({
      code: "CHANGE_NOT_FOUND",
      message: `Change ${input.changeId} does not exist in Shadow ${shadow.id}.`,
      retryable: true,
      details: { shadowId: shadow.id, changeId: input.changeId },
    });
  }

  const nextShadow: Shadow = {
    ...shadow,
    revision: shadow.revision + 1,
    intent: {
      ...shadow.intent,
      protectedTeamIds: [...shadow.intent.protectedTeamIds],
    },
    changes: shadow.changes.filter((change) => change.id !== input.changeId),
  };
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    shadows: { ...workspace.shadows, [shadow.id]: nextShadow },
  };
  const projectionResult = projectShadow(
    workspace.reality,
    nextShadow,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: input.source ?? "ui",
      commandName: "remove_shadow_change",
      arguments: {
        shadowId: nextShadow.id,
        changeId: input.changeId,
      },
      shadowId: nextShadow.id,
      shadowRevision: nextShadow.revision,
    },
    clock,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      shadow: nextShadow,
      projection: projectionResult.value,
    },
  };
}
