import { expect, test } from "@playwright/test";
import { authFile } from "./helpers";

test.use({ storageState: authFile("parent") });

test("parent sees linked-child progress but not school administration", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Perkembangan anak terhubung" })).toBeVisible();

  await page.goto("/dashboard/master-data");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profil Sekolah" })).toHaveCount(0);
});
