import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { authFile, login, type DemoRole } from "./helpers";

const roles: DemoRole[] = ["student", "teacher", "parent", "admin"];
mkdirSync(path.dirname(authFile("student")), { recursive: true });

for (const role of roles) {
  setup(`authenticate ${role}`, async ({ page }) => {
    await login(page, role);
    await page.context().storageState({ path: authFile(role) });
  });
}
