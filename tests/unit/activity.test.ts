import { describe, expect, it } from "vitest";
import {
  beginShadow,
  deterministicShadowIdFactory,
  removeShadowChange,
  stageSeatChange,
} from "@/application/shadow-service";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import type { Result } from "@/domain/model";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("deterministic application activity", () => {
  it("records one normalized success event for begin, stage, and remove", () => {
    const seed = createOrbitSeed();
    const begun = unwrap(
      beginShadow(seed, {
        name: "  Conservative  ",
        strategy: "conservative",
        source: "webmcp",
      }),
    );
    expect(begun.workspace.activity).toEqual([
      {
        id: "activity-001",
        source: "webmcp",
        commandName: "begin_shadow",
        arguments: {
          name: "Conservative",
          strategy: "conservative",
          intent: {
            minimumSavingsBasisPoints: 2_000,
            protectedTeamIds: ["team-engineering"],
            maximumContractPenaltyCents: 0,
          },
        },
        outcome: { ok: true },
        realityVersion: 1,
        shadowId: "shadow-001",
        shadowRevision: 0,
        occurredAt: "2026-08-28T12:00:00.000Z",
      },
    ]);

    const staged = unwrap(
      stageSeatChange(begun.workspace, {
        shadowId: begun.shadow.id,
        subscriptionId: "subscription-adobe",
        seatCount: 17,
        source: "webmcp",
      }),
    );
    expect(staged.workspace.activity[1]).toEqual({
      id: "activity-002",
      source: "webmcp",
      commandName: "stage_seat_change",
      arguments: {
        shadowId: "shadow-001",
        subscriptionId: "subscription-adobe",
        seatCount: 17,
      },
      outcome: { ok: true },
      realityVersion: 1,
      shadowId: "shadow-001",
      shadowRevision: 1,
      occurredAt: "2026-08-28T12:00:00.000Z",
    });

    const removed = unwrap(
      removeShadowChange(staged.workspace, {
        shadowId: staged.shadow.id,
        changeId: staged.change.id,
        source: "demo-replay",
      }),
    );
    expect(removed.workspace.activity[2]).toEqual({
      id: "activity-003",
      source: "demo-replay",
      commandName: "remove_shadow_change",
      arguments: { shadowId: "shadow-001", changeId: "change-001" },
      outcome: { ok: true },
      realityVersion: 1,
      shadowId: "shadow-001",
      shadowRevision: 2,
      occurredAt: "2026-08-28T12:00:00.000Z",
    });
    expect(removed.workspace.counters).toMatchObject({
      shadow: 1,
      change: 1,
      activity: 3,
    });
  });

  it("accepts an injected clock without consulting wall time", () => {
    const result = unwrap(
      beginShadow(
        createOrbitSeed(),
        { name: "Clocked" },
        deterministicShadowIdFactory,
        () => "2030-01-02T03:04:05.000Z",
      ),
    );

    expect(result.workspace.activity[0].occurredAt).toBe(
      "2030-01-02T03:04:05.000Z",
    );
  });

  it("leaves activity, counters, and workspace bytes unchanged on failure", () => {
    const seed = createOrbitSeed();
    const before = serializeWorkspace(seed);
    const failedBegin = beginShadow(seed, { name: " " });
    const failedStage = stageSeatChange(seed, {
      shadowId: "missing",
      subscriptionId: "subscription-adobe",
      seatCount: 17,
      source: "webmcp",
    });

    expect(failedBegin).toMatchObject({ ok: false });
    expect(failedStage).toMatchObject({ ok: false });
    expect(seed.activity).toEqual([]);
    expect(seed.counters.activity).toBe(0);
    expect(serializeWorkspace(seed)).toBe(before);
  });
});
