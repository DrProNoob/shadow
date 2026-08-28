import { expect, test } from "@playwright/test";

test("renders every read-only Reality view from the same workspace", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/subscriptions");
  await expect(
    page.getByRole("heading", { name: "Software subscriptions" }),
  ).toBeVisible();
  await expect(page.getByText("$184,300", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Datadog/ })).toBeVisible();

  await page
    .getByRole("link", { name: "Contracts", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Contracts" })).toBeVisible();
  await expect(page.getByText("$25,000 penalty")).toBeVisible();

  await page.getByRole("link", { name: "People", exact: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "People and teams" }),
  ).toBeVisible();
  await expect(page.getByText("312", { exact: true })).toBeVisible();
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "People and teams" }),
  ).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("keeps Reality views usable at tablet and mobile widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/subscriptions");
  await expect(
    page.getByRole("heading", { name: "Software subscriptions" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Subscriptions" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contracts");
  await expect(
    page.getByRole("navigation", { name: "Mobile workspace navigation" }),
  ).toBeVisible();
  await expect(page.getByText("Miro", { exact: true })).toBeVisible();

  await page.screenshot({
    path: "test-results/slice-2-reality-mobile.png",
    fullPage: true,
  });
});
