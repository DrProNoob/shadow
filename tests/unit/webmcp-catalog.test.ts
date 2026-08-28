import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import { createWebMcpTools } from "@/webmcp/tool-catalog";

describe("WebMCP tool catalog", () => {
  it("keeps the final MVP surface at exactly 13 tools with no commit path", () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const tools = createWebMcpTools(store);

    expect(tools.map((tool) => tool.name)).toEqual([
      "get_company_summary",
      "list_subscriptions",
      "get_subscription_context",
      "begin_shadow",
      "get_shadow",
      "stage_seat_change",
      "stage_plan_change",
      "stage_cancellation",
      "remove_shadow_change",
      "get_change_proof",
      "fork_shadow",
      "copy_change_between_shadows",
      "compare_shadows",
    ]);
    expect(tools.every((tool) => tool.description.length < 500)).toBe(true);
    expect(tools.some((tool) => tool.name.includes("commit"))).toBe(false);
    expect(
      tools.some((tool) => /(?:apply|write|update)_reality/.test(tool.name)),
    ).toBe(false);
    expect(tools.some((tool) => tool.name.includes("reality_write"))).toBe(
      false,
    );

    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }
  });

  it("annotates reads and user-controlled Shadow content", () => {
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const tools = new Map(
      createWebMcpTools(store).map((tool) => [tool.name, tool]),
    );

    for (const name of [
      "get_company_summary",
      "list_subscriptions",
      "get_subscription_context",
      "get_shadow",
      "get_change_proof",
      "compare_shadows",
    ]) {
      expect(tools.get(name)?.annotations?.readOnlyHint).toBe(true);
    }
    for (const name of [
      "begin_shadow",
      "get_shadow",
      "get_change_proof",
      "fork_shadow",
      "compare_shadows",
    ]) {
      expect(tools.get(name)?.annotations?.untrustedContentHint).toBe(true);
    }
    for (const name of [
      "begin_shadow",
      "stage_seat_change",
      "stage_plan_change",
      "stage_cancellation",
      "remove_shadow_change",
      "fork_shadow",
      "copy_change_between_shadows",
    ]) {
      expect(tools.get(name)?.annotations?.readOnlyHint).not.toBe(true);
    }
  });
});
