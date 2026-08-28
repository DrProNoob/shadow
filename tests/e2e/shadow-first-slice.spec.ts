import { expect, test } from "@playwright/test";

test("creates, stages, proves, persists, and removes an Adobe Shadow change", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Begin a Shadow" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin Shadow" }).click();

  await expect(
    page.getByRole("heading", { name: "Conservative" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stage Adobe 63 → 17" }).click();

  await expect(
    page.getByRole("heading", { name: "Adobe", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("−$3,680/mo", { exact: true })).toBeVisible();
  await expect(
    page.getByText("0 active users affected", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Why?" }).click();
  const proof = page.getByRole("dialog", { name: "Adobe" });
  await expect(proof).toBeVisible();
  await expect(proof.getByText("Licensed seats")).toBeVisible();
  await expect(proof.getByText("63", { exact: true }).first()).toBeVisible();
  await expect(
    proof.getByText("Active users in the last 90 days"),
  ).toBeVisible();
  await expect(proof.getByText("17", { exact: true }).first()).toBeVisible();
  await proof.getByRole("button", { name: "Close proof" }).click();

  await page.reload();
  await expect(page.getByText("−$3,680/mo", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/slice-3-adobe-shadow.png",
    fullPage: true,
  });

  await page
    .getByRole("button", { name: "Conservative · based on v1" })
    .click();
  await expect(page.getByTestId("monthly-software-cost")).toHaveText(
    "$184,300",
  );
  await page.getByRole("button", { name: "Conservative", exact: true }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(
    page.getByRole("button", { name: "Stage Adobe 63 → 17" }),
  ).toBeVisible();

  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
