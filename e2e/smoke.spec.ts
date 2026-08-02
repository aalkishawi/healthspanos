import { test, expect } from "@playwright/test";

test("public home shows the Launch button and portal map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const launch = page.getByTestId("launch-button").first();
  await expect(launch).toBeVisible();
  // The Launch button links to the public website (NEXT_PUBLIC_APP_URL). When that
  // is a full URL it must open in a new tab with a safe rel; otherwise it falls
  // back to the in-app /member route.
  const href = await launch.getAttribute("href");
  expect(href).toBeTruthy();
  if (href!.startsWith("http")) {
    await expect(launch).toHaveAttribute("target", "_blank");
    await expect(launch).toHaveAttribute("rel", /noopener/);
  }
  await expect(page.getByText("Five portals, one platform")).toBeVisible();
});

test("protected portals redirect anonymous users to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("member can sign in and reach their Healthspan Passport", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("member@acme.demo");
  await page.getByLabel("Password").fill("Demo123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/member/);
  await expect(page.getByText("Welcome, Jordan Member")).toBeVisible();
});

test("member can ask the research assistant and see an answer", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("member@acme.demo");
  await page.getByLabel("Password").fill("Demo123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/member/);
  await page.goto("/member/assistant");
  await page.getByRole("textbox", { name: /longevity/i }).fill("What does the evidence say about sleep?");
  await page.getByRole("button", { name: "Ask" }).click();
  // Demo mode returns a citation-backed, non-diagnostic answer with no provider keys.
  await expect(page.getByText(/Numik would return a graded/)).toBeVisible();
  await expect(page.getByText(/Model: demo/)).toBeVisible();
});

test("a member is blocked from the admin portal", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("member@acme.demo");
  await page.getByLabel("Password").fill("Demo123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/member/);
  await page.goto("/admin");
  // RBAC bounces the member back to their own portal.
  await expect(page).toHaveURL(/\/member/);
});
