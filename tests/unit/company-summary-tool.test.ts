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

  it.each([
    ["missing execution options", undefined],
    ["missing cancellation signal", {}],
  ])("supports WebMCP hosts with %s", async (_case, options) => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const [tool] = createFoundationTools(store);
    const execute = tool.execute as (
      input: Record<string, unknown>,
      options?: Partial<WebMCP.ToolExecuteCallbackOptions>,
    ) => WebMCP.MaybePromise<unknown>;

    const execution =
      options === undefined ? execute({}) : execute({}, options);

    await expect(execution).resolves.toMatchObject({
      ok: true,
      data: { companyName: "ORBIT" },
      realityVersion: 1,
    });
  });

  it("honors a cancellation signal when the host provides one", async () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const [tool] = createFoundationTools(store);
    const controller = new AbortController();
    controller.abort();

    await expect(
      tool.execute({}, { signal: controller.signal }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "TOOL_ABORTED", retryable: true },
    });
  });
});
