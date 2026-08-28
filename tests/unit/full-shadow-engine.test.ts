import { describe, expect, it } from "vitest";
import { loadExampleFutures } from "@/application/named-futures";
import {
  beginShadow,
  stageCancellation,
  stagePlanChange,
  stageSeatChange,
} from "@/application/shadow-service";
import {
  createOrbitSeed,
  parseWorkspace,
  serializeWorkspace,
} from "@/data/orbit/seed";
import type { Result } from "@/domain/model";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

describe("plan changes", () => {
  it("projects ORBIT's approved Notion conversion as capability-preserving and Low risk", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Plan conversion" }));
    const staged = unwrap(
      stagePlanChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
        source: "webmcp",
      }),
    );
    const notion =
      staged.projection.projectedReality.subscriptions["subscription-notion"];
    const projectedChange = staged.projection.changes[0];

    expect(notion).toMatchObject({
      planId: "plan-notion-business",
      seatCount: 240,
      monthlyCostCents: 1_372_500,
    });
    expect(projectedChange.impact).toMatchObject({
      monthlySavingsCents: 547_500,
      activeUsersAffected: 0,
      activeEngineeringUsersAffected: 0,
      risk: "low",
    });
    expect(projectedChange.checks).toContainEqual(
      expect.objectContaining({ code: "PLAN_CAPABILITY_EFFECT", passed: true }),
    );
    expect(projectedChange.proof.evidence).toContainEqual(
      expect.objectContaining({
        label: "Capability effect",
        value: "preserving",
      }),
    );
    expect(staged.projection.hardBlockers).toEqual([]);
    expect(staged.workspace.activity.at(-1)).toMatchObject({
      source: "webmcp",
      commandName: "stage_plan_change",
      arguments: {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
      },
    });
  });

  it("validates target plans and preserves a same-kind replacement ID", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Plan validation" }));

    expect(
      stagePlanChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "missing-plan",
      }),
    ).toMatchObject({ ok: false, error: { code: "PLAN_NOT_FOUND" } });
    expect(
      stagePlanChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-adobe-enterprise",
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "PLAN_PRODUCT_MISMATCH" },
    });

    const first = unwrap(
      stagePlanChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
      }),
    );
    const replacement = unwrap(
      stagePlanChange(first.workspace, {
        shadowId: first.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
        source: "demo-replay",
      }),
    );

    expect(replacement.change.id).toBe(first.change.id);
    expect(replacement.workspace.counters.change).toBe(1);
    expect(replacement.shadow.changes).toHaveLength(1);
    expect(replacement.shadow.revision).toBe(2);
  });
});

describe("cancellation changes", () => {
  it("cancels zero-usage Loom with zero seats, zero cost, and Low risk", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Remove Loom" }));
    const cancelled = unwrap(
      stageCancellation(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-loom",
      }),
    );
    const loom =
      cancelled.projection.projectedReality.subscriptions["subscription-loom"];

    expect(loom).toMatchObject({
      status: "cancelled",
      seatCount: 0,
      monthlyCostCents: 0,
    });
    expect(
      cancelled.projection.projectedReality.assignments.filter(
        (assignment) => assignment.subscriptionId === "subscription-loom",
      ),
    ).toEqual([]);
    expect(cancelled.projection.totalImpact).toMatchObject({
      monthlySavingsCents: 901_000,
      contractPenaltyCents: 0,
      activeUsersAffected: 0,
      risk: "low",
    });
    expect(cancelled.projection.hardBlockers).toEqual([]);
    expect(cancelled.projection.proofs[0].transition).toEqual({
      before: { status: "active", monthlyCostCents: 901_000 },
      after: { status: "cancelled", monthlyCostCents: 0 },
    });
  });

  it("keeps Miro cancellation projectable with a $25,000 hard blocker", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Unsafe Miro" }));
    const cancelled = unwrap(
      stageCancellation(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-miro",
        source: "webmcp",
      }),
    );

    expect(cancelled.projection.totalImpact).toMatchObject({
      monthlySavingsCents: 1_080_000,
      contractPenaltyCents: 2_500_000,
      risk: "high",
    });
    expect(cancelled.projection.hardBlockers).toContainEqual(
      expect.objectContaining({
        code: "CONTRACT_PENALTY_LIMIT",
        passed: false,
      }),
    );
    expect(cancelled.workspace.shadows[begun.shadow.id].changes).toHaveLength(
      1,
    );
  });

  it.each(["subscription-datadog", "subscription-atlassian"])(
    "blocks cancellation of critical service %s without rejecting staging",
    (subscriptionId) => {
      const seed = createOrbitSeed();
      const begun = unwrap(beginShadow(seed, { name: "Unsafe critical" }));
      const cancelled = unwrap(
        stageCancellation(begun.workspace, {
          shadowId: begun.shadow.id,
          subscriptionId,
        }),
      );

      expect(cancelled.projection.totalImpact.risk).toBe("high");
      expect(cancelled.projection.hardBlockers).toContainEqual(
        expect.objectContaining({
          code: "CRITICAL_SERVICE_CONTINUITY",
          passed: false,
        }),
      );
    },
  );

  it("enforces cancellation exclusivity in both staging directions", () => {
    const seed = createOrbitSeed();
    const firstShadow = unwrap(beginShadow(seed, { name: "Seat first" }));
    const withSeat = unwrap(
      stageSeatChange(firstShadow.workspace, {
        shadowId: firstShadow.shadow.id,
        subscriptionId: "subscription-miro",
        seatCount: 141,
      }),
    );
    expect(
      stageCancellation(withSeat.workspace, {
        shadowId: withSeat.shadow.id,
        subscriptionId: "subscription-miro",
      }),
    ).toMatchObject({ ok: false, error: { code: "CHANGE_CONFLICT" } });

    const secondShadow = unwrap(
      beginShadow(withSeat.workspace, { name: "Cancel first" }),
    );
    const withCancellation = unwrap(
      stageCancellation(secondShadow.workspace, {
        shadowId: secondShadow.shadow.id,
        subscriptionId: "subscription-loom",
      }),
    );
    expect(
      stageSeatChange(withCancellation.workspace, {
        shadowId: withCancellation.shadow.id,
        subscriptionId: "subscription-loom",
        seatCount: 100,
      }),
    ).toMatchObject({ ok: false, error: { code: "CHANGE_CONFLICT" } });
    expect(
      stagePlanChange(withCancellation.workspace, {
        shadowId: withCancellation.shadow.id,
        subscriptionId: "subscription-loom",
        planId: "plan-loom-business",
      }),
    ).toMatchObject({ ok: false, error: { code: "CHANGE_CONFLICT" } });
  });
});

describe("canonical projection ordering", () => {
  it("produces the same projected state and attribution regardless of plan/seat staging order", () => {
    const seed = createOrbitSeed();
    const first = unwrap(beginShadow(seed, { name: "Plan then seat" }));
    const planFirst = unwrap(
      stagePlanChange(first.workspace, {
        shadowId: first.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
      }),
    );
    const planThenSeat = unwrap(
      stageSeatChange(planFirst.workspace, {
        shadowId: first.shadow.id,
        subscriptionId: "subscription-notion",
        seatCount: 175,
      }),
    );

    const second = unwrap(
      beginShadow(planThenSeat.workspace, { name: "Seat then plan" }),
    );
    const seatFirst = unwrap(
      stageSeatChange(second.workspace, {
        shadowId: second.shadow.id,
        subscriptionId: "subscription-notion",
        seatCount: 175,
      }),
    );
    const seatThenPlan = unwrap(
      stagePlanChange(seatFirst.workspace, {
        shadowId: second.shadow.id,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
      }),
    );

    expect(seatThenPlan.projection.projectedReality).toEqual(
      planThenSeat.projection.projectedReality,
    );
    expect(seatThenPlan.projection.totalImpact).toEqual(
      planThenSeat.projection.totalImpact,
    );
    const attribution = (projection: typeof planThenSeat.projection) =>
      projection.changes.map((change) => ({
        type: change.change.actionType,
        monthlySavingsCents: change.impact.monthlySavingsCents,
      }));
    expect(attribution(planThenSeat.projection)).toEqual([
      { type: "plan", monthlySavingsCents: 547_500 },
      { type: "seat-count", monthlySavingsCents: 162_500 },
    ]);
    expect(attribution(seatThenPlan.projection)).toEqual(
      attribution(planThenSeat.projection),
    );
  });
});

describe("named demo futures", () => {
  it("loads exact Conservative and Aggressive futures through the command services", () => {
    const seed = createOrbitSeed();
    const before = serializeWorkspace(seed);
    const loaded = unwrap(loadExampleFutures(seed));

    expect(serializeWorkspace(seed)).toBe(before);
    expect(loaded.workspace.reality).toEqual(seed.reality);
    expect(loaded.conservative.changes).toHaveLength(7);
    expect(loaded.aggressive.changes).toHaveLength(9);
    expect(loaded.conservativeProjection.totalImpact).toEqual({
      monthlySavingsCents: 3_029_000,
      annualSavingsCents: 36_348_000,
      savingsBasisPoints: 1_644,
      contractPenaltyCents: 0,
      activeUsersAffected: 0,
      activeEngineeringUsersAffected: 0,
      risk: "low",
    });
    expect(loaded.aggressiveProjection.totalImpact).toEqual({
      monthlySavingsCents: 4_148_000,
      annualSavingsCents: 49_776_000,
      savingsBasisPoints: 2_251,
      contractPenaltyCents: 0,
      activeUsersAffected: 11,
      activeEngineeringUsersAffected: 0,
      risk: "medium",
    });
    expect(loaded.conservativeProjection.hardBlockers).toEqual([]);
    expect(loaded.aggressiveProjection.hardBlockers).toEqual([]);
    expect(loaded.conservativeProjection.warnings).toContainEqual(
      expect.objectContaining({ code: "MINIMUM_SAVINGS_TARGET" }),
    );
    expect(loaded.aggressiveProjection.warnings).toEqual([]);
    expect(loaded.workspace.activity).toHaveLength(18);
    expect(
      loaded.workspace.activity.every(
        (event) => event.source === "demo-replay",
      ),
    ).toBe(true);
    expect(loaded.workspace.activity.at(-1)).toMatchObject({
      id: "activity-018",
      shadowId: loaded.aggressive.id,
      shadowRevision: 9,
    });
  });

  it("rejects persisted workspaces from before transition metadata existed", () => {
    const seed = createOrbitSeed();
    const legacy = JSON.parse(serializeWorkspace(seed)) as Record<
      string,
      unknown
    >;
    const catalog = legacy.catalog as Record<string, unknown>;
    delete catalog.planTransitions;

    expect(parseWorkspace(JSON.stringify(legacy))).toBeNull();
  });
});
