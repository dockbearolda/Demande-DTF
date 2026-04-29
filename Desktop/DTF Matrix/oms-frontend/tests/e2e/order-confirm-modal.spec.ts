import { test, expect, Page } from "@playwright/test";

/**
 * Focus management & keyboard shortcuts contract for the final recap modal (S10).
 *
 * The recap drives a high-volume operator flow (~200 orders/day), so Enter to
 * confirm, Escape to dismiss, Tab cycling, and focus restoration must hold up
 * across browsers. These tests drive the wizard via the textile category to
 * reach step 3, open the modal, then assert the keyboard contract.
 */

async function reachConfirmModal(page: Page) {
  await page.goto("/orders/new");

  // Step 1: Textile is the default-selected category and ECO model is preselected.
  // Tick a color and add a quantity to make the line valid.
  // The grid uses checkbox + a "+" button per size cell. We pick the first row,
  // first size, and bump qty to 3.
  const firstColorCheckbox = page.locator('input[type="checkbox"]').first();
  await firstColorCheckbox.check({ force: true });

  const plusButtons = page.locator('button:has-text("+")');
  await plusButtons.first().click();
  await plusButtons.first().click();
  await plusButtons.first().click();

  // Step 1 → Step 2
  await page.getByRole("button", { name: /Étape suivante/ }).click();
  // Step 2 → Step 3
  await page.getByRole("button", { name: /Étape suivante/ }).click();

  // Step 3: client name + operator
  await page.locator("#field-clientNom").fill("Test Client SA");
  await page.locator("#field-clientNom").blur();
  await page.getByRole("radio", { name: "Loïc" }).click();

  // Open the modal
  await page.getByRole("button", { name: /Créer la commande/ }).click();

  // Wait for the dialog
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
}

test.describe("OrderConfirmModal — focus & keyboard", () => {
  test("auto-focuses the primary CTA on open", async ({ page }) => {
    await reachConfirmModal(page);
    const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
    await expect(confirmBtn).toBeFocused();
  });

  test("Escape closes the modal", async ({ page }) => {
    await reachConfirmModal(page);
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[role="dialog"][aria-modal="true"]'),
    ).toHaveCount(0);
  });

  test("Tab traps focus inside the modal (forward wrap)", async ({ page }) => {
    await reachConfirmModal(page);
    // Focus starts on confirm (last interactive element). Tab should wrap to
    // the first focusable inside the modal — the close (X) button.
    const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
    await confirmBtn.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Fermer" })).toBeFocused();
  });

  test("Shift+Tab from the close button wraps to the confirm button", async ({
    page,
  }) => {
    await reachConfirmModal(page);
    await page.getByRole("button", { name: "Fermer" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator('[data-testid="modal-confirm-btn"]')).toBeFocused();
  });

  test("focus is restored to the trigger after closing", async ({ page }) => {
    await reachConfirmModal(page);
    await page.keyboard.press("Escape");
    // The trigger was the "Créer la commande" submit button on step 3.
    // After close, focus should land back on it.
    const trigger = page.getByRole("button", { name: /Créer la commande/ });
    await expect(trigger).toBeFocused();
  });

  test('Modifier ↗ link on the "Produit" section navigates back to step 1', async ({
    page,
  }) => {
    await reachConfirmModal(page);
    await page
      .getByRole("button", { name: "Modifier le produit" })
      .click();
    await expect(
      page.locator('[role="dialog"][aria-modal="true"]'),
    ).toHaveCount(0);
    // Step 1 marker — the category radiogroup is visible on step 1
    await expect(
      page.getByRole("radiogroup", { name: "Catégorie de produit" }),
    ).toBeVisible();
  });

  test("renders 'Personne à joindre' card even when empty", async ({ page }) => {
    await reachConfirmModal(page);
    await expect(
      page.getByText("Personne à joindre", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Aucun contact spécifique défini", { exact: false }),
    ).toBeVisible();
  });

  test("keyboard hint badges are visible on the action buttons", async ({
    page,
  }) => {
    await reachConfirmModal(page);
    const confirm = page.locator('[data-testid="modal-confirm-btn"]');
    const cancel = page.locator('[data-testid="modal-cancel-btn"]');
    await expect(confirm).toContainText("Enter");
    await expect(cancel).toContainText("Esc");
  });
});
