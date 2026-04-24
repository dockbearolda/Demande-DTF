import { Page, expect } from "@playwright/test";

const API_URL = process.env.VITE_API_URL || "http://localhost:8000";

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export async function registerAdmin(
  apiUrl: string = API_URL
): Promise<AuthTokens> {
  const response = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `admin-${Date.now()}@test.com`,
      password: "Test1234!",
      first_name: "Admin",
      last_name: "Test",
      is_admin: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to register admin: ${response.statusText}`);
  }

  return response.json();
}

export async function setAuthTokens(
  page: Page,
  tokens: AuthTokens
): Promise<void> {
  await page.context().addCookies([
    {
      name: "access_token",
      value: tokens.access_token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Also set in localStorage for SPA
  await page.evaluate((token) => {
    localStorage.setItem("access_token", token);
  }, tokens.access_token);
}

export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard");
}

export async function expectToastError(
  page: Page,
  expectedText: string
): Promise<void> {
  const toast = page.locator('[role="alert"]');
  await expect(toast).toContainText(expectedText);
}

export async function createClientViaAPI(
  apiUrl: string = API_URL,
  token: string,
  clientData?: Partial<any>
): Promise<any> {
  const data = {
    name: `Client-${Date.now()}`,
    email: `client-${Date.now()}@test.com`,
    phone: "0123456789",
    address: "123 Main St",
    city: "Test City",
    zip_code: "75001",
    ...clientData,
  };

  const response = await fetch(`${apiUrl}/clients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create client: ${response.statusText}`);
  }

  return response.json();
}

export async function createOrderViaAPI(
  apiUrl: string = API_URL,
  token: string,
  clientId: number,
  orderData?: Partial<any>
): Promise<any> {
  const data = {
    reference: `ORD-${Date.now()}`,
    client_id: clientId,
    status: "PENDING",
    total_amount: 1000,
    ...orderData,
  };

  const response = await fetch(`${apiUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create order: ${response.statusText}`);
  }

  return response.json();
}
