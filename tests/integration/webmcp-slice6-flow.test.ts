import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import {
  createWebMcpTools,
  type ToolEnvelope,
  type WebMcpMutationEvent,
} from "@/webmcp/tool-catalog";

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

async function beginShadow(
  tools: Map<string, WebMCP.ModelContextTool>,
  name: string,
) {
  const result = await execute<{ shadowId: string }>(
    requiredTool(tools, "begin_shadow"),
    { name },
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.shadowId;
}

async function stageFigma(
  tools: Map<string, WebMCP.ModelContextTool>,
  shadowId: string,
  seatCount: number,
) {
  const result = await execute<{ change: { changeId: string } }>(
    requiredTool(tools, "stage_seat_change"),
    { shadowId, subscriptionId: "subscription-figma", seatCount },
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.change.changeId;
}

describe("Slice 6 WebMCP branching and comparison", () => {
  it("forks an independent child and selects it after durable persistence", async () => {
    const seed = createOrbitSeed();
    const store = createWorkspaceStore(seed, new InMemoryWorkspaceRepository());
    const mutations: WebMcpMutationEvent[] = [];
    const tools = new Map(
      createWebMcpTools(store, {
        onMutation: (event) => mutations.push(event),
      }).map((tool) => [tool.name, tool]),
    );
    const parentId = await beginShadow(tools, "Conservative");
    const sourceChangeId = await stageFigma(tools, parentId, 76);
    const beforeInvalid = serializeWorkspace(store.getSnapshot().workspace);

    await expect(
      execute(requiredTool(tools, "fork_shadow"), {
        sourceShadowId: parentId,
        name: "Hybrid",
        strategy: "custom",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENTS" },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeInvalid,
    );

    const forked = await execute<{
      parentShadowId: string;
      shadow: { shadowId: string; changeCount: number };
      impact: { monthlySavingsCents: number };
    }>(requiredTool(tools, "fork_shadow"), {
      sourceShadowId: parentId,
      name: "Hybrid",
    });
    if (!forked.ok) throw new Error(forked.error.message);
    const childId = forked.data.shadow.shadowId;

    expect(forked).toMatchObject({
      ok: true,
      realityVersion: 1,
      shadowRevision: 0,
      data: {
        parentShadowId: parentId,
        shadow: { shadowId: childId, changeCount: 1 },
        impact: { monthlySavingsCents: 397_500 },
      },
    });
    expect(JSON.stringify(forked).length).toBeLessThan(1_800);
    const childChange =
      store.getSnapshot().workspace.shadows[childId].changes[0];
    expect(childChange.id).not.toBe(sourceChangeId);
    expect(childChange.provenance).toMatchObject({
      source: "webmcp",
      commandName: "fork_shadow",
      copiedFromChangeId: sourceChangeId,
    });
    expect(store.getSnapshot().workspace.reality).toEqual(seed.reality);
    expect(mutations.at(-1)).toEqual({
      kind: "shadow-created",
      shadowId: childId,
      shadowRevision: 0,
    });

    await execute(requiredTool(tools, "stage_seat_change"), {
      shadowId: parentId,
      subscriptionId: "subscription-figma",
      seatCount: 70,
    });
    expect(
      store.getSnapshot().workspace.shadows[childId].changes[0].proposedValue,
    ).toBe(76);
  });

  it("copies into the target, then compares without mutating either future", async () => {
    const seed = createOrbitSeed();
    const store = createWorkspaceStore(seed, new InMemoryWorkspaceRepository());
    const mutations: WebMcpMutationEvent[] = [];
    const tools = new Map(
      createWebMcpTools(store, {
        onMutation: (event) => mutations.push(event),
      }).map((tool) => [tool.name, tool]),
    );
    const conservativeId = await beginShadow(tools, "Conservative");
    await stageFigma(tools, conservativeId, 76);
    const fork = await execute<{ shadow: { shadowId: string } }>(
      requiredTool(tools, "fork_shadow"),
      { sourceShadowId: conservativeId, name: "Hybrid" },
    );
    if (!fork.ok) throw new Error(fork.error.message);
    const hybridId = fork.data.shadow.shadowId;
    const aggressiveId = await beginShadow(tools, "Aggressive");
    const aggressiveChangeId = await stageFigma(tools, aggressiveId, 51);
    const beforeInvalid = serializeWorkspace(store.getSnapshot().workspace);

    await expect(
      execute(requiredTool(tools, "copy_change_between_shadows"), {
        sourceShadowId: aggressiveId,
        targetShadowId: hybridId,
        changeId: aggressiveChangeId,
        force: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENTS" },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeInvalid,
    );

    const copied = await execute<{
      sourceShadowId: string;
      targetShadowId: string;
      change: { changeId: string; to: number };
      impact: { monthlySavingsCents: number; risk: string };
    }>(requiredTool(tools, "copy_change_between_shadows"), {
      sourceShadowId: aggressiveId,
      targetShadowId: hybridId,
      changeId: aggressiveChangeId,
    });

    expect(copied).toMatchObject({
      ok: true,
      realityVersion: 1,
      shadowRevision: 1,
      data: {
        sourceShadowId: aggressiveId,
        targetShadowId: hybridId,
        change: { to: 51 },
        impact: { monthlySavingsCents: 1_060_000, risk: "medium" },
      },
    });
    if (!copied.ok) throw new Error(copied.error.message);
    expect(JSON.stringify(copied).length).toBeLessThan(1_800);
    const targetChange =
      store.getSnapshot().workspace.shadows[hybridId].changes[0];
    expect(targetChange.id).toBe(copied.data.change.changeId);
    expect(targetChange.provenance).toMatchObject({
      source: "webmcp",
      commandName: "copy_change_between_shadows",
      copiedFromChangeId: aggressiveChangeId,
    });
    expect(mutations.at(-1)).toEqual({
      kind: "shadow-updated",
      shadowId: hybridId,
      shadowRevision: 1,
    });
    expect(store.getSnapshot().workspace.reality).toEqual(seed.reality);

    const beforeCompare = serializeWorkspace(store.getSnapshot().workspace);
    const compared = await execute<{
      left: { shadowId: string; impact: { monthlySavingsCents: number } };
      right: { shadowId: string; impact: { monthlySavingsCents: number } };
      sharedProducts: string[];
      differences: Array<{ product: string; differenceKinds: string[] }>;
    }>(requiredTool(tools, "compare_shadows"), {
      leftShadowId: conservativeId,
      rightShadowId: hybridId,
    });

    expect(compared).toMatchObject({
      ok: true,
      realityVersion: 1,
      data: {
        left: {
          shadowId: conservativeId,
          impact: { monthlySavingsCents: 397_500 },
        },
        right: {
          shadowId: hybridId,
          impact: { monthlySavingsCents: 1_060_000 },
        },
        sharedProducts: [],
        differences: [
          {
            product: "Figma",
            differenceKinds: ["seats", "monthly-cost"],
          },
        ],
      },
    });
    expect(JSON.stringify(compared).length).toBeLessThan(1_800);
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeCompare,
    );
  });
});
