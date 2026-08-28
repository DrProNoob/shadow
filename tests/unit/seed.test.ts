import { describe, expect, it } from "vitest";
import { getCompanySummary } from "@/application/queries";
import {
  createOrbitSeed,
  parseWorkspace,
  serializeWorkspace,
} from "@/data/orbit/seed";

describe("ORBIT seed", () => {
  it("is deterministic and exposes the approved baseline", () => {
    const first = createOrbitSeed();
    const second = createOrbitSeed();

    expect(serializeWorkspace(first)).toBe(serializeWorkspace(second));
    expect(getCompanySummary(first)).toMatchObject({
      companyName: "ORBIT",
      employeeCount: 312,
      subscriptionCount: 10,
      monthlySoftwareCostCents: 18_430_000,
      realityVersion: 1,
    });
  });

  it("fails closed when persisted mutable or catalog state is malformed", () => {
    const seed = createOrbitSeed();
    expect(parseWorkspace(serializeWorkspace(seed))).toEqual(seed);
    expect(parseWorkspace("not-json")).toBeNull();

    const cases = [
      { ...seed, counters: undefined },
      { ...seed, shadows: [] },
      { ...seed, receipts: { broken: {} } },
      { ...seed, activity: [{}] },
      {
        ...seed,
        catalog: { ...seed.catalog, plans: {} },
      },
      {
        ...seed,
        reality: { ...seed.reality, monthlySoftwareCostCents: 1 },
      },
      {
        ...seed,
        reality: {
          ...seed.reality,
          assignments: [
            ...seed.reality.assignments,
            { ...seed.reality.assignments[0] },
          ],
        },
      },
    ];

    for (const candidate of cases) {
      expect(parseWorkspace(JSON.stringify(candidate))).toBeNull();
    }
  });
});
