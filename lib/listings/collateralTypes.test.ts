import { describe, expect, it } from "vitest";
import {
  collateralOrderForPurpose,
  COLLATERAL_TYPE_META,
} from "@/lib/listings/collateralTypes";

describe("listing collateral cards", () => {
  it("does not show business cards for sale or lease listings", () => {
    expect(collateralOrderForPurpose("sale")).not.toContain(
      "agent_business_card",
    );
    expect(collateralOrderForPurpose("lease")).not.toContain(
      "agent_business_card",
    );
  });

  it("uses outcome-led appraisal descriptions without provider mechanics", () => {
    const descriptions = [
      COLLATERAL_TYPE_META.sales_appraisal.description,
      COLLATERAL_TYPE_META.lease_appraisal.description,
    ];

    expect(descriptions.join(" ")).not.toMatch(/\bREA\b|Airbtics/i);
    expect(COLLATERAL_TYPE_META.sales_appraisal.description).toContain(
      "estimated sale price range",
    );
    expect(COLLATERAL_TYPE_META.lease_appraisal.description).toContain(
      "estimated weekly rent range",
    );
  });

  it("uses terminology agents use with vendors and landlords", () => {
    expect(COLLATERAL_TYPE_META.sales_appraisal.label).toBe(
      "Property appraisal",
    );
    expect(COLLATERAL_TYPE_META.lease_appraisal.label).toBe("Rental appraisal");
    expect(COLLATERAL_TYPE_META.str_report.label).toBe(
      "Short-term rental appraisal",
    );
    expect(COLLATERAL_TYPE_META.sales_brochure.label).toBe(
      "Property brochure",
    );
    expect(COLLATERAL_TYPE_META.investor_snapshot.label).toBe(
      "Investment report",
    );
  });
});
