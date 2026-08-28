import { expect, test } from "@playwright/test";

test("WebMCP tools mutate only the visible Shadow through the shared store", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.addInitScript(() => {
    const registrations: Array<{
      tool: WebMCP.ModelContextTool;
      signal?: AbortSignal;
    }> = [];
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (
          tool: WebMCP.ModelContextTool,
          options?: { signal?: AbortSignal },
        ) => {
          registrations.push({ tool, signal: options?.signal });
        },
      },
    });
    Object.defineProperty(window, "__shadowRegistrations", {
      configurable: true,
      value: registrations,
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("webmcp-status")).toHaveText("Ready");

  const result = await page.evaluate(async () => {
    const registrations = (
      window as typeof window & {
        __shadowRegistrations: Array<{
          tool: WebMCP.ModelContextTool;
          signal?: AbortSignal;
        }>;
      }
    ).__shadowRegistrations.filter(({ signal }) => !signal?.aborted);
    const tools = new Map(
      registrations.map(({ tool }) => [tool.name, tool] as const),
    );
    const executeWithoutOptions = async (
      name: string,
      input: Record<string, unknown>,
    ) => {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Missing registered tool ${name}`);
      const execute = tool.execute as unknown as (
        input: Record<string, unknown>,
      ) => Promise<unknown>;
      return execute(input);
    };

    const ping = await executeWithoutOptions("webmcp_ping", {});
    const summary = await executeWithoutOptions("get_company_summary", {});
    const begun = (await executeWithoutOptions("begin_shadow", {
      name: "WebMCP Conservative",
      strategy: "conservative",
    })) as { ok: true; data: { shadowId: string } };
    const shadowId = begun.data.shadowId;
    const staged = (await executeWithoutOptions("stage_seat_change", {
      shadowId,
      subscriptionId: "subscription-adobe",
      seatCount: 17,
    })) as { ok: true; data: { change: { changeId: string } } };
    const invalid = await executeWithoutOptions("stage_seat_change", {
      shadowId,
      subscriptionId: "subscription-adobe",
      seatCount: -1,
    });
    const proof = await executeWithoutOptions("get_change_proof", {
      shadowId,
      changeId: staged.data.change.changeId,
    });

    return {
      names: Array.from(tools.keys()),
      ping,
      summary,
      begun,
      staged,
      invalid,
      proof,
    };
  });

  expect(result.names).toEqual([
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
  ]);
  expect(result.names.some((name) => name.includes("commit"))).toBe(false);
  expect(result.ping).toEqual({
    ok: true,
    message: "SHADOW WebMCP is alive",
  });
  expect(result.summary).toMatchObject({
    ok: true,
    data: { companyName: "ORBIT", realityVersion: 1 },
  });
  expect(result.invalid).toMatchObject({
    ok: false,
    error: { code: "INVALID_ARGUMENTS" },
  });
  expect(result.proof).toMatchObject({
    ok: true,
    data: {
      proof: {
        impact: { monthlySavingsCents: 368_000 },
      },
    },
  });

  await expect(
    page.getByRole("heading", { name: "WebMCP Conservative" }),
  ).toBeVisible();
  await expect(page.getByText("−$3,680/mo", { exact: true })).toBeVisible();
  await expect(page.getByText("webmcp", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("webmcp-diagnostics")).toContainText(
    "stage_seat_change",
  );
  await expect(page.getByTestId("webmcp-diagnostics")).toContainText(
    "result-returned",
  );

  await page
    .getByRole("button", { name: "WebMCP Conservative · based on v1" })
    .click();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$184,300",
  );
  expect(consoleErrors).toEqual([]);
});

test("Tool Lab executes the same catalog without pretending to be a live agent", async ({
  page,
}) => {
  await page.goto("/tool-lab");
  await expect(
    page.getByRole("heading", { name: "WebMCP Tool Lab" }),
  ).toBeVisible();
  await expect(
    page.getByText("Development only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("not a live agent conversation", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: /begin_shadow/ }).click();
  await page
    .getByLabel("JSON input")
    .fill('{"name":"Tool Lab Future","strategy":"conservative"}');
  await page.getByRole("button", { name: "Execute tool" }).click();

  await expect(page.getByRole("status")).toHaveText("Succeeded");
  await expect(page.getByText(/"shadowId": "shadow-001"/)).toBeVisible();
  await expect(
    page.getByText("Active shadow-001", { exact: true }),
  ).toBeVisible();
});
