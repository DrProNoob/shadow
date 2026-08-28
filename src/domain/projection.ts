import {
  evaluateCancellationConstraints,
  evaluatePlanChangeConstraints,
  evaluateSavingsTarget,
  evaluateSeatChangeConstraints,
} from "@/domain/constraints";
import type {
  CancellationChange,
  ConstraintCheck,
  DomainError,
  Impact,
  LicenseAssignment,
  OrbitCatalog,
  Plan,
  PlanChange,
  ProjectedChange,
  ProjectedRealityState,
  RealityState,
  RemovedAssignment,
  Result,
  RiskLevel,
  SeatCountChange,
  Shadow,
  ShadowChange,
  ShadowProjection,
} from "@/domain/model";
import {
  createCancellationProof,
  createPlanChangeProof,
  createSeatChangeProof,
} from "@/domain/proof";

function failure<T>(error: DomainError): Result<T> {
  return { ok: false, error };
}

function cloneReality(reality: RealityState): ProjectedRealityState {
  const { version, ...realityWithoutVersion } = reality;
  return {
    ...realityWithoutVersion,
    kind: "shadow-projection",
    sourceRealityVersion: version,
    subscriptions: Object.fromEntries(
      Object.entries(reality.subscriptions).map(([id, subscription]) => [
        id,
        { ...subscription },
      ]),
    ),
    assignments: reality.assignments.map((assignment) => ({ ...assignment })),
  };
}

export function calculatePlanMonthlyCostCents(
  plan: Plan,
  seatCount: number,
): number {
  switch (plan.pricing.kind) {
    case "per-seat":
      return plan.pricing.monthlyPerSeatCents * seatCount;
    case "base-plus-seat":
      return (
        plan.pricing.monthlyBaseCents +
        plan.pricing.monthlyPerSeatCents * seatCount
      );
    case "flat":
      return plan.pricing.monthlyFlatCents;
  }
}

export type SeatAllocation = {
  removedAssignments: RemovedAssignment[];
  retainedAssignments: LicenseAssignment[];
};

export function allocateSeatsDeterministically(
  assignments: LicenseAssignment[],
  proposedSeatCount: number,
  catalog: OrbitCatalog,
  protectedTeamIds: string[],
): SeatAllocation {
  const removalCount = Math.max(assignments.length - proposedSeatCount, 0);
  const protectedTeams = new Set(protectedTeamIds);
  const ranked = assignments
    .map((assignment) => {
      const person = catalog.people[assignment.personId];
      const protectedActive =
        assignment.activeInLast90Days && protectedTeams.has(person.teamId);
      const priority = !assignment.activeInLast90Days
        ? 0
        : protectedActive
          ? 2
          : 1;
      return { assignment, person, priority };
    })
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.assignment.usageUnits90d - right.assignment.usageUnits90d ||
        left.assignment.personId.localeCompare(right.assignment.personId) ||
        left.assignment.id.localeCompare(right.assignment.id),
    );
  const removedIds = new Set(
    ranked.slice(0, removalCount).map(({ assignment }) => assignment.id),
  );
  const removedAssignments = ranked.slice(0, removalCount).map(
    ({ assignment, person, priority }) =>
      ({
        assignmentId: assignment.id,
        personId: assignment.personId,
        teamId: person.teamId,
        activeInLast90Days: assignment.activeInLast90Days,
        usageUnits90d: assignment.usageUnits90d,
        reason:
          priority === 0
            ? "inactive"
            : priority === 1
              ? "active-unprotected"
              : "active-protected",
      }) satisfies RemovedAssignment,
  );

  return {
    removedAssignments,
    retainedAssignments: assignments
      .filter((assignment) => !removedIds.has(assignment.id))
      .map((assignment) => ({ ...assignment })),
  };
}

type ChangeGroup = {
  subscriptionId: string;
  plan?: PlanChange;
  seat?: SeatCountChange;
  cancellation?: CancellationChange;
};

function groupChanges(changes: ShadowChange[]): Result<ChangeGroup[]> {
  const groups = new Map<string, ChangeGroup>();
  for (const change of changes) {
    const group = groups.get(change.subscriptionId) ?? {
      subscriptionId: change.subscriptionId,
    };
    const key =
      change.actionType === "seat-count"
        ? "seat"
        : change.actionType === "plan"
          ? "plan"
          : "cancellation";
    if (group[key]) {
      return failure({
        code: "CHANGE_CONFLICT",
        message: `Shadow has more than one ${change.actionType} change for ${change.subscriptionId}.`,
        retryable: false,
        details: {
          subscriptionId: change.subscriptionId,
          actionType: change.actionType,
        },
      });
    }
    if (key === "seat") group.seat = change as SeatCountChange;
    if (key === "plan") group.plan = change as PlanChange;
    if (key === "cancellation") {
      group.cancellation = change as CancellationChange;
    }
    groups.set(change.subscriptionId, group);
  }

  for (const group of groups.values()) {
    if (group.cancellation && (group.plan || group.seat)) {
      return failure({
        code: "CHANGE_CONFLICT",
        message: `Cancellation is exclusive with seat and plan changes for ${group.subscriptionId}.`,
        retryable: true,
        details: { subscriptionId: group.subscriptionId },
      });
    }
  }
  return {
    ok: true,
    value: [...groups.values()].sort((left, right) =>
      left.subscriptionId.localeCompare(right.subscriptionId),
    ),
  };
}

function savingsBasisPoints(monthlySavingsCents: number, baseline: number) {
  return baseline === 0
    ? 0
    : Math.round((monthlySavingsCents * 10_000) / baseline);
}

function hasFailedHardCheck(checks: ConstraintCheck[]) {
  return checks.some(
    (check) => check.severity === "hard-blocker" && !check.passed,
  );
}

function riskForChange(
  checks: ConstraintCheck[],
  activeUsersAffected: number,
  capabilityReducing = false,
): RiskLevel {
  if (hasFailedHardCheck(checks)) return "high";
  if (activeUsersAffected > 0 || capabilityReducing) return "medium";
  return "low";
}

function affectedIds(removals: RemovedAssignment[], teamId?: string): string[] {
  return removals
    .filter(
      (removal) =>
        removal.activeInLast90Days && (!teamId || removal.teamId === teamId),
    )
    .map((removal) => removal.personId);
}

function removeAllocatedAssignments(
  projectedReality: ProjectedRealityState,
  removals: RemovedAssignment[],
) {
  const removedIds = new Set(removals.map((removal) => removal.assignmentId));
  projectedReality.assignments = projectedReality.assignments.filter(
    (assignment) => !removedIds.has(assignment.id),
  );
}

function cloneChange<T extends ShadowChange>(change: T): T {
  return {
    ...change,
    provenance: { ...change.provenance },
  };
}

export function projectShadow(
  reality: RealityState,
  shadow: Shadow,
  catalog: OrbitCatalog,
): Result<ShadowProjection> {
  if (shadow.baseRealityVersion !== reality.version) {
    return failure({
      code: "SHADOW_STALE",
      message: `Shadow ${shadow.id} was created from Reality v${shadow.baseRealityVersion}, but current Reality is v${reality.version}.`,
      retryable: false,
      details: {
        shadowId: shadow.id,
        baseRealityVersion: shadow.baseRealityVersion,
        realityVersion: reality.version,
      },
    });
  }
  const groupedResult = groupChanges(shadow.changes);
  if (!groupedResult.ok) return groupedResult;

  const projectedReality = cloneReality(reality);
  const projectedChanges: ProjectedChange[] = [];

  for (const group of groupedResult.value) {
    const original = projectedReality.subscriptions[group.subscriptionId];
    if (!original) {
      return failure({
        code: "SUBSCRIPTION_NOT_FOUND",
        message: `Subscription ${group.subscriptionId} does not exist in Reality.`,
        retryable: false,
        details: { subscriptionId: group.subscriptionId },
      });
    }
    const contract = catalog.contracts[original.contractId];
    const product = catalog.products[original.productId];
    const dependencies = catalog.dependencies.filter(
      (dependency) => dependency.productId === original.productId,
    );

    if (group.cancellation) {
      const change = group.cancellation;
      const before = projectedReality.subscriptions[group.subscriptionId];
      const assignmentsBefore = projectedReality.assignments.filter(
        (assignment) => assignment.subscriptionId === before.id,
      );
      const allocation = allocateSeatsDeterministically(
        assignmentsBefore,
        0,
        catalog,
        shadow.intent.protectedTeamIds,
      );
      const after = {
        ...before,
        status: "cancelled" as const,
        seatCount: 0,
        monthlyCostCents: 0,
      };
      const checks = evaluateCancellationConstraints({
        contract,
        dependencies,
        assignments: assignmentsBefore,
        catalog,
        intent: shadow.intent,
      });
      const affectedPersonIds = affectedIds(allocation.removedAssignments);
      const affectedEngineeringPersonIds = affectedIds(
        allocation.removedAssignments,
        "team-engineering",
      );
      const impact: Impact = {
        monthlySavingsCents: before.monthlyCostCents,
        annualSavingsCents: before.monthlyCostCents * 12,
        savingsBasisPoints: savingsBasisPoints(
          before.monthlyCostCents,
          reality.monthlySoftwareCostCents,
        ),
        contractPenaltyCents: contract.cancellationPenaltyCents,
        activeUsersAffected: new Set(affectedPersonIds).size,
        activeEngineeringUsersAffected: new Set(affectedEngineeringPersonIds)
          .size,
        risk: riskForChange(checks, new Set(affectedPersonIds).size),
      };
      const proof = createCancellationProof({
        change,
        productName: product.name,
        before,
        after,
        assignmentsBefore,
        contract,
        dependencies,
        impact,
        checks,
        intent: shadow.intent,
      });

      projectedReality.subscriptions[group.subscriptionId] = after;
      removeAllocatedAssignments(
        projectedReality,
        allocation.removedAssignments,
      );
      projectedChanges.push({
        change: cloneChange(change),
        before: { ...before },
        after: { ...after },
        removedAssignments: allocation.removedAssignments.map((item) => ({
          ...item,
        })),
        affectedPersonIds,
        affectedEngineeringPersonIds,
        impact,
        checks,
        proof,
      });
      continue;
    }

    if (group.plan) {
      const change = group.plan;
      const before = projectedReality.subscriptions[group.subscriptionId];
      const beforePlan = catalog.plans[before.planId];
      const afterPlan = catalog.plans[change.proposedValue];
      if (!afterPlan) {
        return failure({
          code: "PLAN_NOT_FOUND",
          message: `Plan ${change.proposedValue} does not exist.`,
          retryable: true,
          details: { planId: change.proposedValue },
        });
      }
      if (afterPlan.productId !== before.productId) {
        return failure({
          code: "PLAN_PRODUCT_MISMATCH",
          message: `Plan ${afterPlan.id} does not belong to ${product.name}.`,
          retryable: true,
          details: { planId: afterPlan.id, productId: before.productId },
        });
      }
      const assignments = projectedReality.assignments.filter(
        (assignment) => assignment.subscriptionId === before.id,
      );
      const transition = catalog.planTransitions.find(
        (candidate) =>
          candidate.fromPlanId === beforePlan.id &&
          candidate.toPlanId === afterPlan.id,
      );
      const capabilityReducing = !(
        transition?.approved === true &&
        transition.capabilityEffect === "preserving"
      );
      const planAffectedAssignments = capabilityReducing
        ? assignments.filter((assignment) => assignment.activeInLast90Days)
        : [];
      const planAffectedPersonIds = planAffectedAssignments.map(
        (assignment) => assignment.personId,
      );
      const planAffectedEngineeringPersonIds = planAffectedAssignments
        .filter(
          (assignment) =>
            catalog.people[assignment.personId].teamId === "team-engineering",
        )
        .map((assignment) => assignment.personId);
      const after = {
        ...before,
        planId: afterPlan.id,
        monthlyCostCents: calculatePlanMonthlyCostCents(
          afterPlan,
          before.seatCount,
        ),
      };
      const checks = evaluatePlanChangeConstraints({
        contract,
        dependencies,
        assignments,
        catalog,
        intent: shadow.intent,
        transition,
        asOfDate: reality.asOfDate,
      });
      const monthlySavingsCents =
        before.monthlyCostCents - after.monthlyCostCents;
      const impact: Impact = {
        monthlySavingsCents,
        annualSavingsCents: monthlySavingsCents * 12,
        savingsBasisPoints: savingsBasisPoints(
          monthlySavingsCents,
          reality.monthlySoftwareCostCents,
        ),
        contractPenaltyCents: 0,
        activeUsersAffected: new Set(planAffectedPersonIds).size,
        activeEngineeringUsersAffected: new Set(
          planAffectedEngineeringPersonIds,
        ).size,
        risk: riskForChange(
          checks,
          new Set(planAffectedPersonIds).size,
          capabilityReducing,
        ),
      };
      const proof = createPlanChangeProof({
        change,
        productName: product.name,
        before,
        after,
        beforePlan,
        afterPlan,
        transition,
        contract,
        impact,
        checks,
        intent: shadow.intent,
      });

      projectedReality.subscriptions[group.subscriptionId] = after;
      projectedChanges.push({
        change: cloneChange(change),
        before: { ...before },
        after: { ...after },
        removedAssignments: [],
        affectedPersonIds: planAffectedPersonIds,
        affectedEngineeringPersonIds: planAffectedEngineeringPersonIds,
        impact,
        checks,
        proof,
      });
    }

    if (group.seat) {
      const change = group.seat;
      if (
        !Number.isSafeInteger(change.proposedValue) ||
        change.proposedValue < 0
      ) {
        return failure({
          code: "INVALID_SEAT_COUNT",
          message: "Seat count must be a non-negative safe integer.",
          retryable: true,
          details: { proposedValue: change.proposedValue },
        });
      }
      const before = projectedReality.subscriptions[group.subscriptionId];
      const plan = catalog.plans[before.planId];
      const assignmentsBefore = projectedReality.assignments.filter(
        (assignment) => assignment.subscriptionId === before.id,
      );
      const allocation = allocateSeatsDeterministically(
        assignmentsBefore,
        change.proposedValue,
        catalog,
        shadow.intent.protectedTeamIds,
      );
      const after = {
        ...before,
        seatCount: change.proposedValue,
        monthlyCostCents: calculatePlanMonthlyCostCents(
          plan,
          change.proposedValue,
        ),
      };
      const checks = evaluateSeatChangeConstraints({
        before,
        proposedSeatCount: change.proposedValue,
        contract,
        dependencies,
        removedAssignments: allocation.removedAssignments,
        intent: shadow.intent,
        asOfDate: reality.asOfDate,
      });
      const affectedPersonIds = affectedIds(allocation.removedAssignments);
      const affectedEngineeringPersonIds = affectedIds(
        allocation.removedAssignments,
        "team-engineering",
      );
      const monthlySavingsCents =
        before.monthlyCostCents - after.monthlyCostCents;
      const impact: Impact = {
        monthlySavingsCents,
        annualSavingsCents: monthlySavingsCents * 12,
        savingsBasisPoints: savingsBasisPoints(
          monthlySavingsCents,
          reality.monthlySoftwareCostCents,
        ),
        contractPenaltyCents: 0,
        activeUsersAffected: new Set(affectedPersonIds).size,
        activeEngineeringUsersAffected: new Set(affectedEngineeringPersonIds)
          .size,
        risk: riskForChange(checks, new Set(affectedPersonIds).size),
      };
      const proof = createSeatChangeProof({
        change,
        productName: product.name,
        before,
        after,
        assignmentsBefore,
        contract,
        impact,
        checks,
        intent: shadow.intent,
      });

      projectedReality.subscriptions[group.subscriptionId] = after;
      removeAllocatedAssignments(
        projectedReality,
        allocation.removedAssignments,
      );
      projectedChanges.push({
        change: cloneChange(change),
        before: { ...before },
        after: { ...after },
        removedAssignments: allocation.removedAssignments.map((item) => ({
          ...item,
        })),
        affectedPersonIds,
        affectedEngineeringPersonIds,
        impact,
        checks,
        proof,
      });
    }
  }

  projectedReality.monthlySoftwareCostCents = Object.values(
    projectedReality.subscriptions,
  ).reduce((total, subscription) => total + subscription.monthlyCostCents, 0);
  const activePersonIds = new Set(
    projectedChanges.flatMap((change) => change.affectedPersonIds),
  );
  const engineeringPersonIds = new Set(
    projectedChanges.flatMap((change) => change.affectedEngineeringPersonIds),
  );
  const monthlySavingsCents =
    reality.monthlySoftwareCostCents -
    projectedReality.monthlySoftwareCostCents;
  const changeChecks = projectedChanges.flatMap((change) => change.checks);
  const totalImpact: Impact = {
    monthlySavingsCents,
    annualSavingsCents: monthlySavingsCents * 12,
    savingsBasisPoints: savingsBasisPoints(
      monthlySavingsCents,
      reality.monthlySoftwareCostCents,
    ),
    contractPenaltyCents: projectedChanges.reduce(
      (total, change) => total + change.impact.contractPenaltyCents,
      0,
    ),
    activeUsersAffected: activePersonIds.size,
    activeEngineeringUsersAffected: engineeringPersonIds.size,
    risk: hasFailedHardCheck(changeChecks)
      ? "high"
      : projectedChanges.some((change) => change.impact.risk === "medium")
        ? "medium"
        : "low",
  };
  const checks = [
    ...changeChecks,
    evaluateSavingsTarget(shadow.intent, totalImpact),
  ];

  return {
    ok: true,
    value: {
      shadowId: shadow.id,
      baseRealityVersion: shadow.baseRealityVersion,
      projectedReality,
      changes: projectedChanges,
      proofs: projectedChanges.map((change) => change.proof),
      checks,
      hardBlockers: checks.filter(
        (check) => check.severity === "hard-blocker" && !check.passed,
      ),
      warnings: checks.filter(
        (check) => check.severity === "advisory" && !check.passed,
      ),
      totalImpact,
    },
  };
}
