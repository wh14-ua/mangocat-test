import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated accessibility audit (axe-core, WCAG 2.1 A/AA rules) of the Shang Hai pages.
 * Fails on serious or critical violations; moderate/minor ones are printed for review.
 * Automated checks catch only part of WCAG: keyboard and screen-reader passes are manual.
 */

const STOREFRONTS = ["ink-house", "wok-after-dark", "bento-club"] as const;

async function audit(page: Page, label: string) {
  // Wait for entrance animations so contrast is measured on the final state.
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const minor = results.violations.filter((v) => !blocking.includes(v));
  if (minor.length) {
    console.log(`[a11y] ${label}: ${minor.map((v) => `${v.id}(${v.nodes.length})`).join(", ")}`);
  }
  expect(
    blocking.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
    })),
    `${label}: serious/critical axe violations`,
  ).toEqual([]);
}

test.use({ reducedMotion: "reduce" });

for (const storefront of STOREFRONTS) {
  test(`${storefront}: home and checkout pass axe`, async ({ page }) => {
    await page.goto(`showcase/shang-hai/${storefront}/`);
    await audit(page, `${storefront} home`);

    await page.getByTestId("menu-search").filter({ visible: true }).first().fill("combo a");
    await page.getByTestId("add-combo-a").filter({ visible: true }).first().click();
    await page.goto(`showcase/shang-hai/${storefront}/pedido/`);
    await audit(page, `${storefront} checkout`);
  });
}

test("comparison, credits and demo payment pages pass axe", async ({ page }) => {
  await page.goto("showcase/shang-hai/");
  await audit(page, "comparison");
  await page.goto("showcase/shang-hai/creditos/");
  await audit(page, "credits");
  await page.goto("showcase/shang-hai/pago-demo/");
  await audit(page, "demo payment (no order)");
});
