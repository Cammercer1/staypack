import { expect, it } from "vitest";
import { listingDocuments } from "./documents";
import { collateralOrderForPurpose } from "./collateralTypes";
import { collateralPurposeMismatchError } from "./collateralPurposeGuard";
import { createEmptyListingDraft } from "./emptyListingDraft";
import { appraisalInputFingerprint } from "@/lib/appraisals/resolveAppraisalInput";
import type { Report, CollateralItem } from "@/lib/types";
const listing = createEmptyListingDraft({
  id: "property",
  property_address: "1 Test St",
  bedrooms: 3,
});
const report = {
  id: "report",
  template_id: "sales-appraisal-classic",
  status: "generated",
  updated_at: "2026-10-01",
  listing_id: listing.id,
} as Report;
it("offers sales, rental and STR documents for either property purpose", () => {
  for (const purpose of ["sale", "lease"] as const) {
    expect(collateralOrderForPurpose(purpose)).toEqual(
      expect.arrayContaining([
        "sales_appraisal",
        "lease_appraisal",
        "str_report",
        "sales_brochure",
        "rental_brochure",
      ]),
    );
    for (const type of collateralOrderForPurpose(purpose))
      expect(
        collateralPurposeMismatchError({ listing_purpose: purpose }, type),
      ).toBeNull();
  }
});
it("keeps every report and deduplicates its collateral record", () => {
  const rows = listingDocuments(
    listing,
    [report, { ...report, id: "second" }],
    [
      {
        id: "linked",
        report_id: report.id,
        type: "sales_appraisal",
        status: "draft",
      } as CollateralItem,
    ],
  );
  expect(rows).toHaveLength(2);
  expect(rows[0].href).toContain(`reportId=${report.id}`);
});
it("surfaces stale appraisal evidence and excludes archived records", () => {
  const changed = {
    ...listing,
    bedrooms: 4,
    scraped_listing_json: {
      images: [],
      agents: [],
      warnings: [],
      confidence: "high" as const,
      appraisalInputFingerprints: { sales: appraisalInputFingerprint(listing) },
    },
  };
  const rows = listingDocuments(
    changed,
    [report, { ...report, id: "archived", status: "archived" }],
    [],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("Needs updating");
});
it("exposes public sharing only after publication and keeps errors actionable", () => {
  const rows = listingDocuments(
    listing,
    [{ ...report, status: "failed", public_url: "https://example.com/old" }],
    [],
  );
  expect(rows[0].status).toBe("Needs attention");
  expect(rows[0].publicUrl).toBeNull();
});

import { getListingImagePool } from "./collateralImages";
it("excludes imported video placeholders without altering original data", () => {
  const images = [
    "https://img.youtube.com/1200x900-fit,format=webp/vi/abc/0.jpg",
    "https://example.com/photo.jpg",
  ];
  const original = {
    ...listing,
    scraped_listing_json: {
      images,
      agents: [],
      warnings: [],
      confidence: "high" as const,
    },
  };
  expect(getListingImagePool(original)).toEqual([images[1]]);
  expect(original.scraped_listing_json.images).toEqual(images);
});
