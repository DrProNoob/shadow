import type {
  LicenseAssignment,
  PersonId,
  SubscriptionId,
  SubscriptionState,
  UsageCohort,
} from "@/domain/model";
import {
  FIGMA_AFFECTED_MARKETING_PERSON_IDS,
  getPersonIdsForTeam,
  ORBIT_PEOPLE,
} from "@/data/orbit/people";

export const ORBIT_SUBSCRIPTIONS: Record<SubscriptionId, SubscriptionState> = {
  "subscription-adobe": {
    id: "subscription-adobe",
    productId: "product-adobe",
    planId: "plan-adobe-enterprise",
    contractId: "contract-adobe",
    seatCount: 63,
    monthlyCostCents: 504_000,
    status: "active",
  },
  "subscription-figma": {
    id: "subscription-figma",
    productId: "product-figma",
    planId: "plan-figma-organization",
    contractId: "contract-figma",
    seatCount: 91,
    monthlyCostCents: 2_411_500,
    status: "active",
  },
  "subscription-slack": {
    id: "subscription-slack",
    productId: "product-slack",
    planId: "plan-slack-business-plus",
    contractId: "contract-slack",
    seatCount: 312,
    monthlyCostCents: 1_560_000,
    status: "active",
  },
  "subscription-notion": {
    id: "subscription-notion",
    productId: "product-notion",
    planId: "plan-notion-enterprise",
    contractId: "contract-notion",
    seatCount: 240,
    monthlyCostCents: 1_920_000,
    status: "active",
  },
  "subscription-zoom": {
    id: "subscription-zoom",
    productId: "product-zoom",
    planId: "plan-zoom-business",
    contractId: "contract-zoom",
    seatCount: 360,
    monthlyCostCents: 1_800_000,
    status: "active",
  },
  "subscription-miro": {
    id: "subscription-miro",
    productId: "product-miro",
    planId: "plan-miro-enterprise",
    contractId: "contract-miro",
    seatCount: 180,
    monthlyCostCents: 1_080_000,
    status: "active",
  },
  "subscription-datadog": {
    id: "subscription-datadog",
    productId: "product-datadog",
    planId: "plan-datadog-commit",
    contractId: "contract-datadog",
    seatCount: 96,
    monthlyCostCents: 4_453_500,
    status: "active",
  },
  "subscription-atlassian": {
    id: "subscription-atlassian",
    productId: "product-atlassian",
    planId: "plan-atlassian-enterprise",
    contractId: "contract-atlassian",
    seatCount: 120,
    monthlyCostCents: 2_800_000,
    status: "active",
  },
  "subscription-loom": {
    id: "subscription-loom",
    productId: "product-loom",
    planId: "plan-loom-business",
    contractId: "contract-loom",
    seatCount: 170,
    monthlyCostCents: 901_000,
    status: "active",
  },
  "subscription-grammarly": {
    id: "subscription-grammarly",
    productId: "product-grammarly",
    planId: "plan-grammarly-business",
    contractId: "contract-grammarly",
    seatCount: 200,
    monthlyCostCents: 1_000_000,
    status: "active",
  },
};

const allPersonIds = Object.keys(ORBIT_PEOPLE);
const engineering = getPersonIdsForTeam("team-engineering");
const design = getPersonIdsForTeam("team-design");
const product = getPersonIdsForTeam("team-product");
const marketing = getPersonIdsForTeam("team-marketing");
const finance = getPersonIdsForTeam("team-finance");
const people = getPersonIdsForTeam("team-people");

function without(source: PersonId[], excluded: PersonId[]): PersonId[] {
  const excludedIds = new Set(excluded);
  return source.filter((personId) => !excludedIds.has(personId));
}

function assignmentId(
  subscriptionId: SubscriptionId,
  personId: PersonId,
): string {
  return `assignment-${subscriptionId.replace("subscription-", "")}-${personId.replace(
    "person-",
    "",
  )}`;
}

function createAssignments(
  subscriptionId: SubscriptionId,
  activePersonIds: PersonId[],
  inactivePersonIds: PersonId[],
  activeUsage: (personId: PersonId, index: number) => number = (
    _personId,
    index,
  ) => 50 + (index % 40),
): LicenseAssignment[] {
  const active = activePersonIds.map(
    (personId, index) =>
      ({
        id: assignmentId(subscriptionId, personId),
        subscriptionId,
        personId,
        activeInLast90Days: true,
        lastActiveAt: index % 2 === 0 ? "2026-08-21" : "2026-08-14",
        usageUnits90d: activeUsage(personId, index),
      }) satisfies LicenseAssignment,
  );
  const inactive = inactivePersonIds.map(
    (personId) =>
      ({
        id: assignmentId(subscriptionId, personId),
        subscriptionId,
        personId,
        activeInLast90Days: false,
        lastActiveAt: "2026-03-01",
        usageUnits90d: 0,
      }) satisfies LicenseAssignment,
  );

  return [...active, ...inactive];
}

const adobeActive = design.slice(0, 17);
const adobeInactive = [
  ...design.slice(17),
  ...marketing.slice(11),
  ...product.slice(0, 14),
];

const figmaCoreActive = [
  ...engineering.slice(0, 20),
  ...design,
  ...product.slice(0, 3),
];
const figmaActive = [
  ...figmaCoreActive,
  ...FIGMA_AFFECTED_MARKETING_PERSON_IDS,
];
const figmaInactive = [...product.slice(3), ...marketing.slice(11, 19)];

const slackInactive = [...people, ...finance.slice(0, 9)];
const slackActive = without(allPersonIds, slackInactive);

const notionAssigned = allPersonIds.slice(0, 240);
const zoomActive = allPersonIds.slice(0, 280);
const miroAssigned = allPersonIds.slice(0, 180);
const atlassianActive = [...engineering, ...product];
const loomInactive = allPersonIds.slice(0, 170);
const grammarlyAssigned = allPersonIds.slice(0, 200);

export const ORBIT_ASSIGNMENTS: LicenseAssignment[] = [
  ...createAssignments("subscription-adobe", adobeActive, adobeInactive),
  ...createAssignments(
    "subscription-figma",
    figmaActive,
    figmaInactive,
    (personId, index) => {
      const affectedIndex =
        FIGMA_AFFECTED_MARKETING_PERSON_IDS.indexOf(personId);
      return affectedIndex >= 0 ? affectedIndex + 1 : 70 + (index % 25);
    },
  ),
  ...createAssignments("subscription-slack", slackActive, slackInactive),
  ...createAssignments(
    "subscription-notion",
    notionAssigned.slice(0, 175),
    notionAssigned.slice(175),
  ),
  ...createAssignments(
    "subscription-zoom",
    zoomActive,
    allPersonIds.slice(280),
  ),
  ...createAssignments(
    "subscription-miro",
    miroAssigned.slice(0, 141),
    miroAssigned.slice(141),
  ),
  ...createAssignments("subscription-datadog", engineering, []),
  ...createAssignments("subscription-atlassian", atlassianActive, []),
  ...createAssignments("subscription-loom", [], loomInactive),
  ...createAssignments(
    "subscription-grammarly",
    grammarlyAssigned.slice(0, 136),
    grammarlyAssigned.slice(136),
  ),
];

function createUsageCohorts(): UsageCohort[] {
  const cohorts: UsageCohort[] = [];

  for (const subscription of Object.values(ORBIT_SUBSCRIPTIONS)) {
    const assignments = ORBIT_ASSIGNMENTS.filter(
      (assignment) => assignment.subscriptionId === subscription.id,
    );
    const activePersonIds = assignments
      .filter((assignment) => assignment.activeInLast90Days)
      .map((assignment) => assignment.personId);
    const inactivePersonIds = assignments
      .filter((assignment) => !assignment.activeInLast90Days)
      .map((assignment) => assignment.personId);

    cohorts.push({
      id: `cohort-${subscription.id.replace("subscription-", "")}-active`,
      subscriptionId: subscription.id,
      label: "Active in the last 90 days",
      activeInLast90Days: true,
      personIds: activePersonIds,
      note: "Observed product activity during the fixed 90-day demo window.",
    });
    cohorts.push({
      id: `cohort-${subscription.id.replace("subscription-", "")}-inactive`,
      subscriptionId: subscription.id,
      label: "No activity in the last 90 days",
      activeInLast90Days: false,
      personIds: inactivePersonIds,
      note: "Assigned license with no observed product activity in the demo window.",
    });
  }

  cohorts.push({
    id: "cohort-figma-low-usage-marketing",
    subscriptionId: "subscription-figma",
    label: "Low-usage active Marketing users",
    activeInLast90Days: true,
    personIds: [...FIGMA_AFFECTED_MARKETING_PERSON_IDS],
    note: "Eleven named Marketing users create the Conservative/Aggressive tradeoff.",
  });

  return cohorts;
}

export const ORBIT_USAGE_COHORTS = createUsageCohorts();
