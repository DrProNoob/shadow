import { expect, test } from "@playwright/test";

test("renders the Reality baseline without WebMCP support", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "ORBIT software operations" }),
  ).toBeVisible();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$184,300",
  );
  await expect(page.getByTestId("webmcp-status")).toHaveText("Fallback");
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-main")).toBeFocused();
  expect(consoleErrors).toEqual([]);

  await page.screenshot({
    path: "test-results/slice-1-foundation.png",
    fullPage: true,
  });
});

test("registers a read-only tracer against the live workspace", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const registrations: Array<{
      tool: {
        name: string;
        annotations?: { readOnlyHint?: boolean };
        execute: (input: unknown, options: { signal: AbortSignal }) => unknown;
      };
      signal?: AbortSignal;
    }> = [];

    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (
          tool: (typeof registrations)[number]["tool"],
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
          tool: {
            name: string;
            annotations?: { readOnlyHint?: boolean };
            execute: (
              input: unknown,
              options: { signal: AbortSignal },
            ) => Promise<unknown>;
          };
        }>;
      }
    ).__shadowRegistrations;
    const registration = registrations.find(
      ({ tool }) => tool.name === "get_company_summary",
    );
    if (!registration)
      throw new Error("get_company_summary was not registered");

    return {
      output: await registration.tool.execute(
        {},
        { signal: new AbortController().signal },
      ),
      readOnly: registration.tool.annotations?.readOnlyHint,
    };
  });

  expect(result).toMatchObject({
    output: {
      ok: true,
      data: { monthlySoftwareCostCents: 18_430_000 },
      realityVersion: 1,
    },
    readOnly: true,
  });
});

test("keeps the foundation usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByText("ORBIT software operations")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
  await expect(page.getByTestId("monthly-software-cost")).toBeVisible();

  await page.screenshot({
    path: "test-results/slice-1-foundation-mobile.png",
    fullPage: true,
  });
});
