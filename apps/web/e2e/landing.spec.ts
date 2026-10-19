import { expect, test } from "@playwright/test";
import { collectBrowserErrors } from "./helpers";

test("landing page mobile exposes a usable navigation", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Belajar bisnis digital/ })).toBeVisible();
  await page.getByRole("button", { name: "Buka menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navigasi seluler" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk ke platform", exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
