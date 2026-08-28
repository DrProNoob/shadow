import { describe, expect, it } from "vitest";
import type { WorkspaceStore } from "@/application/workspace-store";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import {
  createWebMcpTools,
  type ToolEnvelope,
  type WebMcpMutationEvent,
} from "@/webmcp/tool-catalog";

function findTool(store: WorkspaceStore, name: string) {
  const tool = createWebMcpTools(store).find(
    (candidate) => candidate.name === name,
  );
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

describe("WebMCP Shadow flow", () => {
  it("returns compact Reality reads and structured not-found failures", async () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );

    const listed = await execute<{
      subscriptions: Array<{ subscriptionId: string; product: string }>;
    }>(findTool(store, "list_subscriptions"), {});
    expect(listed).toMatchObject({ ok: true, realityVersion: 1 });
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.data.subscriptions).toHaveLength(10);
    expect(JSON.stringify(listed).length).toBeLessThan(1_800);
    expect(listed.data.subscriptions).toContainEqual(
      expect.objectContaining({
        subscriptionId: "subscription-adobe",
        product: "Adobe",
      }),
    );

    const context = await execute(findTool(store, "get_subscription_context"), {
      subscriptionId: "subscription-adobe",
    });
    expect(context).toMatchObject({
      ok: true,
      data: {
        subscription: { product: "Adobe", seats: 63 },
        usage: { active90d: 17, inactive90d: 46 },
        contract: { seatReductionCadence: "monthly" },
      },
      realityVersion: 1,
    });
    expect(JSON.stringify(context).length).toBeLessThan(1_800);

    const notionContext = await execute(
      findTool(store, "get_subscription_context"),
      { subscriptionId: "subscription-notion" },
    );
    expect(notionContext).toMatchObject({
      ok: true,
      data: {
        subscription: {
          product: "Notion",
          planId: "plan-notion-enterprise",
          plan: "Enterprise",
        },
        availablePlanTransitions: [
          {
            planId: "plan-notion-business",
            name: "Business",
            approved: true,
            capabilityEffect: "preserving",
          },
        ],
      },
      realityVersion: 1,
    });
    expect(JSON.stringify(notionContext).length).toBeLessThan(1_800);

    await expect(
      execute(findTool(store, "get_subscription_context"), {
        subscriptionId: "missing",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SUBSCRIPTION_NOT_FOUND", retryable: true },
    });
  });

  it("validates, persists, publishes, proves, and removes Shadow changes", async () => {
    const seed = createOrbitSeed();
    const store = createWorkspaceStore(seed, new InMemoryWorkspaceRepository());
    const mutations: WebMcpMutationEvent[] = [];
    const tools = new Map(
      createWebMcpTools(store, {
        onMutation: (event) => mutations.push(event),
      }).map((tool) => [tool.name, tool]),
    );
    const tool = (name: string) => {
      const found = tools.get(name);
      if (!found) throw new Error(`Missing tool ${name}`);
      return found;
    };

    const beforeInvalid = serializeWorkspace(store.getSnapshot().workspace);
    const invalid = await execute(tool("begin_shadow"), {
      name: "Agent future",
      unexpected: true,
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENTS", retryable: true },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeInvalid,
    );

    const begun = await execute<{ shadowId: string }>(tool("begin_shadow"), {
      name: "Agent future",
      strategy: "conservative",
    });
    if (!begun.ok) throw new Error(begun.error.message);
    const shadowId = begun.data.shadowId;
    expect(store.getSnapshot().workspace.reality).toEqual(seed.reality);
    expect(store.getSnapshot().workspace.shadows[shadowId]).toBeDefined();

    const beforeBadSeat = serializeWorkspace(store.getSnapshot().workspace);
    await expect(
      execute(tool("stage_seat_change"), {
        shadowId,
        subscriptionId: "subscription-adobe",
        seatCount: -1,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENTS" },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeBadSeat,
    );

    const staged = await execute<{
      change: { changeId: string };
      impact: { monthlySavingsCents: number };
    }>(tool("stage_seat_change"), {
      shadowId,
      subscriptionId: "subscription-adobe",
      seatCount: 17,
    });
    if (!staged.ok) throw new Error(staged.error.message);
    expect(staged).toMatchObject({
      realityVersion: 1,
      shadowRevision: 1,
      data: { impact: { monthlySavingsCents: 368_000 } },
    });
    expect(store.getSnapshot().workspace.reality).toEqual(seed.reality);
    expect(
      store.getSnapshot().workspace.shadows[shadowId].changes[0].provenance
        .source,
    ).toBe("webmcp");

    const proof = await execute(tool("get_change_proof"), {
      shadowId,
      changeId: staged.data.change.changeId,
    });
    expect(proof).toMatchObject({
      ok: true,
      shadowRevision: 1,
      data: {
        proof: {
          transition: {
            before: { seatCount: 63 },
            after: { seatCount: 17 },
          },
          impact: { monthlySavingsCents: 368_000 },
        },
      },
    });
    expect(JSON.stringify(proof).length).toBeLessThan(1_800);

    const shadow = await execute(tool("get_shadow"), { shadowId });
    expect(shadow).toMatchObject({
      ok: true,
      data: {
        shadow: { name: "Agent future", revision: 1 },
        changes: [{ changeId: staged.data.change.changeId }],
      },
    });

    const removed = await execute(tool("remove_shadow_change"), {
      shadowId,
      changeId: staged.data.change.changeId,
    });
    expect(removed).toMatchObject({
      ok: true,
      shadowRevision: 2,
      data: {
        remainingChangeCount: 0,
        impact: { monthlySavingsCents: 0 },
      },
    });
    expect(mutations).toEqual([
      { kind: "shadow-created", shadowId, shadowRevision: 0 },
      { kind: "shadow-updated", shadowId, shadowRevision: 1 },
      { kind: "shadow-updated", shadowId, shadowRevision: 2 },
    ]);
    expect(
      store.getSnapshot().workspace.activity.map((event) => ({
        source: event.source,
        commandName: event.commandName,
      })),
    ).toEqual([
      { source: "webmcp", commandName: "begin_shadow" },
      { source: "webmcp", commandName: "stage_seat_change" },
      { source: "webmcp", commandName: "remove_shadow_change" },
    ]);
  });

  it("accepts the JSON-string direct-execution shape in the adapter boundary", async () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const result = await execute<{ shadowId: string }>(
      findTool(store, "begin_shadow"),
      JSON.stringify({ name: "String input future" }),
    );

    expect(result).toMatchObject({
      ok: true,
      data: { shadowId: "shadow-001" },
    });
  });
});
