import { describe, expect, it } from "vitest";
import type { WorkspaceStore } from "@/application/workspace-store";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import { createWebMcpTools, type ToolEnvelope } from "@/webmcp/tool-catalog";

function toolsFor(store: WorkspaceStore) {
  return new Map(createWebMcpTools(store).map((tool) => [tool.name, tool]));
}

function requiredTool(
  tools: Map<string, WebMCP.ModelContextTool>,
  name: string,
) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

async function execute<T>(
  tool: WebMCP.ModelContextTool,
  input: unknown,
): Promise<ToolEnvelope<T>> {
  return (await tool.execute(input as Record<string, unknown>, {
    signal: new AbortController().signal,
  })) as ToolEnvelope<T>;
}

async function beginTestShadow(
  store: WorkspaceStore,
  tools: Map<string, WebMCP.ModelContextTool>,
) {
  const result = await execute<{ shadowId: string }>(
    requiredTool(tools, "begin_shadow"),
    { name: "Slice 5 future" },
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.shadowId;
}

describe("Slice 5 WebMCP mutation tools", () => {
  it("stages the approved Notion plan transition with WebMCP provenance", async () => {
    const seed = createOrbitSeed();
    const store = createWorkspaceStore(seed, new InMemoryWorkspaceRepository());
    const tools = toolsFor(store);
    const shadowId = await beginTestShadow(store, tools);
    const beforeInvalid = serializeWorkspace(store.getSnapshot().workspace);

    await expect(
      execute(requiredTool(tools, "stage_plan_change"), {
        shadowId,
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
        source: "ui",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENTS" },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeInvalid,
    );

    const result = await execute<{
      change: { actionType: string; from: string; to: string };
      impact: { monthlySavingsCents: number; risk: string };
      blockers: Array<{ code: string }>;
    }>(requiredTool(tools, "stage_plan_change"), {
      shadowId,
      subscriptionId: "subscription-notion",
      planId: "plan-notion-business",
    });

    expect(result).toMatchObject({
      ok: true,
      realityVersion: 1,
      shadowRevision: 1,
      data: {
        change: {
          actionType: "plan",
          from: "plan-notion-enterprise",
          to: "plan-notion-business",
        },
        impact: { monthlySavingsCents: 547_500, risk: "low" },
        blockers: [],
      },
    });
    expect(JSON.stringify(result).length).toBeLessThan(1_800);
    expect(store.getSnapshot().workspace.reality).toEqual(seed.reality);
    expect(
      store.getSnapshot().workspace.shadows[shadowId].changes[0].provenance,
    ).toMatchObject({ source: "webmcp", commandName: "stage_plan_change" });
    expect(store.getSnapshot().workspace.activity.at(-1)).toMatchObject({
      source: "webmcp",
      commandName: "stage_plan_change",
    });
  });

  it("returns semantic plan errors without changing the workspace", async () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const tools = toolsFor(store);
    const shadowId = await beginTestShadow(store, tools);
    const before = serializeWorkspace(store.getSnapshot().workspace);

    await expect(
      execute(requiredTool(tools, "stage_plan_change"), {
        shadowId,
        subscriptionId: "subscription-notion",
        planId: "plan-adobe-enterprise",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "PLAN_PRODUCT_MISMATCH", retryable: true },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(before);
  });

  it("persists an unsafe Miro cancellation as an inspectable blocked future", async () => {
    const seed = createOrbitSeed();
    const store = createWorkspaceStore(seed, new InMemoryWorkspaceRepository());
    const tools = toolsFor(store);
    const shadowId = await beginTestShadow(store, tools);
    const beforeInvalid = serializeWorkspace(store.getSnapshot().workspace);

    await expect(
      execute(requiredTool(tools, "stage_cancellation"), {
        shadowId,
        subscriptionId: "subscription-miro",
        force: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENTS" },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeInvalid,
    );

    const result = await execute<{
      change: { actionType: string; to: string };
      impact: {
        monthlySavingsCents: number;
        contractPenaltyCents: number;
        risk: string;
      };
      blockers: Array<{ code: string }>;
    }>(requiredTool(tools, "stage_cancellation"), {
      shadowId,
      subscriptionId: "subscription-miro",
    });

    expect(result).toMatchObject({
      ok: true,
      realityVersion: 1,
      shadowRevision: 1,
      data: {
        change: { actionType: "cancellation", to: "cancelled" },
        impact: {
          monthlySavingsCents: 1_080_000,
          contractPenaltyCents: 2_500_000,
          risk: "high",
        },
      },
    });
    expect(JSON.stringify(result).length).toBeLessThan(1_800);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.blockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["CANCELLATION_NOTICE", "CONTRACT_PENALTY_LIMIT"]),
    );
    expect(store.getSnapshot().workspace.reality).toEqual(seed.reality);
    expect(
      store.getSnapshot().workspace.shadows[shadowId].changes[0].provenance,
    ).toMatchObject({ source: "webmcp", commandName: "stage_cancellation" });
    expect(store.getSnapshot().workspace.activity.at(-1)).toMatchObject({
      source: "webmcp",
      commandName: "stage_cancellation",
    });
  });
});
