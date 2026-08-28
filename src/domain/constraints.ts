import type {
  ConstraintCheck,
  ContractTerms,
  Impact,
  IntentSpec,
  LicenseAssignment,
  OperationalDependency,
  OrbitCatalog,
  PlanTransition,
  RemovedAssignment,
  SubscriptionState,
} from "@/domain/model";

function protectedActiveAssignments(
  assignments: LicenseAssignment[],
  catalog: OrbitCatalog,
  intent: IntentSpec,
): LicenseAssignment[] {
  return assignments.filter((assignment) => {
    const person = catalog.people[assignment.personId];
    return (
      assignment.activeInLast90Days &&
      intent.protectedTeamIds.includes(person.teamId)
    );
  });
}

function changeAllowedAt(
  cadence: ContractTerms["planChangeCadence"],
  asOfDate: string,
  renewsAt: string,
): boolean {
  return (
    cadence === "anytime" ||
    cadence === "monthly" ||
    (cadence === "renewal-only" && asOfDate === renewsAt)
  );
}

export type SeatConstraintInput = {
  before: SubscriptionState;
  proposedSeatCount: number;
  contract: ContractTerms;
  dependencies: OperationalDependency[];
  removedAssignments: RemovedAssignment[];
  intent: IntentSpec;
  asOfDate: string;
};

export function evaluateSeatChangeConstraints({
  before,
  proposedSeatCount,
  contract,
  dependencies,
  removedAssignments,
  intent,
  asOfDate,
}: SeatConstraintInput): ConstraintCheck[] {
  const isReduction = proposedSeatCount < before.seatCount;
  const reductionAllowed =
    !isReduction ||
    contract.seatReductionCadence === "anytime" ||
    contract.seatReductionCadence === "monthly" ||
    (contract.seatReductionCadence === "renewal-only" &&
      asOfDate === contract.renewsAt);
  const protectedActiveRemovals = removedAssignments.filter(
    (removal) =>
      removal.activeInLast90Days &&
      intent.protectedTeamIds.includes(removal.teamId),
  );
  const activeRemovals = removedAssignments.filter(
    (removal) => removal.activeInLast90Days,
  );
  const criticalDependency = dependencies.some(
    (dependency) => dependency.criticality === "critical",
  );

  return [
    {
      code: "SEAT_REDUCTION_WINDOW",
      label: "Contract permits the seat change",
      severity: "hard-blocker",
      passed: reductionAllowed,
      message: reductionAllowed
        ? isReduction
          ? `Seat reductions are permitted ${contract.seatReductionCadence}.`
          : "The proposed seat count does not reduce the contract quantity."
        : `Seats may only change ${contract.seatReductionCadence}; ${asOfDate} is not the renewal date.`,
    },
    {
      code: "CONTRACT_SEAT_FLOOR",
      label: "Contract seat floor respected",
      severity: "hard-blocker",
      passed: proposedSeatCount >= contract.minimumSeats,
      message:
        proposedSeatCount >= contract.minimumSeats
          ? `The proposed ${proposedSeatCount} seats meet the ${contract.minimumSeats}-seat floor.`
          : `The proposed ${proposedSeatCount} seats fall below the ${contract.minimumSeats}-seat floor.`,
    },
    {
      code: "PROTECTED_ACTIVE_USERS",
      label: "Protected active users unaffected",
      severity: "hard-blocker",
      passed: protectedActiveRemovals.length === 0,
      message:
        protectedActiveRemovals.length === 0
          ? "No active user in a protected team loses access."
          : `${protectedActiveRemovals.length} active protected user(s) would lose access.`,
    },
    {
      code: "CRITICAL_SERVICE_CONTINUITY",
      label: "Critical service continuity preserved",
      severity: "hard-blocker",
      passed: !criticalDependency || activeRemovals.length === 0,
      message:
        !criticalDependency || activeRemovals.length === 0
          ? "No active user is removed from a critical service."
          : `${activeRemovals.length} active user(s) would be removed from a critical service.`,
    },
    {
      code: "NO_CONTRACT_PENALTY",
      label: "No contractual penalty",
      severity: "hard-blocker",
      passed: 0 <= intent.maximumContractPenaltyCents,
      message: "A seat adjustment incurs $0 in cancellation penalties.",
    },
  ];
}

export function evaluateSavingsTarget(
  intent: IntentSpec,
  impact: Impact,
): ConstraintCheck {
  const passed = impact.savingsBasisPoints >= intent.minimumSavingsBasisPoints;
  return {
    code: "MINIMUM_SAVINGS_TARGET",
    label: "Savings target reached",
    severity: "advisory",
    passed,
    message: passed
      ? `Projected savings meet the ${intent.minimumSavingsBasisPoints / 100}% target.`
      : `Projected savings are below the ${intent.minimumSavingsBasisPoints / 100}% target.`,
  };
}

export type PlanConstraintInput = {
  contract: ContractTerms;
  dependencies: OperationalDependency[];
  assignments: LicenseAssignment[];
  catalog: OrbitCatalog;
  intent: IntentSpec;
  transition?: PlanTransition;
  asOfDate: string;
};

export function evaluatePlanChangeConstraints({
  contract,
  dependencies,
  assignments,
  catalog,
  intent,
  transition,
  asOfDate,
}: PlanConstraintInput): ConstraintCheck[] {
  const capabilityPreserving =
    transition?.approved === true &&
    transition.capabilityEffect === "preserving";
  const protectedUsers = protectedActiveAssignments(
    assignments,
    catalog,
    intent,
  );
  const criticalDependency = dependencies.some(
    (dependency) => dependency.criticality === "critical",
  );
  const cadenceAllowed = changeAllowedAt(
    contract.planChangeCadence,
    asOfDate,
    contract.renewsAt,
  );

  return [
    {
      code: "PLAN_CHANGE_WINDOW",
      label: "Contract permits the plan change",
      severity: "hard-blocker",
      passed: cadenceAllowed,
      message: cadenceAllowed
        ? `Plan changes are permitted ${contract.planChangeCadence}.`
        : `Plan changes are limited to ${contract.planChangeCadence}; ${asOfDate} is not the renewal date.`,
    },
    {
      code: "PLAN_CAPABILITY_EFFECT",
      label: "Required capabilities preserved",
      severity: "advisory",
      passed: capabilityPreserving,
      message: capabilityPreserving
        ? transition.description
        : "This plan transition may reduce capabilities and requires human review.",
    },
    {
      code: "PROTECTED_ACTIVE_USERS",
      label: "Protected active users unaffected",
      severity: "hard-blocker",
      passed: capabilityPreserving || protectedUsers.length === 0,
      message:
        capabilityPreserving || protectedUsers.length === 0
          ? "No active protected user loses a required capability."
          : `${protectedUsers.length} active protected user(s) may lose required capabilities.`,
    },
    {
      code: "CRITICAL_SERVICE_CONTINUITY",
      label: "Critical service continuity preserved",
      severity: "hard-blocker",
      passed: capabilityPreserving || !criticalDependency,
      message:
        capabilityPreserving || !criticalDependency
          ? "The transition does not reduce a critical service capability."
          : "The transition may reduce capabilities on a critical service.",
    },
    {
      code: "NO_CONTRACT_PENALTY",
      label: "No contractual penalty",
      severity: "hard-blocker",
      passed: 0 <= intent.maximumContractPenaltyCents,
      message: "A plan change incurs $0 in cancellation penalties.",
    },
  ];
}

export type CancellationConstraintInput = {
  contract: ContractTerms;
  dependencies: OperationalDependency[];
  assignments: LicenseAssignment[];
  catalog: OrbitCatalog;
  intent: IntentSpec;
};

export function evaluateCancellationConstraints({
  contract,
  dependencies,
  assignments,
  catalog,
  intent,
}: CancellationConstraintInput): ConstraintCheck[] {
  const protectedUsers = protectedActiveAssignments(
    assignments,
    catalog,
    intent,
  );
  const activeUsers = assignments.filter(
    (assignment) => assignment.activeInLast90Days,
  );
  const criticalDependency = dependencies.some(
    (dependency) => dependency.criticality === "critical",
  );
  const penaltyAllowed =
    contract.cancellationPenaltyCents <= intent.maximumContractPenaltyCents;

  return [
    {
      code: "CANCELLATION_NOTICE",
      label: "Cancellation can take effect immediately",
      severity: "hard-blocker",
      passed: contract.cancellationNoticeDays === 0,
      message:
        contract.cancellationNoticeDays === 0
          ? "The contract allows immediate cancellation."
          : `${contract.cancellationNoticeDays} days of notice are required before cancellation.`,
    },
    {
      code: "CONTRACT_PENALTY_LIMIT",
      label: "Contractual penalty within policy",
      severity: "hard-blocker",
      passed: penaltyAllowed,
      message: penaltyAllowed
        ? `The ${contract.cancellationPenaltyCents}-cent penalty is within policy.`
        : `The ${contract.cancellationPenaltyCents}-cent penalty exceeds the ${intent.maximumContractPenaltyCents}-cent limit.`,
    },
    {
      code: "PROTECTED_ACTIVE_USERS",
      label: "Protected active users unaffected",
      severity: "hard-blocker",
      passed: protectedUsers.length === 0,
      message:
        protectedUsers.length === 0
          ? "No active protected user loses access."
          : `${protectedUsers.length} active protected user(s) would lose access.`,
    },
    {
      code: "CRITICAL_SERVICE_CONTINUITY",
      label: "Critical service continuity preserved",
      severity: "hard-blocker",
      passed: !criticalDependency,
      message: !criticalDependency
        ? "The cancelled service is not a critical dependency."
        : `Cancellation would disrupt a critical service used by ${activeUsers.length} active user(s).`,
    },
  ];
}
