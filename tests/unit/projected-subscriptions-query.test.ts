import { describe, expect, it } from "vitest";
import { loadExampleFutures } from "@/application/named-futures";
import { listProjectedSubscriptions } from "@/application/queries";
import {
  copyChangeBetweenShadows,
  forkShadow,
} from "@/application/shadow-service";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import type { Result } from "@/domain/model";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function monthlySavings(rows: ReturnType<typeof listProjectedSubscriptions>) {
  return rows.reduce(
    (total, subscription) => total + subscription.monthlySavingsCents,
    0,
  );
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
  return { loaded, copied };
}

describe("listProjectedSubscriptions", () => {
  it("renders Conservative as ten stable what-is/what-could-be business rows", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const workspaceBefore = serializeWorkspace(loaded.workspace);
    const projectionBefore = JSON.stringify(loaded.conservativeProjection);
    const rows = listProjectedSubscriptions(
      loaded.workspace,
      loaded.conservativeProjection,
    );

    expect(serializeWorkspace(loaded.workspace)).toBe(workspaceBefore);
    expect(JSON.stringify(loaded.conservativeProjection)).toBe(
      projectionBefore,
    );
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.productName)).toEqual([
      "Datadog",
      "Atlassian",
      "Figma",
      "Notion",
      "Zoom",
      "Slack",
      "Miro",
      "Grammarly",
      "Loom",
      "Adobe",
    ]);
    expect(rows.filter((row) => row.changed)).toHaveLength(7);
    expect(rows.flatMap((row) => row.changeKinds)).toHaveLength(7);
    expect(monthlySavings(rows)).toBe(3_029_000);
    expect(
      rows.reduce(
        (total, subscription) => total + subscription.annualSavingsCents,
        0,
      ),
    ).toBe(36_348_000);

    const adobe = rows.find((row) => row.productName === "Adobe");
    expect(adobe).toMatchObject({
      changed: true,
      changeKinds: ["seat-count"],
      monthlySavingsCents: 368_000,
      baseline: {
        planName: "Enterprise",
        seatCount: 63,
        assignedCount: 63,
        activeUsers90d: 17,
        inactiveUsers90d: 46,
        monthlyCostCents: 504_000,
        status: "active",
      },
      projected: {
        planName: "Enterprise",
        seatCount: 17,
        assignedCount: 17,
        activeUsers90d: 17,
        inactiveUsers90d: 0,
        monthlyCostCents: 136_000,
        status: "active",
      },
    });
    const notion = rows.find((row) => row.productName === "Notion");
    expect(notion).toMatchObject({
      changeKinds: ["plan"],
      monthlySavingsCents: 547_500,
      baseline: { planName: "Enterprise", seatCount: 240 },
      projected: {
        planName: "Business",
        seatCount: 240,
        monthlyCostCents: 1_372_500,
      },
    });
    const loom = rows.find((row) => row.productName === "Loom");
    expect(loom).toMatchObject({
      changeKinds: ["cancellation"],
      monthlySavingsCents: 901_000,
      baseline: { status: "active", seatCount: 170 },
      projected: {
        status: "cancelled",
        seatCount: 0,
        assignedCount: 0,
        monthlyCostCents: 0,
      },
    });
  });

  it("shows Aggressive's two-operation Notion change and eleven-user Figma tradeoff", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const rows = listProjectedSubscriptions(
      loaded.workspace,
      loaded.aggressiveProjection,
    );

    expect(monthlySavings(rows)).toBe(4_148_000);
    expect(rows.filter((row) => row.changed)).toHaveLength(8);
    expect(rows.flatMap((row) => row.changeKinds)).toHaveLength(9);
    const figma = rows.find((row) => row.productName === "Figma");
    expect(figma).toMatchObject({
      changeKinds: ["seat-count"],
      monthlySavingsCents: 1_060_000,
      annualSavingsCents: 12_720_000,
      baseline: {
        seatCount: 91,
        assignedCount: 91,
        activeUsers90d: 62,
        monthlyCostCents: 2_411_500,
      },
      projected: {
        seatCount: 51,
        assignedCount: 51,
        activeUsers90d: 51,
        monthlyCostCents: 1_351_500,
      },
    });
    const notion = rows.find((row) => row.productName === "Notion");
    expect(notion).toMatchObject({
      changeKinds: ["plan", "seat-count"],
      monthlySavingsCents: 710_000,
      baseline: {
        planName: "Enterprise",
        seatCount: 240,
        monthlyCostCents: 1_920_000,
      },
      projected: {
        planName: "Business",
        seatCount: 175,
        monthlyCostCents: 1_210_000,
      },
    });
  });

  it("renders Hybrid as Conservative plus only Aggressive Figma without touching Reality", () => {
    const seedReality = createOrbitSeed().reality;
    const { loaded, copied } = createHybrid();
    const workspaceBefore = serializeWorkspace(copied.workspace);
    const projectionBefore = JSON.stringify(copied.projection);
    const conservativeRows = listProjectedSubscriptions(
      copied.workspace,
      loaded.conservativeProjection,
    );
    const hybridRows = listProjectedSubscriptions(
      copied.workspace,
      copied.projection,
    );

    expect(monthlySavings(hybridRows)).toBe(3_691_500);
    expect(
      hybridRows.reduce(
        (total, subscription) => total + subscription.annualSavingsCents,
        0,
      ),
    ).toBe(44_298_000);
    expect(hybridRows.filter((row) => row.changed)).toHaveLength(7);
    expect(hybridRows.flatMap((row) => row.changeKinds)).toHaveLength(7);
    expect(hybridRows.find((row) => row.productName === "Figma")).toMatchObject(
      {
        monthlySavingsCents: 1_060_000,
        projected: {
          seatCount: 51,
          activeUsers90d: 51,
          monthlyCostCents: 1_351_500,
        },
      },
    );

    for (const hybridRow of hybridRows.filter(
      (row) => row.productName !== "Figma",
    )) {
      const conservativeRow = conservativeRows.find(
        (row) => row.id === hybridRow.id,
      );
      expect(hybridRow.projected).toEqual(conservativeRow?.projected);
      expect(hybridRow.monthlySavingsCents).toBe(
        conservativeRow?.monthlySavingsCents,
      );
    }
    expect(copied.workspace.reality).toEqual(seedReality);
    expect(serializeWorkspace(copied.workspace)).toBe(workspaceBefore);
    expect(JSON.stringify(copied.projection)).toBe(projectionBefore);
  });

  it("refuses to pair a stale projection with a newer Reality baseline", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const staleWorkspace = {
      ...loaded.workspace,
      reality: { ...loaded.workspace.reality, version: 2 },
    };

    expect(() =>
      listProjectedSubscriptions(staleWorkspace, loaded.conservativeProjection),
    ).toThrow("not based on current Reality v2");
  });
});
