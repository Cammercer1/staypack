import { describe, expect, it } from "vitest";
import { resolveReportDisplayPrice } from "./resolveReportDisplayPrice";
describe("STR comparison sale price", () => {
  it("uses the explicit sale price ahead of a legacy weekly rental price", () => {
    expect(resolveReportDisplayPrice({ advertised_sale_price: "$1,200,000", listing_purpose: "lease", display_price: "$800 per week", scraped_listing_json: null })).toBe("$1,200,000");
  });
  it("never uses weekly rental pricing as a purchase price", () => {
    expect(resolveReportDisplayPrice({ listing_purpose: "lease", display_price: "$800 per week", scraped_listing_json: null })).toBeNull();
  });
  it("respects a deliberately cleared sale price", () => {
    expect(resolveReportDisplayPrice({ advertised_sale_price: null, listing_purpose: "sale", display_price: "$1,200,000", scraped_listing_json: null })).toBeNull();
  });
});
