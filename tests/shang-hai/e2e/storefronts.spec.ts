import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The same purchase journey, driven through the shared test contract, on each of the
 * three Shang Hai storefronts (demo checkout: nothing is charged).
 *
 * Contract every storefront implements (data-testid):
 *   go-to-menu, menu-search, add-<itemId>, cart-open, cart-panel,
 *   cart-line-<itemId> > qty-inc | qty-dec | line-remove | line-qty, cart-total,
 *   checkout-start, checkout form inputs name="name|phone|email|notes",
 *   checkout-pay, order-status[data-status], order-number, demo-advance.
 */

const STOREFRONTS = ["ink-house", "wok-after-dark", "bento-club"] as const;

const visible = (l: Locator) => l.filter({ visible: true }).first();

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);
}

async function openCart(page: Page) {
  const panel = page.getByTestId("cart-panel");
  if (!(await panel.isVisible())) await visible(page.getByTestId("cart-open")).click();
  await expect(panel).toBeVisible();
  return panel;
}

async function search(page: Page, query: string) {
  const box = visible(page.getByTestId("menu-search"));
  await box.fill(query);
}

for (const storefront of STOREFRONTS) {
  test.describe(storefront, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`showcase/shang-hai/${storefront}/`);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
    });

    test("complete demo purchase journey", async ({ page }) => {
      const errors = trackErrors(page);
      await expectNoHorizontalOverflow(page);

      // 1-2. Open the site and go to the menu
      await visible(page.getByTestId("go-to-menu")).click();

      // 3-4. Search a dish and add it
      await search(page, "pato pekin");
      await visible(page.getByTestId("add-pato-a-la-pekinesa")).click();

      // 5. Add another dish
      await search(page, "gyozas");
      await visible(page.getByTestId("add-gyozas-de-pollo-a-la-plancha")).click();

      // 6-8. Open the cart, change a quantity, remove a dish
      const panel = await openCart(page);
      const gyozas = panel.getByTestId("cart-line-gyozas-de-pollo-a-la-plancha");
      await gyozas.getByTestId("qty-inc").click();
      await expect(gyozas.getByTestId("line-qty")).toHaveText(/2/);
      await panel.getByTestId("cart-line-pato-a-la-pekinesa").getByTestId("line-remove").click();
      await expect(panel.getByTestId("cart-line-pato-a-la-pekinesa")).toHaveCount(0);
      // 2 x 6,45 €
      await expect(panel.getByTestId("cart-total")).toContainText("12,90");

      // 9. Checkout
      await visible(panel.getByTestId("checkout-start")).click();
      await expect(page).toHaveURL(/\/pedido\/$/);
      await expectNoHorizontalOverflow(page);

      // 10. Customer details (also checks validation first)
      await visible(page.getByTestId("checkout-pay")).click();
      await expect(page.locator('[name="name"]')).toHaveAttribute("aria-invalid", "true");
      await page.locator('[name="name"]').fill("Lucía Martínez");
      await page.locator('[name="phone"]').fill("612 345 678");
      await page.locator('[name="email"]').fill("lucia@example.es");
      await page.locator('[name="notes"]').fill("Sin cebolla, por favor.");

      // 11. Simulated payment
      await visible(page.getByTestId("checkout-pay")).click();
      await expect(page).toHaveURL(/pago-demo/);
      await expect(page.getByText("Demostración — no se realizará ningún cargo")).toBeVisible();
      await page.getByTestId("demo-pay-approve").click();

      // 12. Confirmation reflects the (simulated) backend state
      await expect(page).toHaveURL(new RegExp(`${storefront}/pedido/estado/`));
      const status = visible(page.getByTestId("order-status"));
      await expect(status).toHaveAttribute("data-status", "paid");
      await expect(visible(page.getByTestId("order-number"))).toContainText("DEMO-");
      await visible(page.getByTestId("demo-advance")).click();
      await expect(status).toHaveAttribute("data-status", "preparing");
      await expectNoHorizontalOverflow(page);

      // The paid order empties the cart
      await page.goto(`showcase/shang-hai/${storefront}/`);
      await expect(page.getByTestId("cart-line-gyozas-de-pollo-a-la-plancha")).toHaveCount(0);

      expect(errors).toEqual([]);
    });

    test("cart survives a reload and closes with Escape", async ({ page }) => {
      await visible(page.getByTestId("go-to-menu")).click();
      await search(page, "combo a");
      await visible(page.getByTestId("add-combo-a")).click();
      await page.reload();
      const panel = await openCart(page);
      await expect(panel.getByTestId("cart-line-combo-a")).toBeVisible();
      await expect(panel.getByTestId("cart-total")).toContainText("19,45");
      const isModal = (await panel.getAttribute("aria-modal")) === "true";
      if (isModal) {
        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
      }
    });

    test("prices pending confirmation cannot be ordered", async ({ page }) => {
      await visible(page.getByTestId("go-to-menu")).click();
      await search(page, "cerveza china");
      await expect(page.getByTestId("add-cerveza-china").filter({ visible: true })).toHaveCount(0);
      await expect(page.getByText(/precio pendiente de confirmar/i).first()).toBeVisible();
    });

    test("cancelled payment returns to the order with a notice", async ({ page }) => {
      await page.goto(`showcase/shang-hai/${storefront}/pedido/?cancelado=1`);
      await expect(page.getByText(/pago cancelado/i).first()).toBeVisible();
    });
  });
}

test("comparison page links to the three proposals", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("showcase/shang-hai/");
  for (const s of STOREFRONTS) {
    await expect(page.locator(`a[href$="/showcase/shang-hai/${s}/"]`).first()).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("the original ATELIER site and MERIDIA showcase still render", async ({ page }) => {
  for (const path of ["", "menu/", "showcase/", "showcase/luxury-dark/"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  }
});
