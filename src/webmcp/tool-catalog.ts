import {
  getCompanySummary,
  getSubscriptionContext,
  listSubscriptions,
} from "@/application/queries";
import {
  compareShadows,
  type ComparisonFuture,
  type ComparisonSubscriptionState,
  type ShadowComparison,
} from "@/application/shadow-comparison";
import {
  beginShadow,
  copyChangeBetweenShadows,
  forkShadow,
  removeShadowChange,
  stageCancellation,
  stagePlanChange,
  stageSeatChange,
} from "@/application/shadow-service";
import type { WorkspaceStore } from "@/application/workspace-store";
import type {
  ActionProof,
  DomainError,
  Impact,
  Shadow,
  ShadowChange,
  ShadowProjection,
  WorkspaceState,
} from "@/domain/model";
import { projectShadow } from "@/domain/projection";
import { z } from "zod";
import {
  beginShadowInputSchema,
  compareShadowsInputSchema,
  copyChangeBetweenShadowsInputSchema,
  emptyInputSchema,
  forkShadowInputSchema,
  getChangeProofInputSchema,
  removeShadowChangeInputSchema,
  shadowInputSchema,
  stageCancellationInputSchema,
  stagePlanChangeInputSchema,
  stageSeatChangeInputSchema,
  subscriptionInputSchema,
  toWebMcpJsonSchema,
} from "@/webmcp/schemas";

export type ToolSuccess<T> = {
  ok: true;
  data: T;
  realityVersion: number;
  shadowRevision?: number;
};

export type ToolFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
};

export type ToolEnvelope<T> = ToolSuccess<T> | ToolFailure;

export type WebMcpMutationEvent = {
  kind: "shadow-created" | "shadow-updated";
  shadowId: string;
  shadowRevision: number;
};

export type WebMcpToolCatalogOptions = {
  onMutation?(event: WebMcpMutationEvent): void;
};

type ToolHandler<TInput, TOutput> = (
  input: TInput,
) => ToolEnvelope<TOutput> | Promise<ToolEnvelope<TOutput>>;

function failure(error: DomainError): ToolFailure {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

function expectedFailure(
  code: string,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>,
): ToolFailure {
  return {
    ok: false,
    error: { code, message, retryable, ...(details ? { details } : {}) },
  };
}

function normalizeToolInput(input: unknown): unknown {
  // Compatibility seam: browser execution supplies an object, while some
  // current direct executeTool harnesses pass the same arguments as JSON.
  if (typeof input !== "string") return input ?? {};

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return input;
  }
}

function validatedTool<TSchema extends z.ZodType, TOutput>(
  definition: Omit<WebMCP.ModelContextTool, "inputSchema" | "execute">,
  schema: TSchema,
  handler: ToolHandler<z.output<TSchema>, TOutput>,
): WebMCP.ModelContextTool {
  return {
    ...definition,
    inputSchema: toWebMcpJsonSchema(schema),
    execute: async (rawInput, options) => {
      if (options?.signal?.aborted) {
        return expectedFailure(
          "TOOL_ABORTED",
          "The tool call was cancelled before it changed state.",
          true,
        );
      }

      const parsed = schema.safeParse(normalizeToolInput(rawInput));
      if (!parsed.success) {
        return expectedFailure(
          "INVALID_ARGUMENTS",
          "The tool arguments did not match the required schema.",
          true,
          {
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join("."),
              message: issue.message,
            })),
          },
        );
      }

      return handler(parsed.data);
    },
  };
}

function summarizeChange(change: ShadowChange) {
  return {
    changeId: change.id,
    subscriptionId: change.subscriptionId,
    actionType: change.actionType,
    from: change.previousValue,
    to: change.proposedValue,
  };
}

function summarizeImpact(impact: Impact) {
  return {
    monthlySavingsCents: impact.monthlySavingsCents,
    annualSavingsCents: impact.annualSavingsCents,
    savingsBasisPoints: impact.savingsBasisPoints,
    activeUsersAffected: impact.activeUsersAffected,
    activeEngineeringUsersAffected: impact.activeEngineeringUsersAffected,
    contractPenaltyCents: impact.contractPenaltyCents,
    risk: impact.risk,
  };
}

function summarizeProof(proof: ActionProof) {
  return {
    changeId: proof.changeId,
    intent: proof.intent,
    evidence: proof.evidence.map(({ kind, label, value }) => ({
      kind,
      label,
      value,
    })),
    transition: proof.transition,
    impact: summarizeImpact(proof.impact),
    checks: proof.checks.map(({ code, severity, passed, message }) => ({
      code,
      severity,
      passed,
      ...(!passed ? { message } : {}),
    })),
    provenance: proof.provenance,
  };
}

function summarizeComparisonFuture(future: ComparisonFuture) {
  return {
    shadowId: future.shadowId,
    name: future.name,
    strategy: future.strategy,
    revision: future.revision,
    changeCount: future.changeCount,
    impact: summarizeImpact(future.impact),
    hardBlockerCount: future.hardBlockerCount,
    warningCount: future.warningCount,
  };
}

function summarizeComparisonState(state: ComparisonSubscriptionState) {
  return {
    status: state.status,
    plan: state.planName,
    seats: state.seatCount,
    monthlyCostCents: state.monthlyCostCents,
    monthlySavingsCents: state.monthlySavingsCents,
    changeIds: state.changeIds,
  };
}

function summarizeComparison(comparison: ShadowComparison) {
  const sharedProducts = comparison.rows
    .filter((row) => row.differenceKinds.length === 0)
    .map((row) => row.productName);
  const differences = comparison.rows
    .filter((row) => row.differenceKinds.length > 0)
    .map((row) => ({
      subscriptionId: row.subscriptionId,
      product: row.productName,
      reality: summarizeComparisonState(row.reality),
      left: summarizeComparisonState(row.left),
      right: summarizeComparisonState(row.right),
      differenceKinds: row.differenceKinds,
    }));

  return {
    left: summarizeComparisonFuture(comparison.left),
    right: summarizeComparisonFuture(comparison.right),
    sharedProducts,
    differences,
  };
}

function summarizeShadow(shadow: Shadow, projection: ShadowProjection) {
  return {
    shadow: {
      shadowId: shadow.id,
      name: shadow.name,
      strategy: shadow.strategy,
      status: shadow.status,
      baseRealityVersion: shadow.baseRealityVersion,
      revision: shadow.revision,
      intent: shadow.intent,
    },
    changes: shadow.changes.map(summarizeChange),
    impact: summarizeImpact(projection.totalImpact),
    blockers: projection.hardBlockers.map(({ code, message }) => ({
      code,
      message,
    })),
    warnings: projection.warnings.map(({ code, message }) => ({
      code,
      message,
    })),
  };
}

function getProjection(
  workspace: WorkspaceState,
  shadowId: string,
):
  | { ok: true; shadow: Shadow; projection: ShadowProjection }
  | { ok: false; response: ToolFailure } {
  const shadow = workspace.shadows[shadowId];
  if (!shadow) {
    return {
      ok: false,
      response: expectedFailure(
        "SHADOW_NOT_FOUND",
        `Shadow ${shadowId} does not exist.`,
        true,
        { shadowId },
      ),
    };
  }

  const projected = projectShadow(workspace.reality, shadow, workspace.catalog);
  if (!projected.ok) return { ok: false, response: failure(projected.error) };

  return { ok: true, shadow, projection: projected.value };
}

function notifyMutation(
  callback: WebMcpToolCatalogOptions["onMutation"],
  event: WebMcpMutationEvent,
) {
  try {
    callback?.(event);
  } catch {
    // The durable command already succeeded; UI notification cannot undo it.
  }
}

export function createWebMcpTools(
  store: Pick<WorkspaceStore, "getSnapshot" | "replace">,
  options: WebMcpToolCatalogOptions = {},
): WebMCP.ModelContextTool[] {
  return [
    validatedTool(
      {
        name: "get_company_summary",
        title: "Get company summary",
        description:
          "Read ORBIT's current Reality totals, including people, subscriptions, monthly software cost, scenario date, and Reality version. This tool never changes Reality or a Shadow.",
        annotations: { readOnlyHint: true },
      },
      emptyInputSchema,
      () => {
        const workspace = store.getSnapshot().workspace;
        return {
          ok: true,
          data: getCompanySummary(workspace),
          realityVersion: workspace.reality.version,
        };
      },
    ),
    validatedTool(
      {
        name: "list_subscriptions",
        title: "List subscriptions",
        description:
          "List ORBIT's synthetic software subscriptions with current seats, recent usage, monthly cost, and criticality. Use get_subscription_context for contract and dependency evidence about one subscription. This tool is read-only.",
        annotations: { readOnlyHint: true },
      },
      emptyInputSchema,
      () => {
        const workspace = store.getSnapshot().workspace;
        return {
          ok: true,
          data: {
            subscriptions: listSubscriptions(workspace).map((subscription) => ({
              subscriptionId: subscription.id,
              product: subscription.productName,
              seats: subscription.seatCount,
              active90d: subscription.activeUsers90d,
              inactive90d: subscription.inactiveUsers90d,
              monthlyCostCents: subscription.monthlyCostCents,
              criticality: subscription.criticality,
            })),
          },
          realityVersion: workspace.reality.version,
        };
      },
    ),
    validatedTool(
      {
        name: "get_subscription_context",
        title: "Get subscription context",
        description:
          "Read usage, contract, dependency evidence, and valid plan-transition IDs for one synthetic ORBIT subscription. Call list_subscriptions first to obtain its subscription ID. This tool is read-only.",
        annotations: { readOnlyHint: true },
      },
      subscriptionInputSchema,
      ({ subscriptionId }) => {
        const workspace = store.getSnapshot().workspace;
        const context = getSubscriptionContext(workspace, subscriptionId);
        if (!context) {
          return expectedFailure(
            "SUBSCRIPTION_NOT_FOUND",
            `Subscription ${subscriptionId} does not exist.`,
            true,
            { subscriptionId },
          );
        }

        const teamUsage = new Map<
          string,
          { team: string; active90d: number; inactive90d: number }
        >();
        for (const assignment of context.assignments) {
          const usage = teamUsage.get(assignment.teamId) ?? {
            team: assignment.teamName,
            active90d: 0,
            inactive90d: 0,
          };
          if (assignment.activeInLast90Days) usage.active90d += 1;
          else usage.inactive90d += 1;
          teamUsage.set(assignment.teamId, usage);
        }
        const availablePlanTransitions = workspace.catalog.planTransitions
          .filter(
            (transition) =>
              transition.productId === context.product.id &&
              transition.fromPlanId === context.plan.id,
          )
          .map((transition) => {
            const targetPlan = workspace.catalog.plans[transition.toPlanId];
            return {
              planId: targetPlan.id,
              name: targetPlan.name,
              pricing: targetPlan.pricing,
              approved: transition.approved,
              capabilityEffect: transition.capabilityEffect,
            };
          });

        return {
          ok: true,
          data: {
            subscription: {
              subscriptionId: context.subscription.id,
              product: context.subscription.productName,
              planId: context.plan.id,
              plan: context.subscription.planName,
              pricing: context.plan.pricing,
              seats: context.subscription.seatCount,
              monthlyCostCents: context.subscription.monthlyCostCents,
            },
            availablePlanTransitions,
            usage: {
              assigned: context.subscription.assignedCount,
              active90d: context.subscription.activeUsers90d,
              inactive90d: context.subscription.inactiveUsers90d,
              unassigned: context.subscription.unassignedSeats,
              byTeam: Array.from(teamUsage.entries())
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([teamId, usage]) => ({ teamId, ...usage })),
            },
            contract: {
              renewsAt: context.contract.renewsAt,
              seatReductionCadence: context.contract.seatReductionCadence,
              minimumSeats: context.contract.minimumSeats,
              planChangeCadence: context.contract.planChangeCadence,
              cancellationNoticeDays: context.contract.cancellationNoticeDays,
              cancellationPenaltyCents:
                context.contract.cancellationPenaltyCents,
            },
            dependencies: context.dependencies.map((dependency) => ({
              criticality: dependency.criticality,
              teamIds: dependency.teamIds,
              description: dependency.description,
            })),
          },
          realityVersion: workspace.reality.version,
        };
      },
    ),
    validatedTool(
      {
        name: "begin_shadow",
        title: "Begin Shadow",
        description:
          "Create a draft Shadow from the current Reality version. A Shadow is an isolated proposed future; creating it does not change Reality. Supply a name, optional strategy, and optional savings or safety intent.",
        annotations: { untrustedContentHint: true },
      },
      beginShadowInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = beginShadow(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-created",
          shadowId: result.value.shadow.id,
          shadowRevision: result.value.shadow.revision,
        });
        return {
          ok: true,
          data: {
            shadowId: result.value.shadow.id,
            name: result.value.shadow.name,
            strategy: result.value.shadow.strategy,
            status: result.value.shadow.status,
            baseRealityVersion: result.value.shadow.baseRealityVersion,
            intent: result.value.shadow.intent,
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "get_shadow",
        title: "Get Shadow",
        description:
          "Read one Shadow's intent, staged changes, projected impact, warnings, and blockers. This returns a simulation and never changes Reality or the Shadow.",
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
      shadowInputSchema,
      ({ shadowId }) => {
        const workspace = store.getSnapshot().workspace;
        const result = getProjection(workspace, shadowId);
        if (!result.ok) return result.response;

        return {
          ok: true,
          data: summarizeShadow(result.shadow, result.projection),
          realityVersion: workspace.reality.version,
          shadowRevision: result.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "stage_seat_change",
        title: "Stage seat change",
        description:
          "Stage or replace a subscription seat-count change inside a draft Shadow. The projected state, impact, and constraint checks are recalculated immediately. This changes only the Shadow and never Reality.",
      },
      stageSeatChangeInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = stageSeatChange(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-updated",
          shadowId: result.value.shadow.id,
          shadowRevision: result.value.shadow.revision,
        });
        return {
          ok: true,
          data: {
            shadowId: result.value.shadow.id,
            change: summarizeChange(result.value.change),
            impact: summarizeImpact(result.value.projection.totalImpact),
            blockers: result.value.projection.hardBlockers.map(
              ({ code, message }) => ({ code, message }),
            ),
            warnings: result.value.projection.warnings.map(
              ({ code, message }) => ({ code, message }),
            ),
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "stage_plan_change",
        title: "Stage plan change",
        description:
          "Stage or replace a subscription plan change inside a draft Shadow. The projected cost, impact, and constraints are recalculated immediately. This changes only the Shadow and never Reality.",
      },
      stagePlanChangeInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = stagePlanChange(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-updated",
          shadowId: result.value.shadow.id,
          shadowRevision: result.value.shadow.revision,
        });
        return {
          ok: true,
          data: {
            shadowId: result.value.shadow.id,
            change: summarizeChange(result.value.change),
            impact: summarizeImpact(result.value.projection.totalImpact),
            blockers: result.value.projection.hardBlockers.map(
              ({ code, message }) => ({ code, message }),
            ),
            warnings: result.value.projection.warnings.map(
              ({ code, message }) => ({ code, message }),
            ),
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "stage_cancellation",
        title: "Stage cancellation",
        description:
          "Stage or replace a subscription cancellation inside a draft Shadow. Unsafe but structurally valid cancellations remain inspectable and return their blockers. This changes only the Shadow and never Reality.",
      },
      stageCancellationInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = stageCancellation(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-updated",
          shadowId: result.value.shadow.id,
          shadowRevision: result.value.shadow.revision,
        });
        return {
          ok: true,
          data: {
            shadowId: result.value.shadow.id,
            change: summarizeChange(result.value.change),
            impact: summarizeImpact(result.value.projection.totalImpact),
            blockers: result.value.projection.hardBlockers.map(
              ({ code, message }) => ({ code, message }),
            ),
            warnings: result.value.projection.warnings.map(
              ({ code, message }) => ({ code, message }),
            ),
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "remove_shadow_change",
        title: "Remove Shadow change",
        description:
          "Remove one staged change from a current draft Shadow and recalculate its projected impact. This changes only the Shadow and never Reality.",
      },
      removeShadowChangeInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = removeShadowChange(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-updated",
          shadowId: result.value.shadow.id,
          shadowRevision: result.value.shadow.revision,
        });
        return {
          ok: true,
          data: {
            shadowId: result.value.shadow.id,
            remainingChangeCount: result.value.shadow.changes.length,
            impact: summarizeImpact(result.value.projection.totalImpact),
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "get_change_proof",
        title: "Get change Proof",
        description:
          "Read the observable evidence, before/after transition, calculated impact, provenance, and constraint checks for one staged Shadow change. This tool is read-only and never exposes model chain-of-thought.",
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
      getChangeProofInputSchema,
      ({ shadowId, changeId }) => {
        const workspace = store.getSnapshot().workspace;
        const result = getProjection(workspace, shadowId);
        if (!result.ok) return result.response;
        const proof = result.projection.proofs.find(
          (candidate) => candidate.changeId === changeId,
        );
        if (!proof) {
          return expectedFailure(
            "CHANGE_NOT_FOUND",
            `Change ${changeId} does not exist in Shadow ${shadowId}.`,
            true,
            { shadowId, changeId },
          );
        }

        return {
          ok: true,
          data: { shadowId, proof: summarizeProof(proof) },
          realityVersion: workspace.reality.version,
          shadowRevision: result.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "fork_shadow",
        title: "Fork Shadow",
        description:
          "Create an independent child Shadow by snapshotting a current draft Shadow's effective changes. Later parent edits do not affect the child. This changes only Shadow state and never Reality.",
        annotations: { untrustedContentHint: true },
      },
      forkShadowInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = forkShadow(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-created",
          shadowId: result.value.shadow.id,
          shadowRevision: result.value.shadow.revision,
        });
        return {
          ok: true,
          data: {
            parentShadowId: result.value.parent.id,
            shadow: {
              shadowId: result.value.shadow.id,
              name: result.value.shadow.name,
              strategy: result.value.shadow.strategy,
              parentShadowId: result.value.shadow.parentShadowId,
              baseRealityVersion: result.value.shadow.baseRealityVersion,
              revision: result.value.shadow.revision,
              changeCount: result.value.shadow.changes.length,
            },
            impact: summarizeImpact(result.value.projection.totalImpact),
            blockers: result.value.projection.hardBlockers.map(
              ({ code, message }) => ({ code, message }),
            ),
            warnings: result.value.projection.warnings.map(
              ({ code, message }) => ({ code, message }),
            ),
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.shadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "copy_change_between_shadows",
        title: "Copy change between Shadows",
        description:
          "Copy one staged change from a source Shadow into a current target Shadow. Same-kind target changes are replaced; cancellation conflicts return explicit resolution details. This never changes Reality.",
      },
      copyChangeBetweenShadowsInputSchema,
      (input) => {
        const workspace = store.getSnapshot().workspace;
        const result = copyChangeBetweenShadows(workspace, {
          ...input,
          source: "webmcp",
        });
        if (!result.ok) return failure(result.error);

        store.replace(result.value.workspace);
        notifyMutation(options.onMutation, {
          kind: "shadow-updated",
          shadowId: result.value.targetShadow.id,
          shadowRevision: result.value.targetShadow.revision,
        });
        return {
          ok: true,
          data: {
            sourceShadowId: result.value.sourceShadow.id,
            targetShadowId: result.value.targetShadow.id,
            change: summarizeChange(result.value.change),
            impact: summarizeImpact(result.value.projection.totalImpact),
            blockers: result.value.projection.hardBlockers.map(
              ({ code, message }) => ({ code, message }),
            ),
            warnings: result.value.projection.warnings.map(
              ({ code, message }) => ({ code, message }),
            ),
          },
          realityVersion: result.value.workspace.reality.version,
          shadowRevision: result.value.targetShadow.revision,
        };
      },
    ),
    validatedTool(
      {
        name: "compare_shadows",
        title: "Compare Shadows",
        description:
          "Compare two current Shadows against the same Reality version. Returns aligned impact totals, shared changed products, and per-product differences. This tool is read-only and never changes either Shadow or Reality.",
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
      compareShadowsInputSchema,
      ({ leftShadowId, rightShadowId }) => {
        const workspace = store.getSnapshot().workspace;
        const result = compareShadows(workspace, leftShadowId, rightShadowId);
        if (!result.ok) return failure(result.error);

        return {
          ok: true,
          data: summarizeComparison(result.value),
          realityVersion: result.value.realityVersion,
        };
      },
    ),
  ];
}

/** Kept as a compatibility alias for the Slice 1 tracer test. */
export const createFoundationTools = createWebMcpTools;
