import { describe, expect, it, vi } from "vitest";
import {
  commitShadow,
  UI_COMMIT_CONFIRMATION,
} from "@/application/commit-service";
import { loadExampleFutures } from "@/application/named-futures";
import type { WorkspaceRepository } from "@/application/workspace-repository";
import {
  createWorkspaceStore,
  type WorkspaceStore,
} from "@/application/workspace-store";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import type { Result, WorkspaceState } from "@/domain/model";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import { createWebMcpTools, type ToolEnvelope } from "@/webmcp/tool-catalog";

function unwrap<T>(result: Result<T>): T {
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
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

function toolsFor(store: WorkspaceStore) {
  return new Map(createWebMcpTools(store).map((tool) => [tool.name, tool]));
}

class ThrowingSaveRepository implements WorkspaceRepository {
  saveCalls = 0;

  constructor(private readonly initial: WorkspaceState) {}

  load(): WorkspaceState {
    return JSON.parse(serializeWorkspace(this.initial)) as WorkspaceState;
  }

  save(): never {
    this.saveCalls += 1;
    throw new Error("simulated persistence failure");
  }
}

describe("Slice 7 WebMCP and atomicity safety audit", () => {
  it("reads committed Reality v2 while every old-Shadow executor fails safely", async () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const store = createWorkspaceStore(
      loaded.workspace,
      new InMemoryWorkspaceRepository(loaded.workspace),
    );
    store.hydrate();
    const tools = toolsFor(store);
    const committed = unwrap(
      commitShadow(store.getSnapshot().workspace, {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    );

    store.replace(committed.workspace);
    const summary = await execute<{
      realityVersion: number;
      monthlySoftwareCostCents: number;
    }>(requiredTool(tools, "get_company_summary"), {});
    expect(summary).toMatchObject({
      ok: true,
      realityVersion: 2,
      data: {
        realityVersion: 2,
        monthlySoftwareCostCents: 14_282_000,
      },
    });
    expect(committed.receipt).toMatchObject({
      realityVersionBefore: 1,
      realityVersionAfter: 2,
    });

    const staleShadowId = loaded.conservative.id;
    const committedShadowId = loaded.aggressive.id;
    const staleChangeId = loaded.conservative.changes[0].id;
    const staleCases: Array<{
      tool: string;
      input: Record<string, unknown>;
    }> = [
      { tool: "get_shadow", input: { shadowId: staleShadowId } },
      {
        tool: "get_change_proof",
        input: { shadowId: staleShadowId, changeId: staleChangeId },
      },
      {
        tool: "stage_seat_change",
        input: {
          shadowId: staleShadowId,
          subscriptionId: "subscription-adobe",
          seatCount: 20,
        },
      },
      {
        tool: "stage_plan_change",
        input: {
          shadowId: staleShadowId,
          subscriptionId: "subscription-notion",
          planId: "plan-notion-business",
        },
      },
      {
        tool: "stage_cancellation",
        input: {
          shadowId: staleShadowId,
          subscriptionId: "subscription-loom",
        },
      },
      {
        tool: "remove_shadow_change",
        input: { shadowId: staleShadowId, changeId: staleChangeId },
      },
      {
        tool: "fork_shadow",
        input: { sourceShadowId: staleShadowId, name: "Stale child" },
      },
      {
        tool: "copy_change_between_shadows",
        input: {
          sourceShadowId: staleShadowId,
          targetShadowId: committedShadowId,
          changeId: staleChangeId,
        },
      },
      {
        tool: "compare_shadows",
        input: {
          leftShadowId: staleShadowId,
          rightShadowId: committedShadowId,
        },
      },
    ];

    for (const testCase of staleCases) {
      const before = serializeWorkspace(store.getSnapshot().workspace);
      const result = await execute(
        requiredTool(tools, testCase.tool),
        testCase.input,
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: "SHADOW_STALE", retryable: false },
      });
      expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(before);
    }

    const beforeCommittedEdit = serializeWorkspace(
      store.getSnapshot().workspace,
    );
    await expect(
      execute(requiredTool(tools, "stage_seat_change"), {
        shadowId: committedShadowId,
        subscriptionId: "subscription-adobe",
        seatCount: 20,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SHADOW_NOT_DRAFT", retryable: false },
    });
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      beforeCommittedEdit,
    );
    expect(createWebMcpTools(store)).toHaveLength(13);
    expect(
      createWebMcpTools(store).some((tool) => tool.name.includes("commit")),
    ).toBe(false);
  });

  it("does not publish a prepared commit when durable persistence throws", () => {
    const loaded = unwrap(loadExampleFutures(createOrbitSeed()));
    const preparedCommit = unwrap(
      commitShadow(loaded.workspace, {
        shadowId: loaded.aggressive.id,
        confirmation: UI_COMMIT_CONFIRMATION,
      }),
    );
    const repository = new ThrowingSaveRepository(loaded.workspace);
    const store = createWorkspaceStore(loaded.workspace, repository);
    store.hydrate();
    const before = serializeWorkspace(store.getSnapshot().workspace);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(() => store.replace(preparedCommit.workspace)).toThrow(
      "simulated persistence failure",
    );
    expect(repository.saveCalls).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(before);
    expect(store.getSnapshot().workspace.reality.version).toBe(1);
    expect(store.getSnapshot().workspace.receipts).toEqual({});
  });
});
