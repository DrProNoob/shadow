import { describe, expect, it } from "vitest";
import { compareShadows } from "@/application/shadow-comparison";
import { loadExampleFutures } from "@/application/named-futures";
import {
  beginShadow,
  copyChangeBetweenShadows,
  forkShadow,
  stageCancellation,
  stageSeatChange,
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

describe("forkShadow", () => {
  it("creates an independent, deterministic snapshot with new operation IDs", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const before = serializeWorkspace(loaded.workspace);
    const forked = unwrap(
      forkShadow(loaded.workspace, {
        sourceShadowId: loaded.conservative.id,
        name: "Hybrid",
        strategy: "custom",
        source: "demo-replay",
      }),
    );

    expect(serializeWorkspace(loaded.workspace)).toBe(before);
    expect(forked.shadow).toMatchObject({
      id: "shadow-003",
      name: "Hybrid",
      strategy: "custom",
      parentShadowId: loaded.conservative.id,
      baseRealityVersion: 1,
      revision: 0,
      status: "draft",
    });
    expect(forked.shadow.changes).toHaveLength(7);
    expect(forked.shadow.changes.map((change) => change.id)).toEqual([
      "change-017",
      "change-018",
      "change-019",
      "change-020",
      "change-021",
      "change-022",
      "change-023",
    ]);
    expect(
      new Set(forked.shadow.changes.map((change) => change.id)),
    ).not.toEqual(
      new Set(loaded.conservative.changes.map((change) => change.id)),
    );
    expect(
      forked.shadow.changes.every(
        (change) =>
          change.provenance.commandName === "fork_shadow" &&
          change.provenance.source === "demo-replay" &&
          loaded.conservative.changes.some(
            (parentChange) =>
              parentChange.id === change.provenance.copiedFromChangeId,
          ),
      ),
    ).toBe(true);
    expect(forked.projection.totalImpact).toEqual(
      loaded.conservativeProjection.totalImpact,
    );
    expect(forked.workspace.activity.at(-1)).toMatchObject({
      id: "activity-019",
      source: "demo-replay",
      commandName: "fork_shadow",
      shadowId: "shadow-003",
      shadowRevision: 0,
      arguments: {
        sourceShadowId: loaded.conservative.id,
        name: "Hybrid",
        strategy: "custom",
        clonedChangeCount: 7,
      },
    });
    expect(forked.workspace.reality).toEqual(loaded.workspace.reality);
  });

  it("does not inherit later parent edits", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const forked = unwrap(
      forkShadow(loaded.workspace, {
        sourceShadowId: loaded.conservative.id,
        name: "Independent child",
      }),
    );
    const editedParent = unwrap(
      stageSeatChange(forked.workspace, {
        shadowId: loaded.conservative.id,
        subscriptionId: "subscription-adobe",
        seatCount: 20,
      }),
    );
    const child = editedParent.workspace.shadows[forked.shadow.id];
    const childProjection = unwrap(
      projectShadow(
        editedParent.workspace.reality,
        child,
        editedParent.workspace.catalog,
      ),
    );

    expect(
      editedParent.shadow.changes.find(
        (change) => change.subscriptionId === "subscription-adobe",
      ),
    ).toMatchObject({ proposedValue: 20 });
    expect(
      child.changes.find(
        (change) => change.subscriptionId === "subscription-adobe",
      ),
    ).toMatchObject({ proposedValue: 17 });
    expect(
      childProjection.projectedReality.subscriptions["subscription-adobe"],
    ).toMatchObject({ seatCount: 17 });
  });

  it("rejects committed and stale parents", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(beginShadow(seed, { name: "Parent" }));
    const committedWorkspace = {
      ...begun.workspace,
      shadows: {
        ...begun.workspace.shadows,
        [begun.shadow.id]: { ...begun.shadow, status: "committed" as const },
      },
    };
    expect(
      forkShadow(committedWorkspace, {
        sourceShadowId: begun.shadow.id,
        name: "Child",
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_NOT_DRAFT" } });
    const staleWorkspace = {
      ...begun.workspace,
      reality: { ...begun.workspace.reality, version: 2 },
    };
    expect(
      forkShadow(staleWorkspace, {
        sourceShadowId: begun.shadow.id,
        name: "Child",
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_STALE" } });
  });
});

describe("copyChangeBetweenShadows", () => {
  it("creates the exact Hybrid by replacing Conservative Figma with Aggressive Figma", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const forked = unwrap(
      forkShadow(loaded.workspace, {
        sourceShadowId: loaded.conservative.id,
        name: "Hybrid",
        source: "demo-replay",
      }),
    );
    const aggressiveFigma = loaded.aggressive.changes.find(
      (change) =>
        change.subscriptionId === "subscription-figma" &&
        change.actionType === "seat-count",
    );
    if (!aggressiveFigma) throw new Error("Aggressive Figma change missing");
    const targetFigmaBefore = forked.shadow.changes.find(
      (change) =>
        change.subscriptionId === "subscription-figma" &&
        change.actionType === "seat-count",
    );
    if (!targetFigmaBefore) throw new Error("Target Figma change missing");
    const before = serializeWorkspace(forked.workspace);
    const copied = unwrap(
      copyChangeBetweenShadows(forked.workspace, {
        sourceShadowId: loaded.aggressive.id,
        targetShadowId: forked.shadow.id,
        changeId: aggressiveFigma.id,
        source: "demo-replay",
      }),
    );

    expect(serializeWorkspace(forked.workspace)).toBe(before);
    expect(copied.targetShadow.changes).toHaveLength(7);
    expect(copied.change).toMatchObject({
      id: targetFigmaBefore.id,
      shadowId: forked.shadow.id,
      subscriptionId: "subscription-figma",
      actionType: "seat-count",
      previousValue: 91,
      proposedValue: 51,
      provenance: {
        source: "demo-replay",
        commandName: "copy_change_between_shadows",
        copiedFromChangeId: aggressiveFigma.id,
      },
    });
    expect(copied.workspace.counters.change).toBe(23);
    expect(copied.targetShadow.revision).toBe(1);
    expect(copied.projection.totalImpact).toEqual({
      monthlySavingsCents: 3_691_500,
      annualSavingsCents: 44_298_000,
      savingsBasisPoints: 2_003,
      contractPenaltyCents: 0,
      activeUsersAffected: 11,
      activeEngineeringUsersAffected: 0,
      risk: "medium",
    });
    expect(copied.projection.changes).toHaveLength(7);
    expect(copied.projection.hardBlockers).toEqual([]);
    expect(copied.workspace.reality).toEqual(loaded.workspace.reality);
    expect(copied.workspace.activity.at(-1)).toMatchObject({
      id: "activity-020",
      source: "demo-replay",
      commandName: "copy_change_between_shadows",
      shadowId: forked.shadow.id,
      shadowRevision: 1,
    });
  });

  it("recalculates copied Proof against the target intent", () => {
    const seed = createOrbitSeed();
    const source = unwrap(beginShadow(seed, { name: "Source" }));
    const withAdobe = unwrap(
      stageSeatChange(source.workspace, {
        shadowId: source.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      }),
    );
    const target = unwrap(
      beginShadow(withAdobe.workspace, {
        name: "Target",
        intent: { minimumSavingsBasisPoints: 100 },
      }),
    );
    const copied = unwrap(
      copyChangeBetweenShadows(target.workspace, {
        sourceShadowId: source.shadow.id,
        targetShadowId: target.shadow.id,
        changeId: withAdobe.change.id,
        source: "webmcp",
      }),
    );

    expect(copied.change.id).toBe("change-002");
    expect(copied.projection.proofs[0].intent.minimumSavingsBasisPoints).toBe(
      100,
    );
    expect(copied.projection.warnings).toEqual([]);
  });

  it("returns explicit cancellation conflict resolution in both directions", () => {
    const seed = createOrbitSeed();
    const cancellationSource = unwrap(
      beginShadow(seed, { name: "Cancellation source" }),
    );
    const withCancellation = unwrap(
      stageCancellation(cancellationSource.workspace, {
        shadowId: cancellationSource.shadow.id,
        subscriptionId: "subscription-loom",
      }),
    );
    const seatSource = unwrap(
      beginShadow(withCancellation.workspace, { name: "Seat source" }),
    );
    const withSeat = unwrap(
      stageSeatChange(seatSource.workspace, {
        shadowId: seatSource.shadow.id,
        subscriptionId: "subscription-loom",
        seatCount: 100,
      }),
    );

    const cancellationIntoSeat = copyChangeBetweenShadows(withSeat.workspace, {
      sourceShadowId: cancellationSource.shadow.id,
      targetShadowId: seatSource.shadow.id,
      changeId: withCancellation.change.id,
    });
    expect(cancellationIntoSeat).toMatchObject({
      ok: false,
      error: {
        code: "CHANGE_CONFLICT",
        retryable: true,
        details: {
          conflictingChangeIds: [withSeat.change.id],
          resolution: "Remove the listed target changes, then retry the copy.",
        },
      },
    });
    if (!cancellationIntoSeat.ok) {
      expect(cancellationIntoSeat.error.message).toContain(
        "Remove conflicting",
      );
    }

    const seatIntoCancellation = copyChangeBetweenShadows(withSeat.workspace, {
      sourceShadowId: seatSource.shadow.id,
      targetShadowId: cancellationSource.shadow.id,
      changeId: withSeat.change.id,
    });
    expect(seatIntoCancellation).toMatchObject({
      ok: false,
      error: {
        code: "CHANGE_CONFLICT",
        details: { conflictingChangeIds: [withCancellation.change.id] },
      },
    });
  });
});

describe("compareShadows", () => {
  it("returns a stable aligned comparison without mutating the workspace", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const before = serializeWorkspace(loaded.workspace);
    const comparison = unwrap(
      compareShadows(
        loaded.workspace,
        loaded.conservative.id,
        loaded.aggressive.id,
      ),
    );

    expect(serializeWorkspace(loaded.workspace)).toBe(before);
    expect(comparison.realityVersion).toBe(1);
    expect(comparison.left).toMatchObject({
      name: "Conservative",
      changeCount: 7,
      impact: loaded.conservativeProjection.totalImpact,
    });
    expect(comparison.right).toMatchObject({
      name: "Aggressive",
      changeCount: 9,
      impact: loaded.aggressiveProjection.totalImpact,
    });
    expect(comparison.rows.map((row) => row.productName)).toEqual([
      "Adobe",
      "Figma",
      "Grammarly",
      "Loom",
      "Miro",
      "Notion",
      "Slack",
      "Zoom",
    ]);
    expect(
      comparison.rows.find((row) => row.productName === "Adobe"),
    ).toMatchObject({ differenceKinds: [] });
    expect(
      comparison.rows.find((row) => row.productName === "Figma"),
    ).toMatchObject({
      reality: { seatCount: 91, changed: false },
      left: { seatCount: 76, changed: true },
      right: { seatCount: 51, changed: true },
      differenceKinds: ["seats", "monthly-cost"],
    });
    expect(
      comparison.rows.find((row) => row.productName === "Miro"),
    ).toMatchObject({
      left: { changed: false, seatCount: 180 },
      right: { changed: true, seatCount: 141 },
    });
  });

  it("rejects comparing a Shadow to itself or any stale Shadow", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    expect(
      compareShadows(
        loaded.workspace,
        loaded.conservative.id,
        loaded.conservative.id,
      ),
    ).toMatchObject({ ok: false, error: { code: "CHANGE_CONFLICT" } });
    const staleWorkspace = {
      ...loaded.workspace,
      reality: { ...loaded.workspace.reality, version: 2 },
    };
    expect(
      compareShadows(
        staleWorkspace,
        loaded.conservative.id,
        loaded.aggressive.id,
      ),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_STALE" } });
  });
});
