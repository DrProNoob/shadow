import { expect, test } from "@playwright/test";

test("switches the subscription portfolio between Reality and an Aggressive Shadow", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Load example futures" }).click();
  await page.getByRole("link", { name: "Subscriptions", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Software subscriptions" }),
  ).toBeVisible();
  await expect(page.getByText("Current Reality · v1")).toBeVisible();
  const realityAdobe = page.getByRole("listitem").filter({ hasText: "Adobe" });
  await expect(realityAdobe).toContainText("63 seats");
  await expect(realityAdobe).toContainText("$5,040");
  await expect(realityAdobe).not.toContainText("17 seats");

  await page.goto("/subscriptions?context=shadow-001");
  await expect(
    page.getByRole("heading", { name: "Projected subscriptions" }),
  ).toBeVisible();
  await expect(page.getByText("$30,290/mo", { exact: true })).toBeVisible();

  const contextSelector = page.getByRole("group", {
    name: "Reality and Shadow context",
  });
  await expect(contextSelector).toBeVisible();
  await expect(
    contextSelector.getByRole("button", {
      name: "Conservative",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await contextSelector
    .getByRole("button", { name: "Reality v1", exact: true })
    .click();
  await expect(page).toHaveURL(/\/subscriptions\?context=reality$/);
  await contextSelector
    .getByRole("button", { name: "Aggressive", exact: true })
    .click();
  await expect(page).toHaveURL(/\/subscriptions\?context=shadow-002$/);

  await expect(
    page.getByRole("heading", { name: "Projected subscriptions" }),
  ).toBeVisible();
  await expect(page.getByText("$41,480/mo", { exact: true })).toBeVisible();

  const shadowAdobe = page.getByRole("listitem").filter({ hasText: "Adobe" });
  await expect(shadowAdobe).toContainText("63");
  await expect(shadowAdobe).toContainText("17 seats");
  await expect(shadowAdobe).toContainText("−$3,680/mo");

  const shadowFigma = page.getByRole("listitem").filter({ hasText: "Figma" });
  await expect(shadowFigma).toContainText("91");
  await expect(shadowFigma).toContainText("51 seats");
  await expect(shadowFigma).toContainText("11 active affected");

  await page.screenshot({
    path: "test-results/slice-8-subscription-shadow-mobile.png",
    fullPage: true,
  });

  await contextSelector
    .getByRole("button", { name: "Reality v1", exact: true })
    .click();
  await expect(page).toHaveURL(/\/subscriptions\?context=reality$/);
  await expect(
    page.getByRole("heading", { name: "Software subscriptions" }),
  ).toBeVisible();
  await expect(page.getByText("Current Reality · v1")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Adobe" }),
  ).not.toContainText("17 seats");
  expect(consoleErrors).toEqual([]);
});
