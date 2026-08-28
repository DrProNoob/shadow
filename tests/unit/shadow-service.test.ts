import { describe, expect, it } from "vitest";
import {
  beginShadow,
  removeShadowChange,
  stageSeatChange,
  type ShadowIdFactory,
} from "@/application/shadow-service";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import type { Result } from "@/domain/model";
import { projectShadow } from "@/domain/projection";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

describe("Shadow application service", () => {
  it("begins a current draft with deterministic defaults without mutating Reality", () => {
    const seed = createOrbitSeed();
    const before = serializeWorkspace(seed);
    const { workspace, shadow } = unwrap(
      beginShadow(seed, {
        name: "  Adobe cleanup  ",
        strategy: "conservative",
      }),
    );

    expect(serializeWorkspace(seed)).toBe(before);
    expect(shadow).toMatchObject({
      id: "shadow-001",
      name: "Adobe cleanup",
      strategy: "conservative",
      baseRealityVersion: 1,
      revision: 0,
      status: "draft",
      changes: [],
      intent: {
        minimumSavingsBasisPoints: 2_000,
        protectedTeamIds: ["team-engineering"],
        maximumContractPenaltyCents: 0,
      },
    });
    expect(workspace.counters.shadow).toBe(1);
    expect(workspace.reality).toEqual(seed.reality);

    const second = unwrap(beginShadow(workspace, { name: "Second future" }));
    expect(second.shadow.id).toBe("shadow-002");
  });

  it("supports injected deterministic IDs while validating names and intent", () => {
    const seed = createOrbitSeed();
    const ids: ShadowIdFactory = {
      shadowId: (sequence) => `test-shadow-${sequence}`,
      changeId: (sequence) => `test-change-${sequence}`,
    };
    const begun = unwrap(
      beginShadow(
        seed,
        {
          name: "Test future",
          intent: {
            minimumSavingsBasisPoints: 1_500,
            protectedTeamIds: ["team-marketing"],
            maximumContractPenaltyCents: 100_000,
          },
        },
        ids,
      ),
    );

    expect(begun.shadow.id).toBe("test-shadow-1");
    expect(begun.shadow.intent.minimumSavingsBasisPoints).toBe(1_500);
    expect(begun.shadow.intent.protectedTeamIds).toEqual([
      "team-engineering",
      "team-marketing",
    ]);
    expect(begun.shadow.intent.maximumContractPenaltyCents).toBe(0);
    expect(beginShadow(seed, { name: "  " })).toMatchObject({
      ok: false,
      error: { code: "INVALID_SHADOW_NAME" },
    });
    expect(
      beginShadow(seed, {
        name: "Bad intent",
        intent: { protectedTeamIds: ["team-that-does-not-exist"] },
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_INTENT" } });
  });

  it("stages the Adobe 63 to 17 future with exact projected impact and Proof", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(
      beginShadow(seed, { name: "Conservative", strategy: "conservative" }),
    );
    const beforeStage = serializeWorkspace(begun.workspace);
    const staged = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    );

    expect(serializeWorkspace(begun.workspace)).toBe(beforeStage);
    expect(staged.shadow).toMatchObject({ revision: 1, status: "draft" });
    expect(staged.change).toMatchObject({
      id: "change-001",
      actionType: "seat-count",
      previousValue: 63,
      proposedValue: 17,
    });
    expect(staged.workspace.reality).toEqual(seed.reality);

    const adobe =
      staged.projection.projectedReality.subscriptions["subscription-adobe"];
    const adobeAssignments =
      staged.projection.projectedReality.assignments.filter(
        (assignment) => assignment.subscriptionId === "subscription-adobe",
      );
    expect(adobe).toMatchObject({ seatCount: 17, monthlyCostCents: 136_000 });
    expect(adobeAssignments).toHaveLength(17);
    expect(
      adobeAssignments.every((assignment) => assignment.activeInLast90Days),
    ).toBe(true);
    expect(staged.projection.totalImpact).toEqual({
      monthlySavingsCents: 368_000,
      annualSavingsCents: 4_416_000,
      savingsBasisPoints: 200,
      contractPenaltyCents: 0,
      activeUsersAffected: 0,
      activeEngineeringUsersAffected: 0,
      risk: "low",
    });
    expect(staged.projection.projectedReality.monthlySoftwareCostCents).toBe(
      18_062_000,
    );
    expect(staged.projection.hardBlockers).toEqual([]);
    expect(staged.projection.warnings).toEqual([
      expect.objectContaining({
        code: "MINIMUM_SAVINGS_TARGET",
        passed: false,
      }),
    ]);

    const proof = staged.projection.proofs[0];
    const evidence = Object.fromEntries(
      proof.evidence.map((record) => [record.label, record.value]),
    );
    expect(evidence).toMatchObject({
      "Licensed seats": 63,
      "Active users in the last 90 days": 17,
      "Inactive licenses": 46,
      "Seat reduction terms": "monthly",
      "Monthly savings": 368_000,
      "Expected contractual penalty": 0,
    });
    expect(proof.transition).toEqual({
      before: { seatCount: 63, monthlyCostCents: 504_000 },
      after: { seatCount: 17, monthlyCostCents: 136_000 },
    });
    expect(proof.checks.every((check) => check.passed)).toBe(true);
  });

  it("re-stages the same kind in place and preserves the change ID and counter", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Editable" }));
    const first = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 20,
      }),
    );
    const beforeReplacement = serializeWorkspace(first.workspace);
    const replacement = unwrap(
      stageSeatChange(first.workspace, {
        shadowId: first.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
        source: "webmcp",
      }),
    );

    expect(serializeWorkspace(first.workspace)).toBe(beforeReplacement);
    expect(replacement.shadow.revision).toBe(2);
    expect(replacement.shadow.changes).toHaveLength(1);
    expect(replacement.change.id).toBe(first.change.id);
    expect(replacement.change.provenance.source).toBe("webmcp");
    expect(replacement.workspace.counters.change).toBe(1);
  });

  it("removes a staged change and restores the baseline projection", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Editable" }));
    const staged = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    );
    const beforeRemove = serializeWorkspace(staged.workspace);
    const removed = unwrap(
      removeShadowChange(staged.workspace, {
        shadowId: staged.shadow.id,
        changeId: staged.change.id,
      }),
    );

    expect(serializeWorkspace(staged.workspace)).toBe(beforeRemove);
    expect(removed.shadow.revision).toBe(2);
    expect(removed.shadow.changes).toEqual([]);
    expect(removed.projection.projectedReality).toMatchObject({
      kind: "shadow-projection",
      sourceRealityVersion: 1,
      subscriptions: seed.reality.subscriptions,
      assignments: seed.reality.assignments,
      monthlySoftwareCostCents: seed.reality.monthlySoftwareCostCents,
    });
    expect(removed.projection.totalImpact.monthlySavingsCents).toBe(0);
    expect(removed.workspace.counters.change).toBe(1);
  });

  it("allocates inactive seats before the eleven low-usage active Figma users", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(
      beginShadow(seed, { name: "Aggressive", strategy: "aggressive" }),
    );
    const staged = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-figma",
        seatCount: 51,
      }),
    );
    const removals = staged.projection.changes[0].removedAssignments;
    const activeRemovals = removals.filter(
      (removal) => removal.activeInLast90Days,
    );

    expect(removals).toHaveLength(40);
    expect(
      removals.slice(0, 29).every((removal) => removal.reason === "inactive"),
    ).toBe(true);
    expect(activeRemovals).toHaveLength(11);
    expect(activeRemovals.map((removal) => removal.personId)).toEqual(
      Array.from(
        { length: 11 },
        (_, index) => `person-marketing-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(staged.projection.totalImpact).toMatchObject({
      activeUsersAffected: 11,
      activeEngineeringUsersAffected: 0,
      risk: "medium",
    });
    expect(staged.projection.hardBlockers).toEqual([]);
  });

  it("keeps unsafe critical-service reductions stageable and inspectable", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Unsafe experiment" }));
    const staged = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-datadog",
        seatCount: 0,
      }),
    );
    const blockerCodes = staged.projection.hardBlockers.map(
      (check) => check.code,
    );

    expect(staged.projection.totalImpact).toMatchObject({
      activeUsersAffected: 96,
      activeEngineeringUsersAffected: 96,
      risk: "high",
    });
    expect(blockerCodes).toEqual(
      expect.arrayContaining([
        "SEAT_REDUCTION_WINDOW",
        "CONTRACT_SEAT_FLOOR",
        "PROTECTED_ACTIVE_USERS",
        "CRITICAL_SERVICE_CONTINUITY",
      ]),
    );
    expect(staged.workspace.shadows[begun.shadow.id].changes).toHaveLength(1);
  });

  it("rejects missing, committed, stale, invalid, and no-op edits without mutation", () => {
    const seed = createOrbitSeed();
    expect(
      stageSeatChange(seed, {
        shadowId: "missing",
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_NOT_FOUND" } });

    const begun = unwrap(beginShadow(seed, { name: "Guarded" }));
    expect(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: -1,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_SEAT_COUNT" } });
    expect(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 63,
      }),
    ).toMatchObject({ ok: false, error: { code: "NO_CHANGE" } });
    expect(
      removeShadowChange(begun.workspace, {
        shadowId: begun.shadow.id,
        changeId: "missing-change",
      }),
    ).toMatchObject({ ok: false, error: { code: "CHANGE_NOT_FOUND" } });

    const committedWorkspace = {
      ...begun.workspace,
      shadows: {
        ...begun.workspace.shadows,
        [begun.shadow.id]: { ...begun.shadow, status: "committed" as const },
      },
    };
    expect(
      stageSeatChange(committedWorkspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_NOT_DRAFT" } });

    const staleWorkspace = {
      ...begun.workspace,
      reality: { ...begun.workspace.reality, version: 2 },
    };
    expect(
      stageSeatChange(staleWorkspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_STALE" } });
  });

  it("projects purely and rejects a stale Shadow", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Pure projection" }));
    const staged = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    );
    const realityBefore = JSON.stringify(seed.reality);
    const shadowBefore = JSON.stringify(staged.shadow);
    const projected = projectShadow(seed.reality, staged.shadow, seed.catalog);

    expect(projected.ok).toBe(true);
    expect(JSON.stringify(seed.reality)).toBe(realityBefore);
    expect(JSON.stringify(staged.shadow)).toBe(shadowBefore);

    const staleShadow = { ...staged.shadow, baseRealityVersion: 0 };
    expect(
      projectShadow(seed.reality, staleShadow, seed.catalog),
    ).toMatchObject({
      ok: false,
      error: { code: "SHADOW_STALE" },
    });
  });
});
