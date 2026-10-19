import { expect, test } from "@playwright/test";
import { authFile, collectBrowserErrors } from "./helpers";

test.use({ storageState: authFile("teacher") });

test("teacher can monitor students and open the review queue", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Monitoring kelas dan pendampingan" })).toBeVisible();
  await expect(page.getByText("Siswa dampingan", { exact: true })).toBeVisible();

  await page.goto("/dashboard/review");
  await expect(page.getByRole("heading", { name: "Antrean Penilaian Tugas" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
