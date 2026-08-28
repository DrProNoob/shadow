import { describe, expect, it, vi } from "vitest";
import {
  registerWebMcpTools,
  type WebMcpRegistrationTarget,
} from "@/webmcp/browser-adapter";

function testTool(name: string): WebMCP.ModelContextTool {
  return {
    name,
    description: `Test ${name}`,
    execute: () => ({ ok: true }),
  };
}

describe("WebMCP registration lifecycle", () => {
  it("registers tools under one AbortSignal and cleans them up together", async () => {
    const activeTools = new Set<string>();
    const registerTool = vi.fn<WebMcpRegistrationTarget["registerTool"]>(
      async (tool, options) => {
        activeTools.add(tool.name);
        options?.signal?.addEventListener(
          "abort",
          () => activeTools.delete(tool.name),
          { once: true },
        );
      },
    );
    const target: WebMcpRegistrationTarget = { registerTool };
    const controller = new AbortController();

    await expect(
      registerWebMcpTools(
        [testTool("first"), testTool("second")],
        controller.signal,
        target,
      ),
    ).resolves.toBe("ready");
    expect(activeTools).toEqual(new Set(["first", "second"]));
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registerTool.mock.calls[0][1]?.signal).toBe(controller.signal);

    controller.abort();
    expect(activeTools.size).toBe(0);
  });

  it("feature-detects unavailable contexts and rejects duplicate names", async () => {
    const controller = new AbortController();
    await expect(
      registerWebMcpTools([testTool("read")], controller.signal, null),
    ).resolves.toBe("unavailable");

    const target: WebMcpRegistrationTarget = {
      registerTool: vi.fn(async () => undefined),
    };
    await expect(
      registerWebMcpTools(
        [testTool("duplicate"), testTool("duplicate")],
        controller.signal,
        target,
      ),
    ).rejects.toThrow("Duplicate WebMCP tool name: duplicate");
    expect(target.registerTool).not.toHaveBeenCalled();
  });
});
