import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { hasAppraisalReportChanges } from "./hasAppraisalReportChanges";

it.each(["lease", "sales"] as const)("detects persisted %s evidence and design changes after reload", kind => {
  const fixture = createLintRegressionFixtures();
  const report = fixture[kind];
  expect(hasAppraisalReportChanges(fixture.listing, report, kind)).toBe(false);
  expect(hasAppraisalReportChanges(fixture.listing, { ...report, template_id: "different-design" }, kind)).toBe(true);
  const listing = structuredClone(fixture.listing);
  listing.appraisal_overrides_json = kind === "lease"
    ? { lease: { weeklyMin: 1400, weeklyMax: 1600, weeklyMidpoint: 1500 } }
    : { sales: { priceMin: 2600000, priceMax: 2800000, priceMidpoint: 2700000 } };
  expect(hasAppraisalReportChanges(listing, report, kind)).toBe(true);
});

it.each(["lease", "sales"] as const)("detects changes to the selected %s comparable evidence", kind => {
  const fixture = createLintRegressionFixtures();
  const listing = structuredClone(fixture.listing);
  const appraisal = kind === "lease" ? listing.scraped_listing_json!.rentalAppraisal! : listing.scraped_listing_json!.salesAppraisal!;
  appraisal.selectedCompListingIds = appraisal.selectedCompListingIds!.slice(1);
  expect(hasAppraisalReportChanges(listing, fixture[kind], kind)).toBe(true);
});
