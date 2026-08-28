import { expect, test } from "@playwright/test";

test("loads the exact Conservative and Aggressive futures through demo replay", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Load example futures" }).click();

  await expect(
    page.getByRole("heading", { name: "Conservative", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$30,290", { exact: true })).toBeVisible();
  await expect(page.getByText("$363,480", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("main").getByText("16.4%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("7 changes", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Notion Plan change" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Loom Cancellation" }),
  ).toBeVisible();
  await expect(
    page.getByText("low risk", { exact: true }).last(),
  ).toBeVisible();

  const figmaCard = page.getByRole("article", {
    name: "Figma Seat optimization",
  });
  await figmaCard.getByRole("button", { name: "Why?" }).click();
  const proofDialog = page.getByRole("dialog");
  await expect(proofDialog).toBeVisible();
  await expect(
    proofDialog.getByRole("heading", { name: "Figma", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Observable proof", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close proof" }).click();

  await page.getByRole("button", { name: "Aggressive", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Aggressive", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$41,480", { exact: true })).toBeVisible();
  await expect(page.getByText("$497,760", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("main").getByText("22.5%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("9 changes", { exact: true })).toBeVisible();
  await expect(
    page.getByText("11 active users affected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("medium risk", { exact: true }).last(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Aggressive · based on v1" }).click();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$184,300",
  );
  expect(consoleErrors).toEqual([]);
});

test("keeps an unsafe Miro cancellation visible with its proof and blockers", async ({
  page,
}) => {
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
        ) => registrations.push({ tool, signal: options?.signal }),
      },
    });
    Object.defineProperty(window, "__shadowRegistrations", {
      configurable: true,
      value: registrations,
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("webmcp-status")).toHaveText("Ready");
  await page.evaluate(async () => {
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
    const execute = async (name: string, input: Record<string, unknown>) => {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Missing registered tool ${name}`);
      return tool.execute(input, { signal: new AbortController().signal });
    };
    const begun = (await execute("begin_shadow", {
      name: "Unsafe Miro",
      strategy: "custom",
    })) as { ok: true; data: { shadowId: string } };
    await execute("stage_cancellation", {
      shadowId: begun.data.shadowId,
      subscriptionId: "subscription-miro",
    });
  });

  await expect(
    page.getByRole("heading", { name: "Unsafe Miro", exact: true }),
  ).toBeVisible();
  const cancellation = page.getByRole("article", {
    name: "Miro Cancellation",
  });
  await expect(cancellation).toBeVisible();
  await expect(
    cancellation.getByText("$25,000 penalty", { exact: true }),
  ).toBeVisible();
  await expect(
    cancellation.getByText("Commit blocked", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("This future cannot be committed", { exact: true }),
  ).toBeVisible();

  await cancellation.getByRole("button", { name: "Why?" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Expected contractual penalty", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Commit blocked", { exact: true }).last(),
  ).toBeVisible();
});
