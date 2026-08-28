import type {
  ChangeId,
  CompanySummary,
  ContractTerms,
  DependencyCriticality,
  LicenseAssignment,
  OperationalDependency,
  OrbitCatalog,
  Plan,
  Product,
  ShadowChange,
  ShadowProjection,
  SubscriptionId,
  SubscriptionState,
  UsageCohort,
  WorkspaceState,
} from "@/domain/model";

export type SubscriptionView = {
  id: SubscriptionId;
  productId: string;
  productName: string;
  category: Product["category"];
  planId: string;
  planName: string;
  seatCount: number;
  assignedCount: number;
  activeUsers90d: number;
  inactiveUsers90d: number;
  unassignedSeats: number;
  monthlyCostCents: number;
  annualCostCents: number;
  status: SubscriptionState["status"];
  criticality: DependencyCriticality;
  renewalDate: string;
  cancellationPenaltyCents: number;
  tags: string[];
};

/**
 * An explicit read model for what-is versus what-could-be. Keeping the two
 * SubscriptionViews separate prevents projected state from masquerading as
 * mutable Reality.
 */
export type ProjectedSubscriptionView = {
  id: SubscriptionId;
  productId: string;
  productName: string;
  baseline: SubscriptionView;
  projected: SubscriptionView;
  changed: boolean;
  changeKinds: ShadowChange["actionType"][];
  changeIds: ChangeId[];
  monthlySavingsCents: number;
  annualSavingsCents: number;
};

export type SubscriptionAssignmentView = {
  personId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  role: string;
  activeInLast90Days: boolean;
  lastActiveAt?: string;
  usageUnits90d: number;
};

export type SubscriptionContext = {
  subscription: SubscriptionView;
  product: Product;
  plan: Plan;
  contract: ContractTerms;
  assignments: SubscriptionAssignmentView[];
  dependencies: OperationalDependency[];
  usageCohorts: UsageCohort[];
};

export type ContractView = {
  id: string;
  subscriptionId: SubscriptionId;
  productName: string;
  startsAt: string;
  renewsAt: string;
  billingCadence: ContractTerms["billingCadence"];
  seatReductionCadence: ContractTerms["seatReductionCadence"];
  minimumSeats: number;
  planChangeCadence: ContractTerms["planChangeCadence"];
  cancellationNoticeDays: number;
  cancellationPenaltyCents: number;
  summary: string;
};

export type TeamView = {
  id: string;
  name: string;
  department: string;
  headcount: number;
  protected: boolean;
  subscriptionCount: number;
  activeLicenseCount: number;
};

export type HighlightedPersonView = {
  id: string;
  displayName: string;
  role: string;
  teamId: string;
  teamName: string;
  reason: string;
  productNames: string[];
};

export type PeopleOverview = {
  employeeCount: number;
  activeTeamCount: number;
  protectedTeamIds: string[];
  teams: TeamView[];
  highlightedPeople: HighlightedPersonView[];
};

export type RealityOverview = {
  summary: CompanySummary;
  annualSoftwareCostCents: number;
  criticalSubscriptionCount: number;
  inactiveAssignmentCount: number;
  upcomingRenewals: Array<{
    subscriptionId: SubscriptionId;
    productName: string;
    renewsAt: string;
    monthlyCostCents: number;
  }>;
};

const criticalityRank: Record<DependencyCriticality, number> = {
  supporting: 0,
  important: 1,
  critical: 2,
};

function getProductCriticality(
  dependencies: OperationalDependency[],
): DependencyCriticality {
  return dependencies.reduce<DependencyCriticality>(
    (highest, dependency) =>
      criticalityRank[dependency.criticality] > criticalityRank[highest]
        ? dependency.criticality
        : highest,
    "supporting",
  );
}

export function getCompanySummary(workspace: WorkspaceState): CompanySummary {
  const { reality } = workspace;
  return {
    companyId: reality.companyId,
    companyName: reality.companyName,
    employeeCount: reality.employeeCount,
    subscriptionCount: reality.subscriptionCount,
    monthlySoftwareCostCents: reality.monthlySoftwareCostCents,
    currency: reality.currency,
    realityVersion: reality.version,
    asOfDate: reality.asOfDate,
  };
}

function buildSubscriptionView(
  catalog: OrbitCatalog,
  subscription: SubscriptionState,
  allAssignments: LicenseAssignment[],
): SubscriptionView {
  const product = catalog.products[subscription.productId];
  const plan = catalog.plans[subscription.planId];
  const contract = catalog.contracts[subscription.contractId];
  const assignments = allAssignments.filter(
    (assignment) => assignment.subscriptionId === subscription.id,
  );
  const dependencies = catalog.dependencies.filter(
    (dependency) => dependency.productId === subscription.productId,
  );
  const activeUsers90d = assignments.filter(
    (assignment) => assignment.activeInLast90Days,
  ).length;
  const inactiveUsers90d = assignments.length - activeUsers90d;
  const unassignedSeats = Math.max(
    subscription.seatCount - assignments.length,
    0,
  );
  const criticality = getProductCriticality(dependencies);
  const tags: string[] = [];

  if (criticality === "critical") tags.push("Critical dependency");
  if (contract.cancellationPenaltyCents > 0) tags.push("Penalty risk");
  if (inactiveUsers90d > 0) tags.push(`${inactiveUsers90d} inactive`);
  if (unassignedSeats > 0) tags.push(`${unassignedSeats} unassigned`);
  if (activeUsers90d === 0) tags.push("Zero 90-day usage");

  return {
    id: subscription.id,
    productId: subscription.productId,
    productName: product.name,
    category: product.category,
    planId: plan.id,
    planName: plan.name,
    seatCount: subscription.seatCount,
    assignedCount: assignments.length,
    activeUsers90d,
    inactiveUsers90d,
    unassignedSeats,
    monthlyCostCents: subscription.monthlyCostCents,
    annualCostCents: subscription.monthlyCostCents * 12,
    status: subscription.status,
    criticality,
    renewalDate: contract.renewsAt,
    cancellationPenaltyCents: contract.cancellationPenaltyCents,
    tags,
  };
}

function compareSubscriptionViews(
  left: SubscriptionView,
  right: SubscriptionView,
) {
  return (
    right.monthlyCostCents - left.monthlyCostCents ||
    left.productName.localeCompare(right.productName)
  );
}

export function listSubscriptions(
  workspace: WorkspaceState,
): SubscriptionView[] {
  const { catalog, reality } = workspace;

  return Object.values(reality.subscriptions)
    .map((subscription) =>
      buildSubscriptionView(catalog, subscription, reality.assignments),
    )
    .sort(compareSubscriptionViews);
}

export function listProjectedSubscriptions(
  workspace: WorkspaceState,
  projection: ShadowProjection,
): ProjectedSubscriptionView[] {
  const { catalog, reality } = workspace;
  if (
    projection.baseRealityVersion !== reality.version ||
    projection.projectedReality.sourceRealityVersion !== reality.version
  ) {
    throw new Error(
      `Projection ${projection.shadowId} is not based on current Reality v${reality.version}.`,
    );
  }

  return Object.values(reality.subscriptions)
    .map((baselineState) => {
      const projectedState =
        projection.projectedReality.subscriptions[baselineState.id];
      if (!projectedState) {
        throw new Error(
          `Projection ${projection.shadowId} is missing subscription ${baselineState.id}.`,
        );
      }
      const baseline = buildSubscriptionView(
        catalog,
        baselineState,
        reality.assignments,
      );
      const projected = buildSubscriptionView(
        catalog,
        projectedState,
        projection.projectedReality.assignments,
      );
      const projectedChanges = projection.changes.filter(
        (change) => change.change.subscriptionId === baselineState.id,
      );
      const monthlySavingsCents =
        baseline.monthlyCostCents - projected.monthlyCostCents;

      return {
        id: baseline.id,
        productId: baseline.productId,
        productName: baseline.productName,
        baseline,
        projected,
        changed: projectedChanges.length > 0,
        changeKinds: projectedChanges.map((change) => change.change.actionType),
        changeIds: projectedChanges.map((change) => change.change.id),
        monthlySavingsCents,
        annualSavingsCents: monthlySavingsCents * 12,
      } satisfies ProjectedSubscriptionView;
    })
    .sort((left, right) =>
      compareSubscriptionViews(left.baseline, right.baseline),
    );
}

export function getSubscriptionContext(
  workspace: WorkspaceState,
  subscriptionId: SubscriptionId,
): SubscriptionContext | null {
  const subscription = listSubscriptions(workspace).find(
    (candidate) => candidate.id === subscriptionId,
  );
  const state = workspace.reality.subscriptions[subscriptionId];
  if (!subscription || !state) return null;

  const product = workspace.catalog.products[state.productId];
  const plan = workspace.catalog.plans[state.planId];
  const contract = workspace.catalog.contracts[state.contractId];
  const assignments = workspace.reality.assignments
    .filter((assignment) => assignment.subscriptionId === subscriptionId)
    .map((assignment) => {
      const person = workspace.catalog.people[assignment.personId];
      const team = workspace.catalog.teams[person.teamId];
      return {
        personId: person.id,
        displayName: person.displayName,
        teamId: team.id,
        teamName: team.name,
        role: person.role,
        activeInLast90Days: assignment.activeInLast90Days,
        lastActiveAt: assignment.lastActiveAt,
        usageUnits90d: assignment.usageUnits90d,
      } satisfies SubscriptionAssignmentView;
    })
    .sort(
      (left, right) =>
        Number(right.activeInLast90Days) - Number(left.activeInLast90Days) ||
        right.usageUnits90d - left.usageUnits90d ||
        left.displayName.localeCompare(right.displayName),
    );

  return {
    subscription,
    product,
    plan,
    contract,
    assignments,
    dependencies: workspace.catalog.dependencies.filter(
      (dependency) => dependency.productId === product.id,
    ),
    usageCohorts: workspace.catalog.usageCohorts.filter(
      (cohort) => cohort.subscriptionId === subscriptionId,
    ),
  };
}

export function listContracts(workspace: WorkspaceState): ContractView[] {
  return Object.values(workspace.catalog.contracts)
    .map((contract) => {
      const subscription =
        workspace.reality.subscriptions[contract.subscriptionId];
      const product = workspace.catalog.products[subscription.productId];
      return {
        id: contract.id,
        subscriptionId: contract.subscriptionId,
        productName: product.name,
        startsAt: contract.startsAt,
        renewsAt: contract.renewsAt,
        billingCadence: contract.billingCadence,
        seatReductionCadence: contract.seatReductionCadence,
        minimumSeats: contract.minimumSeats,
        planChangeCadence: contract.planChangeCadence,
        cancellationNoticeDays: contract.cancellationNoticeDays,
        cancellationPenaltyCents: contract.cancellationPenaltyCents,
        summary: contract.summary,
      } satisfies ContractView;
    })
    .sort(
      (left, right) =>
        left.renewsAt.localeCompare(right.renewsAt) ||
        left.productName.localeCompare(right.productName),
    );
}

export function getPeopleOverview(workspace: WorkspaceState): PeopleOverview {
  const people = Object.values(workspace.catalog.people);
  const teams = Object.values(workspace.catalog.teams)
    .map((team) => {
      const teamPersonIds = new Set(
        people
          .filter((person) => person.teamId === team.id)
          .map((person) => person.id),
      );
      const teamAssignments = workspace.reality.assignments.filter(
        (assignment) => teamPersonIds.has(assignment.personId),
      );
      return {
        id: team.id,
        name: team.name,
        department: team.department,
        headcount: teamPersonIds.size,
        protected: workspace.catalog.policies.protectedActiveTeamIds.includes(
          team.id,
        ),
        subscriptionCount: new Set(
          teamAssignments.map((assignment) => assignment.subscriptionId),
        ).size,
        activeLicenseCount: teamAssignments.filter(
          (assignment) => assignment.activeInLast90Days,
        ).length,
      } satisfies TeamView;
    })
    .sort(
      (left, right) =>
        right.headcount - left.headcount || left.name.localeCompare(right.name),
    );

  const highlightedCohort = workspace.catalog.usageCohorts.find(
    (cohort) => cohort.id === "cohort-figma-low-usage-marketing",
  );
  const highlightedPeople = (highlightedCohort?.personIds ?? []).map(
    (personId) => {
      const person = workspace.catalog.people[personId];
      const team = workspace.catalog.teams[person.teamId];
      const productNames = Array.from(
        new Set(
          workspace.reality.assignments
            .filter(
              (assignment) =>
                assignment.personId === personId &&
                assignment.activeInLast90Days,
            )
            .map((assignment) => {
              const subscription =
                workspace.reality.subscriptions[assignment.subscriptionId];
              return workspace.catalog.products[subscription.productId].name;
            }),
        ),
      ).sort();

      return {
        id: person.id,
        displayName: person.displayName,
        role: person.role,
        teamId: team.id,
        teamName: team.name,
        reason:
          "Active Figma user with low observed usage; affected only by the Aggressive future.",
        productNames,
      } satisfies HighlightedPersonView;
    },
  );

  return {
    employeeCount: people.length,
    activeTeamCount: teams.length,
    protectedTeamIds: [...workspace.catalog.policies.protectedActiveTeamIds],
    teams,
    highlightedPeople,
  };
}

export function getRealityOverview(workspace: WorkspaceState): RealityOverview {
  const subscriptions = listSubscriptions(workspace);
  const criticalSubscriptionCount = subscriptions.filter(
    (subscription) => subscription.criticality === "critical",
  ).length;

  return {
    summary: getCompanySummary(workspace),
    annualSoftwareCostCents: workspace.reality.monthlySoftwareCostCents * 12,
    criticalSubscriptionCount,
    inactiveAssignmentCount: workspace.reality.assignments.filter(
      (assignment) => !assignment.activeInLast90Days,
    ).length,
    upcomingRenewals: listContracts(workspace)
      .slice(0, 4)
      .map((contract) => ({
        subscriptionId: contract.subscriptionId,
        productName: contract.productName,
        renewsAt: contract.renewsAt,
        monthlyCostCents:
          workspace.reality.subscriptions[contract.subscriptionId]
            .monthlyCostCents,
      })),
  };
}
