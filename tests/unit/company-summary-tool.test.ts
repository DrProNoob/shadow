import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import { createFoundationTools } from "@/webmcp/tool-catalog";

describe("get_company_summary", () => {
  it("reads the exact state visible to the application", async () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const [tool] = createFoundationTools(store);
    const result = await tool.execute(
      {},
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        companyName: "ORBIT",
        monthlySoftwareCostCents: 18_430_000,
      },
      realityVersion: 1,
    });
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });
});
