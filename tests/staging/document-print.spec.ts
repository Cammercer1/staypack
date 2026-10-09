import { expect, test } from "@playwright/test";

for (const [kind, expectedMm] of [["business-card", 90], ["sales-brochure", 210]] as const) {
  test(`${kind}: printed page width matches its paper size with and without QR`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => { errors.push(`Unexpected API: ${route.request().url()}`); return route.abort(); });
    for (const qr of ["off", "on"]) {
      await page.goto(`/dev/document-print?kind=${kind}&qr=${qr}`);
      await page.emulateMedia({ media: "print" });
      const widths = await page.evaluate(() => ({
        body: document.body.getBoundingClientRect().width,
        page: document.querySelector(".collateral-page, .report-page")!.getBoundingClientRect().width,
      }));
      expect(Math.abs(widths.body - expectedMm * 96 / 25.4)).toBeLessThan(1);
      expect(Math.abs(widths.page - widths.body)).toBeLessThan(1);
      await expect(page.locator('img[src^="data:image/png"]')).toHaveCount(qr === "on" ? 1 : 0);
    }
    expect(errors).toEqual([]);
  });
}
