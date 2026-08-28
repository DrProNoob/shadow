import { expect, test } from "@playwright/test";

test("commits the exact Hybrid through the human UI and creates a deterministic receipt", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Load example futures" }).click();
  await page.getByRole("link", { name: "Compare" }).click();
  await page.getByRole("button", { name: "Create Hybrid" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Hybrid", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Commit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Commit Hybrid" }),
  ).toBeVisible();
  await expect(dialog.getByText("$442,980", { exact: true })).toBeVisible();
  await expect(dialog.getByText("20.0%", { exact: true })).toBeVisible();
  const commitButton = dialog.getByRole("button", {
    name: "Commit to Reality v2",
  });
  await expect(commitButton).toBeDisabled();
  await dialog
    .getByRole("checkbox", {
      name: /I have reviewed this Shadow and intend to make it the new synthetic Reality/,
    })
    .check();
  await expect(commitButton).toBeEnabled();
  await commitButton.click();

  await expect(page).toHaveURL(/\/receipts\/receipt-001$/);
  await expect(
    page.getByRole("heading", { name: "Hybrid", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .locator("header")
      .getByText("Committed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("receipt-001", { exact: false })).toBeVisible();
  await expect(page.getByText(/Reality v1Reality v2/)).toBeVisible();
  await expect(page.getByText("$36,915", { exact: true })).toBeVisible();
  await expect(page.getByText("$442,980", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Applied changes and Proof snapshots",
    }),
  ).toBeVisible();
  await expect(page.getByText("Snapshot, not chain-of-thought")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Commit", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/slice-7-committed-receipt.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$147,385",
  );
  await expect(page.getByRole("button", { name: "Reality v2" })).toBeVisible();

  await page.getByRole("link", { name: "Receipts" }).click();
  await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Hybrid/ })).toContainText(
    "$442,980",
  );

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "ORBIT software operations" }),
  ).toBeVisible();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$184,300",
  );
  await expect(page.getByRole("button", { name: "Reality v1" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("requires advisory acknowledgement and never offers an override for hard blockers", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load example futures" }).click();
  await page.getByRole("button", { name: "Commit", exact: true }).click();

  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Advisory review required", { exact: true }),
  ).toBeVisible();
  const deliberate = dialog.getByRole("checkbox", {
    name: /I have reviewed this Shadow/,
  });
  const warning = dialog.getByRole("checkbox", {
    name: /I acknowledge the advisory warnings/,
  });
  const conservativeCommit = dialog.getByRole("button", {
    name: "Commit to Reality v2",
  });
  await deliberate.check();
  await expect(conservativeCommit).toBeDisabled();
  await warning.check();
  await expect(conservativeCommit).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
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
  await page.reload();
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
      name: "Blocked Miro",
    })) as { ok: true; data: { shadowId: string } };
    await execute("stage_cancellation", {
      shadowId: begun.data.shadowId,
      subscriptionId: "subscription-miro",
    });
  });

  await page.getByRole("button", { name: "Commit", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Hard blockers cannot be overridden", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Commit is unavailable", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Resolve blockers" }),
  ).toBeDisabled();
});
