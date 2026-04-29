import { test, expect } from "@playwright/test";

/**
 * Tests E2E des raccourcis clavier sur le wizard /orders/new.
 *
 * Couverture :
 *  - Sélection au clavier de bout en bout (S1 → S2 → grille qty)
 *  - Auto-avance + annulation par Échap
 *  - Désactivation des raccourcis quand un input/textarea a le focus
 *  - Ouverture de l'overlay d'aide via "?"
 */

test.describe("Raccourcis clavier — wizard nouvelle commande", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/orders/new");
    // S'assurer que le store est vide pour un parcours déterministe
    await page.evaluate(() => localStorage.removeItem("dtf:new-order:draft"));
    await page.reload();
    // Les catégories sont rendues
    await expect(
      page.locator('[role="radiogroup"][aria-label="Catégorie de produit"] [role="radio"]'),
    ).toHaveCount(6);
  });

  test("S1 : touche 1 sélectionne Textile et déclenche l'auto-avance", async ({ page }) => {
    // Le focus est sur body — pas d'input actif
    await page.locator("body").click();

    await page.keyboard.press("1");

    // Catégorie Textile sélectionnée
    const selected = page.locator(
      '[role="radiogroup"][aria-label="Catégorie de produit"] [role="radio"][aria-checked="true"]',
    );
    await expect(selected).toHaveAttribute(
      "aria-label",
      /Catégorie Textile/,
    );

    // L'overlay AutoAdvance est visible
    await expect(page.locator('[data-auto-advance="true"]')).toBeVisible();

    // Après ~400 ms, l'overlay disparaît (onComplete a fired)
    await expect(page.locator('[data-auto-advance="true"]')).toBeHidden({
      timeout: 1000,
    });
  });

  test("S1 : Esc pendant le décompte annule l'auto-avance", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("1");
    await expect(page.locator('[data-auto-advance="true"]')).toBeVisible();

    // Esc immédiat → annulation
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-auto-advance="true"]')).toBeHidden();

    // La sélection reste en place
    await expect(
      page.locator(
        '[role="radiogroup"][aria-label="Catégorie de produit"] [role="radio"][aria-checked="true"]',
      ),
    ).toHaveAttribute("aria-label", /Catégorie Textile/);
  });

  test("S2 : H/F changent le genre, 1/2/3 changent le modèle", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("1"); // Textile
    // Attendre la fin de l'auto-avance pour s'assurer que S2 est bien rendu
    await expect(page.locator('[data-auto-advance="true"]')).toBeHidden({ timeout: 1000 });

    // Reprendre le focus sur body avant de presser des raccourcis
    await page.locator("body").click();

    await page.keyboard.press("f");
    await expect(
      page.locator('[role="radiogroup"][aria-label="Genre"] [role="radio"][aria-checked="true"]'),
    ).toContainText("Femme");

    await page.locator("body").click();
    await page.keyboard.press("2");
    await expect(
      page.locator('[role="radiogroup"][aria-label="Modèle de textile"] [role="radio"][aria-checked="true"]'),
    ).toHaveAttribute("aria-label", /Classic/);
  });

  test("Désactivation : un input avec focus avale les touches numériques", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("1"); // Textile
    await expect(page.locator('[data-auto-advance="true"]')).toBeHidden({ timeout: 1000 });

    // Avancer manuellement à l'étape 3 pour révéler la textarea "Note additionnelle"
    // En pratique, on teste avec le textarea Notes qui existe en step 3.
    // À défaut, on teste sur un input quelconque rendu en step 1.
    // Le wizard a une textarea Notes (step 3) — on attend qu'un textarea soit visible.
    // Pour un test fiable sans changer d'étape, on crée un input éphémère et on le focus.
    await page.evaluate(() => {
      const i = document.createElement("input");
      i.id = "test-input";
      i.type = "text";
      document.body.appendChild(i);
      i.focus();
    });

    // Pré-condition : input focus
    await expect(page.locator("#test-input")).toBeFocused();

    // Press "2" — ne doit PAS changer la catégorie
    await page.keyboard.press("2");

    // La catégorie reste Textile
    await expect(
      page.locator(
        '[role="radiogroup"][aria-label="Catégorie de produit"] [role="radio"][aria-checked="true"]',
      ),
    ).toHaveAttribute("aria-label", /Catégorie Textile/);

    // Cleanup
    await page.evaluate(() => document.querySelector("#test-input")?.remove());
  });

  test('Overlay "?" : s\'ouvre puis se ferme via Esc', async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("?");
    await expect(
      page.locator('[role="dialog"][aria-labelledby="shortcuts-help-title"]'),
    ).toBeVisible();
    await expect(page.locator("#shortcuts-help-title")).toHaveText(
      "Raccourcis clavier actifs",
    );

    await page.keyboard.press("Escape");
    await expect(
      page.locator('[role="dialog"][aria-labelledby="shortcuts-help-title"]'),
    ).toBeHidden();
  });

  test("Parcours complet S1→S2 sans souris", async ({ page }) => {
    await page.locator("body").click();

    // S1 : Textile
    await page.keyboard.press("1");
    await expect(page.locator('[data-auto-advance="true"]')).toBeHidden({ timeout: 1000 });

    // S2 : Femme + Premium
    await page.locator("body").click();
    await page.keyboard.press("f");
    await page.locator("body").click();
    await page.keyboard.press("3");

    // Le modèle Premium est sélectionné
    await expect(
      page.locator('[role="radiogroup"][aria-label="Modèle de textile"] [role="radio"][aria-checked="true"]'),
    ).toHaveAttribute("aria-label", /Premium/);

    // Auto-avance vers la grille de qty fait son office (focus sur un input)
    await expect(page.locator('[data-auto-advance="true"]')).toBeHidden({ timeout: 1000 });
  });
});
