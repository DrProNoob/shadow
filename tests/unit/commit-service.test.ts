import { describe, expect, it } from "vitest";
import {
  commitShadow,
  UI_COMMIT_CONFIRMATION,
} from "@/application/commit-service";
import { loadExampleFutures } from "@/application/named-futures";
import {
  beginShadow,
  copyChangeBetweenShadows,
  forkShadow,
  stageCancellation,
} from "@/application/shadow-service";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import type { Result } from "@/domain/model";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function createHybrid() {
  const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
  const forked = unwrap(
    forkShadow(loaded.workspace, {
      sourceShadowId: loaded.conservative.id,
      name: "Hybrid",
      strategy: "custom",
      source: "demo-replay",
    }),
  );
  const aggressiveFigma = loaded.aggressive.changes.find(
    (change) =>
      change.actionType === "seat-count" &&
      change.subscriptionId === "subscription-figma",
  );
  if (!aggressiveFigma) throw new Error("Aggressive Figma change missing");
  const copied = unwrap(
    copyChangeBetweenShadows(forked.workspace, {
      sourceShadowId: loaded.aggressive.id,
      targetShadowId: forked.shadow.id,
      changeId: aggressiveFigma.id,
      source: "demo-replay",
    }),
  );
  return { loaded, hybrid: copied };
}

describe("commitShadow", () => {
  it("commits Aggressive atomically into Reality v2 and records a UI-only receipt activity", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const before = serializeWorkspace(loaded.workspace);
    const committed = unwrap(
      commitShadow(loaded.workspace, {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    );

    expect(serializeWorkspace(loaded.workspace)).toBe(before);
    expect(committed.reality).toMatchObject({
      version: 2,
      monthlySoftwareCostCents: 14_282_000,
    });
    expect(committed.workspace.reality).toEqual(committed.reality);
    expect(committed.shadow.status).toBe("committed");
    expect(committed.workspace.shadows[loaded.conservative.id].status).toBe(
      "draft",
    );
    expect(committed.workspace.counters.receipt).toBe(1);
    expect(committed.receipt).toMatchObject({
      id: "receipt-001",
      receiptVersion: 1,
      shadowId: loaded.aggressive.id,
      realityVersionBefore: 1,
      realityVersionAfter: 2,
      committedAt: "2026-08-28T12:00:00.000Z",
      totalImpact: {
        monthlySavingsCents: 4_148_000,
        annualSavingsCents: 49_776_000,
        savingsBasisPoints: 2_251,
      },
    });
    expect(committed.workspace.activity.at(-1)).toMatchObject({
      id: "activity-019",
      source: "ui",
      commandName: "commit_shadow",
      realityVersion: 2,
      shadowId: loaded.aggressive.id,
      shadowRevision: 9,
      occurredAt: "2026-08-28T12:00:00.000Z",
      arguments: {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
        acknowledgeWarnings: false,
        receiptId: "receipt-001",
      },
    });
  });

  it("commits the exact Hybrid projection", () => {
    const { hybrid } = createHybrid();
    const committed = unwrap(
      commitShadow(hybrid.workspace, {
        shadowId: hybrid.targetShadow.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    );

    expect(committed.reality).toMatchObject({
      version: 2,
      monthlySoftwareCostCents: 14_738_500,
    });
    expect(committed.receipt.totalImpact).toEqual({
      monthlySavingsCents: 3_691_500,
      annualSavingsCents: 44_298_000,
      savingsBasisPoints: 2_003,
      contractPenaltyCents: 0,
      activeUsersAffected: 11,
      activeEngineeringUsersAffected: 0,
      risk: "medium",
    });
    expect(committed.receipt.appliedChanges).toHaveLength(7);
    expect(
      committed.reality.subscriptions["subscription-figma"].seatCount,
    ).toBe(51);
  });

  it("requires acknowledgement for Conservative's advisory savings warning", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const before = serializeWorkspace(loaded.workspace);
    const unacknowledged = commitShadow(loaded.workspace, {
      shadowId: loaded.conservative.id,
      confirmation: UI_COMMIT_CONFIRMATION,
    });

    expect(unacknowledged).toMatchObject({
      ok: false,
      error: {
        code: "WARNING_ACKNOWLEDGEMENT_REQUIRED",
        retryable: true,
        details: { warningCodes: ["MINIMUM_SAVINGS_TARGET"] },
      },
    });
    expect(serializeWorkspace(loaded.workspace)).toBe(before);

    const committed = unwrap(
      commitShadow(loaded.workspace, {
        shadowId: loaded.conservative.id,
        confirmation: UI_COMMIT_CONFIRMATION,
        acknowledgeWarnings: true,
      }),
    );
    expect(committed.reality.monthlySoftwareCostCents).toBe(15_401_000);
    expect(committed.receipt.totalImpact).toEqual(
      loaded.conservativeProjection.totalImpact,
    );
  });

  it.each([
    ["subscription-miro", "CONTRACT_PENALTY_LIMIT"],
    ["subscription-datadog", "CRITICAL_SERVICE_CONTINUITY"],
  ])(
    "does not allow acknowledgement to override %s hard blockers",
    (subscriptionId, expectedCode) => {
      const begun = unwrap(
        beginShadow(createOrbitSeed(), { name: "Unsafe future" }),
      );
      const staged = unwrap(
        stageCancellation(begun.workspace, {
          shadowId: begun.shadow.id,
          subscriptionId,
        }),
      );
      const before = serializeWorkspace(staged.workspace);
      const result = commitShadow(staged.workspace, {
        shadowId: staged.shadow.id,
        confirmation: UI_COMMIT_CONFIRMATION,
        acknowledgeWarnings: true,
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "COMMIT_BLOCKED",
          retryable: true,
          details: { blockerCodes: expect.arrayContaining([expectedCode]) },
        },
      });
      expect(serializeWorkspace(staged.workspace)).toBe(before);
    },
  );

  it("freezes exact operation and Proof snapshots in the receipt", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const committed = unwrap(
      commitShadow(loaded.workspace, {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    );

    expect(committed.receipt.totalImpact).toEqual(
      committed.projection.totalImpact,
    );
    expect(committed.receipt.proofs).toEqual(committed.projection.proofs);
    expect(committed.receipt.appliedChanges).toEqual(
      committed.projection.changes.map((change) => ({
        change: change.change,
        proof: change.proof,
      })),
    );
    expect(committed.receipt.proofs[0]).not.toBe(
      committed.projection.proofs[0],
    );
    expect(committed.receipt.appliedChanges[0].change).not.toBe(
      committed.projection.changes[0].change,
    );
    expect(committed.workspace.receipts[committed.receipt.id]).toEqual(
      committed.receipt,
    );
  });

  it("rejects missing UI confirmation and empty Shadows without mutation", () => {
    const begun = unwrap(beginShadow(createOrbitSeed(), { name: "Empty" }));
    const before = serializeWorkspace(begun.workspace);
    const invalidConfirmation = commitShadow(begun.workspace, {
      shadowId: begun.shadow.id,
      confirmation: "not-ui-confirmed" as typeof UI_COMMIT_CONFIRMATION,
    });
    expect(invalidConfirmation).toMatchObject({
      ok: false,
      error: { code: "COMMIT_CONFIRMATION_REQUIRED" },
    });
    expect(
      commitShadow(begun.workspace, {
        shadowId: begun.shadow.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    ).toMatchObject({ ok: false, error: { code: "EMPTY_SHADOW" } });
    expect(serializeWorkspace(begun.workspace)).toBe(before);
  });

  it("rejects double commit and derives staleness for every other version-1 Shadow", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const committed = unwrap(
      commitShadow(loaded.workspace, {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    );
    const beforeRetry = serializeWorkspace(committed.workspace);

    expect(
      commitShadow(committed.workspace, {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_NOT_DRAFT" } });
    expect(
      commitShadow(committed.workspace, {
        shadowId: loaded.conservative.id,
        confirmation: UI_COMMIT_CONFIRMATION,
        acknowledgeWarnings: true,
      }),
    ).toMatchObject({ ok: false, error: { code: "SHADOW_STALE" } });
    expect(serializeWorkspace(committed.workspace)).toBe(beforeRetry);
    expect(committed.workspace.reality.version).toBe(2);
    expect(committed.workspace.counters.receipt).toBe(1);
  });
});
