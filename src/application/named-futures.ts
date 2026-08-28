import {
  beginShadow,
  deterministicShadowIdFactory,
  stageCancellation,
  stagePlanChange,
  stageSeatChange,
  type ShadowIdFactory,
} from "@/application/shadow-service";
import {
  realityDateActivityClock,
  type ActivityClock,
} from "@/application/activity";
import type {
  PlanId,
  Result,
  Shadow,
  ShadowProjection,
  WorkspaceState,
} from "@/domain/model";
import { projectShadow } from "@/domain/projection";

export type NamedFutureAction =
  | { type: "seat"; subscriptionId: string; seatCount: number }
  | { type: "plan"; subscriptionId: string; planId: PlanId }
  | { type: "cancellation"; subscriptionId: string };

export const CONSERVATIVE_ACTIONS: NamedFutureAction[] = [
  { type: "seat", subscriptionId: "subscription-adobe", seatCount: 17 },
  { type: "seat", subscriptionId: "subscription-figma", seatCount: 76 },
  { type: "seat", subscriptionId: "subscription-slack", seatCount: 293 },
  {
    type: "plan",
    subscriptionId: "subscription-notion",
    planId: "plan-notion-business",
  },
  { type: "seat", subscriptionId: "subscription-zoom", seatCount: 280 },
  { type: "cancellation", subscriptionId: "subscription-loom" },
  {
    type: "seat",
    subscriptionId: "subscription-grammarly",
    seatCount: 136,
  },
];

export const AGGRESSIVE_ACTIONS: NamedFutureAction[] = [
  { type: "seat", subscriptionId: "subscription-adobe", seatCount: 17 },
  { type: "seat", subscriptionId: "subscription-figma", seatCount: 51 },
  { type: "seat", subscriptionId: "subscription-slack", seatCount: 281 },
  {
    type: "plan",
    subscriptionId: "subscription-notion",
    planId: "plan-notion-business",
  },
  { type: "seat", subscriptionId: "subscription-notion", seatCount: 175 },
  { type: "seat", subscriptionId: "subscription-zoom", seatCount: 280 },
  { type: "seat", subscriptionId: "subscription-miro", seatCount: 141 },
  { type: "cancellation", subscriptionId: "subscription-loom" },
  {
    type: "seat",
    subscriptionId: "subscription-grammarly",
    seatCount: 136,
  },
];

export type LoadExampleFuturesOptions = {
  idFactory?: ShadowIdFactory;
  clock?: ActivityClock;
};

export type LoadExampleFuturesOutput = {
  workspace: WorkspaceState;
  conservative: Shadow;
  aggressive: Shadow;
  conservativeProjection: ShadowProjection;
  aggressiveProjection: ShadowProjection;
};

function applyActions(
  workspace: WorkspaceState,
  shadowId: string,
  actions: NamedFutureAction[],
  idFactory: ShadowIdFactory,
  clock: ActivityClock,
): Result<WorkspaceState> {
  let current = workspace;
  for (const action of actions) {
    const result =
      action.type === "seat"
        ? stageSeatChange(
            current,
            {
              shadowId,
              subscriptionId: action.subscriptionId,
              seatCount: action.seatCount,
              source: "demo-replay",
            },
            idFactory,
            clock,
          )
        : action.type === "plan"
          ? stagePlanChange(
              current,
              {
                shadowId,
                subscriptionId: action.subscriptionId,
                planId: action.planId,
                source: "demo-replay",
              },
              idFactory,
              clock,
            )
          : stageCancellation(
              current,
              {
                shadowId,
                subscriptionId: action.subscriptionId,
                source: "demo-replay",
              },
              idFactory,
              clock,
            );
    if (!result.ok) return result;
    current = result.value.workspace;
  }
  return { ok: true, value: current };
}

export function loadExampleFutures(
  workspace: WorkspaceState,
  options: LoadExampleFuturesOptions = {},
): Result<LoadExampleFuturesOutput> {
  const idFactory = options.idFactory ?? deterministicShadowIdFactory;
  const clock = options.clock ?? realityDateActivityClock;
  const conservativeResult = beginShadow(
    workspace,
    {
      name: "Conservative",
      strategy: "conservative",
      source: "demo-replay",
    },
    idFactory,
    clock,
  );
  if (!conservativeResult.ok) return conservativeResult;
  const conservativeActionsResult = applyActions(
    conservativeResult.value.workspace,
    conservativeResult.value.shadow.id,
    CONSERVATIVE_ACTIONS,
    idFactory,
    clock,
  );
  if (!conservativeActionsResult.ok) return conservativeActionsResult;

  const aggressiveResult = beginShadow(
    conservativeActionsResult.value,
    {
      name: "Aggressive",
      strategy: "aggressive",
      source: "demo-replay",
    },
    idFactory,
    clock,
  );
  if (!aggressiveResult.ok) return aggressiveResult;
  const aggressiveActionsResult = applyActions(
    aggressiveResult.value.workspace,
    aggressiveResult.value.shadow.id,
    AGGRESSIVE_ACTIONS,
    idFactory,
    clock,
  );
  if (!aggressiveActionsResult.ok) return aggressiveActionsResult;

  const nextWorkspace = aggressiveActionsResult.value;
  const conservative =
    nextWorkspace.shadows[conservativeResult.value.shadow.id];
  const aggressive = nextWorkspace.shadows[aggressiveResult.value.shadow.id];
  const conservativeProjectionResult = projectShadow(
    nextWorkspace.reality,
    conservative,
    nextWorkspace.catalog,
  );
  if (!conservativeProjectionResult.ok) return conservativeProjectionResult;
  const aggressiveProjectionResult = projectShadow(
    nextWorkspace.reality,
    aggressive,
    nextWorkspace.catalog,
  );
  if (!aggressiveProjectionResult.ok) return aggressiveProjectionResult;

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      conservative,
      aggressive,
      conservativeProjection: conservativeProjectionResult.value,
      aggressiveProjection: aggressiveProjectionResult.value,
    },
  };
}
