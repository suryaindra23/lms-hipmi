import { expect, type Page } from "@playwright/test";
import path from "node:path";

export type DemoRole = "student" | "teacher" | "parent" | "admin";

const demoCredentials = {
  student: { email: "student@lms.test", password: "student123" },
  teacher: { email: "teacher@lms.test", password: "teacher123" },
  parent: { email: "parent@lms.test", password: "parent123" },
  admin: { email: "admin@lms.test", password: "admin123" },
} satisfies Record<DemoRole, { email: string; password: string }>;

export function credentials(role: DemoRole) {
  return demoCredentials[role];
}

export function authFile(role: DemoRole) {
  return path.join(process.cwd(), "playwright", ".auth", `${role}.json`);
}

export async function login(page: Page, role: DemoRole) {
  const account = credentials(role);
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(account.password);
  await Promise.all([
    page.waitForURL(/\/dashboard$/),
    page.getByRole("button", { name: "Masuk ke platform", exact: true }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Ringkasan", exact: true })).toBeVisible();
}

export function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource: the server responded with a status of (401|403)/.test(text)) return;
    errors.push(text);
  });
  return errors;
}
