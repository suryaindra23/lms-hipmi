import { expect, test } from "@playwright/test";
import { authFile, collectBrowserErrors } from "./helpers";

test.use({ storageState: authFile("student") });

test("student sees the learning dashboard and free-access modules", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ringkasan perkembangan saya" })).toBeVisible();

  await page.goto("/dashboard/tugas");
  await expect(page.getByRole("heading", { name: "Daftar Tugas Praktik" })).toBeVisible();
  await expect(page.getByText(/Modul\s+12/i).first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("student store and affiliate history render without runtime errors", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/dashboard/toko");
  await expect(page.getByRole("heading", { name: "Pengumpulan Toko Digital" })).toBeVisible();
  await expect(page.getByText("Unexpected end of JSON input")).toHaveCount(0);

  await page.goto("/dashboard/affiliate");
  await expect(page.getByRole("heading", { name: "Ringkasan performa" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Riwayat performa" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("student cannot open payment approval", async ({ page }) => {
  await page.goto("/dashboard/pembelian/approval");
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Ringkasan perkembangan saya" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approval Pembayaran" })).toHaveCount(0);
});
