import type {
  ActionProof,
  CancellationChange,
  ConstraintCheck,
  ContractTerms,
  Impact,
  LicenseAssignment,
  OperationalDependency,
  Plan,
  PlanChange,
  PlanTransition,
  SeatCountChange,
  SubscriptionState,
} from "@/domain/model";

export type SeatProofInput = {
  change: SeatCountChange;
  productName: string;
  before: SubscriptionState;
  after: SubscriptionState;
  assignmentsBefore: LicenseAssignment[];
  contract: ContractTerms;
  impact: Impact;
  checks: ConstraintCheck[];
  intent: ActionProof["intent"];
};

export function createSeatChangeProof({
  change,
  productName,
  before,
  after,
  assignmentsBefore,
  contract,
  impact,
  checks,
  intent,
}: SeatProofInput): ActionProof {
  const activeUsers = assignmentsBefore.filter(
    (assignment) => assignment.activeInLast90Days,
  ).length;
  const inactiveLicenses = assignmentsBefore.length - activeUsers;
  const unassignedSeats = Math.max(
    before.seatCount - assignmentsBefore.length,
    0,
  );

  return {
    changeId: change.id,
    intent: {
      minimumSavingsBasisPoints: intent.minimumSavingsBasisPoints,
      protectedTeamIds: [...intent.protectedTeamIds],
      maximumContractPenaltyCents: intent.maximumContractPenaltyCents,
    },
    evidence: [
      {
        kind: "usage",
        label: "Licensed seats",
        value: before.seatCount,
        sourceId: before.id,
      },
      {
        kind: "usage",
        label: "Active users in the last 90 days",
        value: activeUsers,
        sourceId: before.id,
      },
      {
        kind: "usage",
        label: "Inactive licenses",
        value: inactiveLicenses,
        sourceId: before.id,
      },
      {
        kind: "usage",
        label: "Unassigned capacity",
        value: unassignedSeats,
        sourceId: before.id,
      },
      {
        kind: "contract",
        label: "Seat reduction terms",
        value: contract.seatReductionCadence,
        sourceId: contract.id,
      },
      {
        kind: "contract",
        label: "Contract seat floor",
        value: contract.minimumSeats,
        sourceId: contract.id,
      },
      {
        kind: "calculation",
        label: "Product",
        value: productName,
        sourceId: before.productId,
      },
      {
        kind: "calculation",
        label: "Monthly savings",
        value: impact.monthlySavingsCents,
        sourceId: change.id,
      },
      {
        kind: "contract",
        label: "Expected contractual penalty",
        value: impact.contractPenaltyCents,
        sourceId: contract.id,
      },
    ],
    transition: {
      before: {
        seatCount: before.seatCount,
        monthlyCostCents: before.monthlyCostCents,
      },
      after: {
        seatCount: after.seatCount,
        monthlyCostCents: after.monthlyCostCents,
      },
    },
    impact: { ...impact },
    checks: checks.map((check) => ({ ...check })),
    provenance: { ...change.provenance },
  };
}

export type PlanProofInput = {
  change: PlanChange;
  productName: string;
  before: SubscriptionState;
  after: SubscriptionState;
  beforePlan: Plan;
  afterPlan: Plan;
  transition?: PlanTransition;
  contract: ContractTerms;
  impact: Impact;
  checks: ConstraintCheck[];
  intent: ActionProof["intent"];
};

export function createPlanChangeProof({
  change,
  productName,
  before,
  after,
  beforePlan,
  afterPlan,
  transition,
  contract,
  impact,
  checks,
  intent,
}: PlanProofInput): ActionProof {
  return {
    changeId: change.id,
    intent: {
      ...intent,
      protectedTeamIds: [...intent.protectedTeamIds],
    },
    evidence: [
      {
        kind: "calculation",
        label: "Product",
        value: productName,
        sourceId: before.productId,
      },
      {
        kind: "calculation",
        label: "Current plan",
        value: beforePlan.name,
        sourceId: beforePlan.id,
      },
      {
        kind: "calculation",
        label: "Proposed plan",
        value: afterPlan.name,
        sourceId: afterPlan.id,
      },
      {
        kind: "dependency",
        label: "Capability effect",
        value: transition?.capabilityEffect ?? "reducing",
        sourceId: transition?.id,
      },
      {
        kind: "contract",
        label: "Plan change terms",
        value: contract.planChangeCadence,
        sourceId: contract.id,
      },
      {
        kind: "calculation",
        label: "Monthly savings",
        value: impact.monthlySavingsCents,
        sourceId: change.id,
      },
      {
        kind: "contract",
        label: "Expected contractual penalty",
        value: impact.contractPenaltyCents,
        sourceId: contract.id,
      },
    ],
    transition: {
      before: {
        planId: beforePlan.id,
        planName: beforePlan.name,
        monthlyCostCents: before.monthlyCostCents,
      },
      after: {
        planId: afterPlan.id,
        planName: afterPlan.name,
        monthlyCostCents: after.monthlyCostCents,
      },
    },
    impact: { ...impact },
    checks: checks.map((check) => ({ ...check })),
    provenance: { ...change.provenance },
  };
}

export type CancellationProofInput = {
  change: CancellationChange;
  productName: string;
  before: SubscriptionState;
  after: SubscriptionState;
  assignmentsBefore: LicenseAssignment[];
  contract: ContractTerms;
  dependencies: OperationalDependency[];
  impact: Impact;
  checks: ConstraintCheck[];
  intent: ActionProof["intent"];
};

export function createCancellationProof({
  change,
  productName,
  before,
  after,
  assignmentsBefore,
  contract,
  dependencies,
  impact,
  checks,
  intent,
}: CancellationProofInput): ActionProof {
  const activeUsers = assignmentsBefore.filter(
    (assignment) => assignment.activeInLast90Days,
  ).length;
  const inactiveUsers = assignmentsBefore.length - activeUsers;
  const criticalDependencies = dependencies
    .filter((dependency) => dependency.criticality === "critical")
    .map((dependency) => dependency.description);

  return {
    changeId: change.id,
    intent: {
      ...intent,
      protectedTeamIds: [...intent.protectedTeamIds],
    },
    evidence: [
      {
        kind: "calculation",
        label: "Product",
        value: productName,
        sourceId: before.productId,
      },
      {
        kind: "usage",
        label: "Licensed seats",
        value: before.seatCount,
        sourceId: before.id,
      },
      {
        kind: "usage",
        label: "Active users in the last 90 days",
        value: activeUsers,
        sourceId: before.id,
      },
      {
        kind: "usage",
        label: "Inactive licenses",
        value: inactiveUsers,
        sourceId: before.id,
      },
      {
        kind: "contract",
        label: "Cancellation notice days",
        value: contract.cancellationNoticeDays,
        sourceId: contract.id,
      },
      {
        kind: "contract",
        label: "Expected contractual penalty",
        value: impact.contractPenaltyCents,
        sourceId: contract.id,
      },
      {
        kind: "dependency",
        label: "Critical dependency evidence",
        value: criticalDependencies,
        sourceId: before.productId,
      },
      {
        kind: "calculation",
        label: "Monthly savings",
        value: impact.monthlySavingsCents,
        sourceId: change.id,
      },
    ],
    transition: {
      before: {
        status: before.status,
        monthlyCostCents: before.monthlyCostCents,
      },
      after: {
        status: after.status,
        monthlyCostCents: after.monthlyCostCents,
      },
    },
    impact: { ...impact },
    checks: checks.map((check) => ({ ...check })),
    provenance: { ...change.provenance },
  };
}
