import { test, expect } from "@playwright/test";
import { registerAdmin, loginViaUI, expectToastError } from "./helpers";

test.describe("Login", () => {
  test("nominal: register and login successfully", async ({ page }) => {
    // Register admin via API
    const tokens = await registerAdmin();
    const email = `test-user-${Date.now()}@example.com`;
    const password = "ValidPass123!";

    // Register user via API (simulate another endpoint)
    const registerResponse = await page.request.post(
      "http://localhost:8000/auth/register",
      {
        data: {
          email,
          password,
          first_name: "Test",
          last_name: "User",
          is_admin: false,
        },
      }
    );
    expect(registerResponse.ok()).toBeTruthy();

    // Navigate to login
    await page.goto("/login");

    // Fill form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Expect redirect to dashboard
    await page.waitForURL("/dashboard");
    expect(page.url()).toContain("/dashboard");

    // Verify KPI card "Total" is visible
    const totalCard = page.locator('text="Total"').first();
    await expect(totalCard).toBeVisible();
  });

  test("invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    // Fill with wrong credentials
    await page.fill('input[type="email"]', "user@test.com");
    await page.fill('input[type="password"]', "WrongPassword123!");

    // Submit
    await page.click('button[type="submit"]');

    // Expect toast error
    await expectToastError(page, "identifiants invalides");

    // Expect no redirect
    expect(page.url()).toContain("/login");
  });

  test("logout redirects to login", async ({ page }) => {
    // Register and login
    const tokens = await registerAdmin();
    const email = `logout-test-${Date.now()}@example.com`;
    const password = "ValidPass123!";

    const registerResponse = await page.request.post(
      "http://localhost:8000/auth/register",
      {
        data: {
          email,
          password,
          first_name: "Test",
          last_name: "User",
          is_admin: false,
        },
      }
    );

    // Login via UI
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout")').first();
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Expect redirect to login
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });
});
