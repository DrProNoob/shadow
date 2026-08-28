import { z } from "zod";
import { ORBIT_CATALOG } from "@/data/orbit/catalog";
import { ORBIT_SUBSCRIPTIONS } from "@/data/orbit/usage";
import type { WorkspaceState } from "@/domain/model";

const id = z.string().min(1);
const whole = z.number().int().nonnegative();
const positiveWhole = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTime = z.string().min(1);
const source = z.enum(["webmcp", "ui", "demo-replay"]);

const provenance = z
  .object({
    source,
    commandName: id,
    copiedFromChangeId: id.optional(),
  })
  .strict();

const intent = z
  .object({
    minimumSavingsBasisPoints: whole,
    protectedTeamIds: z.array(id),
    maximumContractPenaltyCents: whole,
  })
  .strict();

const seatChange = z
  .object({
    id,
    shadowId: id,
    subscriptionId: id,
    provenance,
    actionType: z.literal("seat-count"),
    previousValue: whole,
    proposedValue: whole,
  })
  .strict();

const planChange = z
  .object({
    id,
    shadowId: id,
    subscriptionId: id,
    provenance,
    actionType: z.literal("plan"),
    previousValue: id,
    proposedValue: id,
  })
  .strict();

const cancellationChange = z
  .object({
    id,
    shadowId: id,
    subscriptionId: id,
    provenance,
    actionType: z.literal("cancellation"),
    previousValue: z.literal("active"),
    proposedValue: z.literal("cancelled"),
  })
  .strict();

const change = z.discriminatedUnion("actionType", [
  seatChange,
  planChange,
  cancellationChange,
]);

const impact = z
  .object({
    monthlySavingsCents: z.number().int(),
    annualSavingsCents: z.number().int(),
    savingsBasisPoints: z.number().int(),
    contractPenaltyCents: whole,
    activeUsersAffected: whole,
    activeEngineeringUsersAffected: whole,
    risk: z.enum(["low", "medium", "high"]),
  })
  .strict();

const check = z
  .object({
    code: id,
    label: id,
    severity: z.enum(["advisory", "hard-blocker"]),
    passed: z.boolean(),
    message: z.string(),
  })
  .strict();

const evidence = z
  .object({
    kind: z.enum(["intent", "usage", "contract", "dependency", "calculation"]),
    label: id,
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    sourceId: id.optional(),
  })
  .strict();

const proof = z
  .object({
    changeId: id,
    intent,
    evidence: z.array(evidence),
    transition: z.object({ before: z.unknown(), after: z.unknown() }).strict(),
    impact,
    checks: z.array(check),
    provenance,
  })
  .strict();

const shadow = z
  .object({
    id,
    name: id,
    strategy: z.enum(["conservative", "aggressive", "custom"]),
    parentShadowId: id.optional(),
    baseRealityVersion: positiveWhole,
    revision: whole,
    status: z.enum(["draft", "committed"]),
    intent,
    changes: z.array(change),
  })
  .strict();

const receipt = z
  .object({
    id,
    receiptVersion: z.literal(1),
    shadowId: id,
    realityVersionBefore: positiveWhole,
    realityVersionAfter: positiveWhole,
    appliedChanges: z.array(z.object({ change, proof }).strict()),
    proofs: z.array(proof),
    totalImpact: impact,
    committedAt: dateTime,
  })
  .strict();

const activity = z
  .object({
    id,
    source,
    commandName: id,
    arguments: z.record(z.string(), z.unknown()),
    outcome: z.union([
      z.object({ ok: z.literal(true) }).strict(),
      z
        .object({
          ok: z.literal(false),
          errorCode: id,
          message: z.string(),
        })
        .strict(),
    ]),
    realityVersion: positiveWhole,
    shadowId: id.optional(),
    shadowRevision: whole.optional(),
    occurredAt: dateTime,
  })
  .strict();

const subscription = z
  .object({
    id,
    productId: id,
    planId: id,
    contractId: id,
    seatCount: whole,
    monthlyCostCents: whole,
    status: z.enum(["active", "cancelled"]),
  })
  .strict();

const assignment = z
  .object({
    id,
    subscriptionId: id,
    personId: id,
    activeInLast90Days: z.boolean(),
    lastActiveAt: date.optional(),
    usageUnits90d: whole,
  })
  .strict();

const canonicalCatalog = JSON.stringify(ORBIT_CATALOG);
const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    counters: z
      .object({
        shadow: whole,
        change: whole,
        receipt: whole,
        activity: whole,
      })
      .strict(),
    catalog: z.custom<WorkspaceState["catalog"]>(
      (value) => JSON.stringify(value) === canonicalCatalog,
    ),
    reality: z
      .object({
        version: positiveWhole,
        asOfDate: date,
        companyId: z.literal("orbit"),
        companyName: z.literal("ORBIT"),
        employeeCount: positiveWhole,
        subscriptionCount: positiveWhole,
        monthlySoftwareCostCents: whole,
        currency: z.literal("USD"),
        subscriptions: z.record(z.string(), subscription),
        assignments: z.array(assignment),
      })
      .strict(),
    shadows: z.record(z.string(), shadow),
    receipts: z.record(z.string(), receipt),
    activity: z.array(activity),
  })
  .strict();

function sameKeys(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  return (
    Object.keys(left).sort().join("|") === Object.keys(right).sort().join("|")
  );
}

function isConsistent(workspace: WorkspaceState): boolean {
  const { reality, catalog } = workspace;
  if (
    reality.employeeCount !== Object.keys(catalog.people).length ||
    reality.subscriptionCount !== Object.keys(ORBIT_SUBSCRIPTIONS).length ||
    !sameKeys(reality.subscriptions, ORBIT_SUBSCRIPTIONS)
  ) {
    return false;
  }

  let monthlyTotal = 0;
  for (const [subscriptionId, current] of Object.entries(
    reality.subscriptions,
  )) {
    if (
      current.id !== subscriptionId ||
      !catalog.products[current.productId] ||
      !catalog.plans[current.planId] ||
      catalog.plans[current.planId].productId !== current.productId ||
      !catalog.contracts[current.contractId]
    ) {
      return false;
    }
    monthlyTotal += current.monthlyCostCents;
  }
  if (monthlyTotal !== reality.monthlySoftwareCostCents) return false;

  const assignmentIds = new Set<string>();
  for (const current of reality.assignments) {
    if (
      assignmentIds.has(current.id) ||
      !reality.subscriptions[current.subscriptionId] ||
      !catalog.people[current.personId]
    ) {
      return false;
    }
    assignmentIds.add(current.id);
  }

  let changeCount = 0;
  for (const [shadowId, current] of Object.entries(workspace.shadows)) {
    if (
      current.id !== shadowId ||
      current.changes.some(
        (candidate) =>
          candidate.shadowId !== shadowId ||
          !reality.subscriptions[candidate.subscriptionId],
      )
    ) {
      return false;
    }
    changeCount += current.changes.length;
  }
  for (const [receiptId, current] of Object.entries(workspace.receipts)) {
    if (
      current.id !== receiptId ||
      !workspace.shadows[current.shadowId] ||
      current.realityVersionAfter !== current.realityVersionBefore + 1 ||
      current.realityVersionAfter > reality.version
    ) {
      return false;
    }
  }
  if (
    workspace.activity.some(
      (event) => event.shadowId && !workspace.shadows[event.shadowId],
    ) ||
    workspace.counters.shadow < Object.keys(workspace.shadows).length ||
    workspace.counters.change < changeCount ||
    workspace.counters.receipt < Object.keys(workspace.receipts).length ||
    workspace.counters.activity < workspace.activity.length
  ) {
    return false;
  }
  return true;
}

export function parsePersistedWorkspace(input: unknown): WorkspaceState | null {
  const result = workspaceSchema.safeParse(input);
  if (!result.success) return null;
  const workspace = result.data as WorkspaceState;
  return isConsistent(workspace) ? workspace : null;
}
