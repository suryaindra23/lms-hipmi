import { expect, test } from "@playwright/test";
import { authFile, collectBrowserErrors } from "./helpers";

test.use({ storageState: authFile("admin") });

test("super admin sees global operations and the user form", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Monitoring program lintas sekolah" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pengelolaan\s+Konten, sertifikat, dan lead/ })).toBeVisible();

  await page.goto("/dashboard/master-data");
  await expect(page.getByRole("heading", { name: "Master Data" })).toBeVisible();
  await page.getByRole("button", { name: /Tambah (pengguna|siswa)/ }).click();
  await expect(page.getByRole("heading", { name: /Tambahkan pengguna ke/ })).toBeVisible();
  await expect(page.getByLabel("Peran pengguna")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("super admin can inspect paid-package approvals", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/dashboard/pembelian/approval");
  await expect(page.getByRole("heading", { name: "Approval Pembayaran" })).toBeVisible();
  await expect(page.getByText("Paket Gratis tidak menunggu approval")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
