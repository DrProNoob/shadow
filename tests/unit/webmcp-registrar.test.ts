import { createElement, StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";
import { useWebMcpRegistrar } from "@/webmcp/webmcp-registrar";

describe("useWebMcpRegistrar", () => {
  it("survives Strict Mode remounts and aborts every live registration", async () => {
    const original = Object.getOwnPropertyDescriptor(document, "modelContext");
    const activeTools = new Set<string>();
    const registerTool = vi.fn(
      async (
        tool: WebMCP.ModelContextTool,
        options?: WebMCP.ModelContextRegisterToolOptions,
      ) => {
        activeTools.add(tool.name);
        options?.signal?.addEventListener(
          "abort",
          () => activeTools.delete(tool.name),
          { once: true },
        );
      },
    );
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool },
    });
    const store = createWorkspaceStore(
      createOrbitSeed(),
      new InMemoryWorkspaceRepository(),
    );
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    try {
      const { result, unmount } = renderHook(
        () => useWebMcpRegistrar(store, true),
        { wrapper },
      );

      await waitFor(() => expect(result.current).toBe("ready"));
      expect(activeTools).toEqual(
        new Set([
          "webmcp_ping",
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
        ]),
      );

      unmount();
      expect(activeTools.size).toBe(0);
    } finally {
      if (original) Object.defineProperty(document, "modelContext", original);
      else Reflect.deleteProperty(document, "modelContext");
    }
  });
});
