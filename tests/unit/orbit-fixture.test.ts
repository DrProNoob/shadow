import { describe, expect, it } from "vitest";
import {
  getPeopleOverview,
  getRealityOverview,
  getSubscriptionContext,
  listContracts,
  listSubscriptions,
} from "@/application/queries";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import type { Plan } from "@/domain/model";

function planCost(plan: Plan, seatCount: number): number {
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

function usageCounts(subscriptionId: string) {
  const workspace = createOrbitSeed();
  const assignments = workspace.reality.assignments.filter(
    (assignment) => assignment.subscriptionId === subscriptionId,
  );
  return {
    assigned: assignments.length,
    active: assignments.filter((assignment) => assignment.activeInLast90Days)
      .length,
    inactive: assignments.filter((assignment) => !assignment.activeInLast90Days)
      .length,
  };
}

describe("ORBIT deterministic fixture", () => {
  it("contains eight exact team cohorts totaling 312 people", () => {
    const workspace = createOrbitSeed();
    const people = Object.values(workspace.catalog.people);
    const headcounts = Object.values(workspace.catalog.teams).map((team) => [
      team.name,
      people.filter((person) => person.teamId === team.id).length,
    ]);

    expect(people).toHaveLength(312);
    expect(headcounts).toEqual([
      ["Engineering", 96],
      ["Design", 28],
      ["Product", 24],
      ["Sales", 56],
      ["Marketing", 32],
      ["Operations", 36],
      ["Finance", 18],
      ["People", 22],
    ]);
    expect(workspace.catalog.policies.protectedActiveTeamIds).toEqual([
      "team-engineering",
    ]);
  });

  it("contains ten subscription costs totaling exactly $184,300 per month", () => {
    const workspace = createOrbitSeed();
    const subscriptions = Object.values(workspace.reality.subscriptions);

    expect(subscriptions).toHaveLength(10);
    expect(
      subscriptions.reduce(
        (total, subscription) => total + subscription.monthlyCostCents,
        0,
      ),
    ).toBe(18_430_000);
    expect(workspace.reality.monthlySoftwareCostCents).toBe(18_430_000);

    expect(
      Object.fromEntries(
        subscriptions.map((subscription) => [
          workspace.catalog.products[subscription.productId].name,
          subscription.monthlyCostCents,
        ]),
      ),
    ).toEqual({
      Adobe: 504_000,
      Figma: 2_411_500,
      Slack: 1_560_000,
      Notion: 1_920_000,
      Zoom: 1_800_000,
      Miro: 1_080_000,
      Datadog: 4_453_500,
      Atlassian: 2_800_000,
      Loom: 901_000,
      Grammarly: 1_000_000,
    });
  });

  it("keeps every current plan's pricing arithmetic consistent with Reality", () => {
    const workspace = createOrbitSeed();

    for (const subscription of Object.values(workspace.reality.subscriptions)) {
      const plan = workspace.catalog.plans[subscription.planId];
      expect(plan.productId).toBe(subscription.productId);
      expect(planCost(plan, subscription.seatCount)).toBe(
        subscription.monthlyCostCents,
      );
    }
  });

  it("encodes the designed usage facts without orphan or duplicate assignments", () => {
    const workspace = createOrbitSeed();
    const assignmentIds = workspace.reality.assignments.map(
      (assignment) => assignment.id,
    );

    expect(new Set(assignmentIds).size).toBe(assignmentIds.length);
    for (const assignment of workspace.reality.assignments) {
      expect(workspace.catalog.people[assignment.personId]).toBeDefined();
      expect(
        workspace.reality.subscriptions[assignment.subscriptionId],
      ).toBeDefined();
    }

    expect(usageCounts("subscription-adobe")).toEqual({
      assigned: 63,
      active: 17,
      inactive: 46,
    });
    expect(usageCounts("subscription-figma")).toEqual({
      assigned: 91,
      active: 62,
      inactive: 29,
    });
    expect(usageCounts("subscription-slack")).toEqual({
      assigned: 312,
      active: 281,
      inactive: 31,
    });
    expect(usageCounts("subscription-notion")).toEqual({
      assigned: 240,
      active: 175,
      inactive: 65,
    });
    expect(usageCounts("subscription-zoom")).toEqual({
      assigned: 312,
      active: 280,
      inactive: 32,
    });
    expect(usageCounts("subscription-miro")).toEqual({
      assigned: 180,
      active: 141,
      inactive: 39,
    });
    expect(usageCounts("subscription-loom")).toEqual({
      assigned: 170,
      active: 0,
      inactive: 170,
    });
    expect(usageCounts("subscription-grammarly")).toEqual({
      assigned: 200,
      active: 136,
      inactive: 64,
    });
  });

  it("names exactly eleven active low-usage Marketing users for the Figma tradeoff", () => {
    const workspace = createOrbitSeed();
    const cohort = workspace.catalog.usageCohorts.find(
      (candidate) => candidate.id === "cohort-figma-low-usage-marketing",
    );

    expect(cohort?.personIds).toHaveLength(11);
    expect(
      cohort?.personIds.map(
        (personId) => workspace.catalog.people[personId].displayName,
      ),
    ).toEqual([
      "Maya Chen",
      "Theo Brooks",
      "Nia Patel",
      "Lucas Meyer",
      "Sofia Alvarez",
      "Noah Kim",
      "Emma Fischer",
      "Amir Hassan",
      "Chloe Martin",
      "Leo Rossi",
      "Zoe Walker",
    ]);

    for (const personId of cohort?.personIds ?? []) {
      expect(workspace.catalog.people[personId].teamId).toBe("team-marketing");
      const assignment = workspace.reality.assignments.find(
        (candidate) =>
          candidate.subscriptionId === "subscription-figma" &&
          candidate.personId === personId,
      );
      expect(assignment?.activeInLast90Days).toBe(true);
      expect(assignment?.usageUnits90d).toBeGreaterThanOrEqual(1);
      expect(assignment?.usageUnits90d).toBeLessThanOrEqual(11);
    }
  });

  it("locks the penalty, floor, and critical-dependency evidence", () => {
    const workspace = createOrbitSeed();
    const miro = workspace.catalog.contracts["contract-miro"];
    const criticalProducts = workspace.catalog.dependencies
      .filter((dependency) => dependency.criticality === "critical")
      .map(
        (dependency) => workspace.catalog.products[dependency.productId].name,
      )
      .sort();

    expect(miro.minimumSeats).toBe(141);
    expect(miro.cancellationPenaltyCents).toBe(2_500_000);
    expect(criticalProducts).toEqual(["Atlassian", "Datadog"]);
    expect(workspace.catalog.contracts["contract-loom"]).toMatchObject({
      billingCadence: "monthly",
      cancellationPenaltyCents: 0,
      cancellationNoticeDays: 0,
    });
  });

  it("is byte-for-byte reproducible across resets", () => {
    expect(serializeWorkspace(createOrbitSeed())).toBe(
      serializeWorkspace(createOrbitSeed()),
    );
  });
});

describe("read-only ORBIT queries", () => {
  it("returns coherent operational subscription and contract views", () => {
    const workspace = createOrbitSeed();
    const subscriptions = listSubscriptions(workspace);
    const adobe = subscriptions.find((item) => item.productName === "Adobe");
    const zoom = subscriptions.find((item) => item.productName === "Zoom");
    const loom = subscriptions.find((item) => item.productName === "Loom");
    const miroContract = listContracts(workspace).find(
      (contract) => contract.productName === "Miro",
    );

    expect(adobe).toMatchObject({
      seatCount: 63,
      activeUsers90d: 17,
      inactiveUsers90d: 46,
      monthlyCostCents: 504_000,
    });
    expect(zoom).toMatchObject({ seatCount: 360, unassignedSeats: 48 });
    expect(loom?.tags).toContain("Zero 90-day usage");
    expect(miroContract).toMatchObject({
      minimumSeats: 141,
      cancellationPenaltyCents: 2_500_000,
    });
  });

  it("provides complete subscription, people, and overview contexts", () => {
    const workspace = createOrbitSeed();
    const figma = getSubscriptionContext(workspace, "subscription-figma");
    const people = getPeopleOverview(workspace);
    const overview = getRealityOverview(workspace);

    expect(figma).not.toBeNull();
    expect(figma?.assignments).toHaveLength(91);
    expect(
      figma?.usageCohorts.some((cohort) => cohort.personIds.length === 11),
    ).toBe(true);
    expect(people).toMatchObject({
      employeeCount: 312,
      activeTeamCount: 8,
      protectedTeamIds: ["team-engineering"],
    });
    expect(people.highlightedPeople).toHaveLength(11);
    expect(overview).toMatchObject({
      annualSoftwareCostCents: 221_160_000,
      criticalSubscriptionCount: 2,
    });
    expect(overview.upcomingRenewals[0]).toMatchObject({
      productName: "Loom",
      renewsAt: "2026-09-01",
    });
  });
});
