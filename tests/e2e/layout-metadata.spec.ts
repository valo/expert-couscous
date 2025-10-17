import { expect, test } from "@playwright/test";

test.describe("Root layout metadata", () => {
  test("includes Open Graph tags in the document head", async ({ page }) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    await page.goto("/");

    const ogTitle = page.locator('head meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", "Dibor Leverage Engine");

    const ogDescription = page.locator('head meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute(
      "content",
      "Secure stablecoin infrastructure and seamless swaps built for the next generation of on-chain finance.",
    );

    const ogImage = page.locator('head meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /logo\.png$/);

    const ogUrl = page.locator('head meta[property="og:url"]');
    await expect(ogUrl).toHaveAttribute("content", siteUrl);
  });
});
