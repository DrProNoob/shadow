import { expect, test } from "@playwright/test";

test("compares named futures and derives the exact Hybrid without changing its parent", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Load example futures" }).click();
  await page.getByRole("link", { name: "Compare" }).click();

  await expect(
    page.getByRole("heading", { name: "Compare Futures" }),
  ).toBeVisible();
  await expect(
    page.getByText("Conservative", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Aggressive", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Monthly savings \$30,290 \$41,480/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Active users affected 0 11/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Engineering affected 0 0/ }),
  ).toBeVisible();
  const figmaRow = page.getByRole("row", { name: /Figma/ });
  await expect(figmaRow).toContainText("91");
  await expect(figmaRow).toContainText("76");
  await expect(figmaRow).toContainText("51");
  const miroRow = page.getByRole("row", { name: /Miro/ });
  await expect(miroRow).toContainText("Keep");
  await expect(miroRow).toContainText("180 seats");
  await expect(miroRow).toContainText("141");

  await page.screenshot({
    path: "test-results/slice-6-compare-futures.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Create Hybrid" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Hybrid", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$36,915", { exact: true })).toBeVisible();
  await expect(page.getByText("$442,980", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("main").getByText("20.0%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("7 changes", { exact: true })).toBeVisible();
  await expect(
    page.getByText("11 active users affected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("medium risk", { exact: true }).last(),
  ).toBeVisible();

  const hybridFigma = page.getByRole("article", {
    name: "Figma Seat optimization",
  });
  await expect(hybridFigma).toContainText("91");
  await expect(hybridFigma).toContainText("51");
  await expect(hybridFigma).toContainText("−$10,600/mo");

  await page.getByRole("button", { name: "Conservative", exact: true }).click();
  const conservativeFigma = page.getByRole("article", {
    name: "Figma Seat optimization",
  });
  await expect(conservativeFigma).toContainText("91");
  await expect(conservativeFigma).toContainText("76");
  await expect(conservativeFigma).not.toContainText("51");

  await page
    .getByRole("button", { name: "Conservative · based on v1" })
    .click();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$184,300",
  );
  expect(consoleErrors).toEqual([]);
});
