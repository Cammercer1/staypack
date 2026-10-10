import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { brochurePriceFormSchema, formatBrochurePrice, initialBrochurePrice } from "./brochurePrice";

describe("brochure setup price", () => {
  it("never uses a sale price or an appraisal estimate as an advertised weekly rent", () => {
    const { listing, collateral } = createLintRegressionFixtures();
    expect(initialBrochurePrice(listing, { ...collateral, type: "rental_brochure", document_json: null })).toBe("");
    expect(initialBrochurePrice({ ...listing, advertised_weekly_rent: "$900" }, { ...collateral, type: "rental_brochure", document_json: null })).toBe("$900 per week");
  });
  it("prefers the saved brochure price over later listing changes", () => {
    const { listing, collateral, document } = createLintRegressionFixtures();
    expect(initialBrochurePrice({ ...listing, advertised_sale_price: "$1,000,000" }, { ...collateral, document_json: { ...document, copy: { ...document.copy, price_value: "Auction" } } })).toBe("Auction");
  });
  it("rejects empty and overlong prices", () => {
    expect(brochurePriceFormSchema.safeParse({ price_value: "   " }).success).toBe(false);
    expect(brochurePriceFormSchema.safeParse({ price_value: "a".repeat(61) }).success).toBe(false);
  });
  it("formats entered amounts and keeps non-numeric selling methods", () => {
    expect(formatBrochurePrice("850", true)).toBe("$850 per week");
    expect(formatBrochurePrice("$850 per week", true)).toBe("$850 per week");
    expect(formatBrochurePrice("1200000", false)).toBe("$1,200,000");
    expect(formatBrochurePrice("Auction", false)).toBe("Auction");
    expect(formatBrochurePrice("Contact agent", true)).toBe("Contact Agent");
  });
});
