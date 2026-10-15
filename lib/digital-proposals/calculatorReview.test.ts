import { expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReviewIdentity";
import { calculateAccommodates } from "@/lib/reports/formatters";

vi.mock("server-only", () => ({}));
import { publishProposal } from "./server";

it("blocks a pending calculator review before loading a proposal workspace or publishing a version", async () => {
  const { report } = createLintRegressionFixtures();
  report.user_overrides_json = { calculatorReview: { status: "pending", propertyKey: "property" } };
  const from = vi.fn();
  const context = { report, supabase: { from }, sourceFingerprint: "current" } as unknown as Parameters<typeof publishProposal>[0];
  const before = structuredClone(report);
  await expect(publishProposal(context, 1, "current")).rejects.toMatchObject({ status: 409, message: "Confirm the property details before publishing this proposal." });
  expect(from).not.toHaveBeenCalled();
  expect(report).toEqual(before);
});

it.each([undefined, "verified"] as const)("preserves the existing stale-preview guard when calculator review is %s", async status => {
  const { report, listing } = createLintRegressionFixtures();
  report.user_overrides_json = status ? { calculatorReview: { status, propertyKey: calculatorPropertyReviewKey(listing) },
    estimateInputs: { bedrooms: listing.bedrooms!, bathrooms: listing.bathrooms!, accommodates: calculateAccommodates(listing.bedrooms, listing.accommodates) } } : null;
  const context = { report, listing, sourceFingerprint: "current", needsEvidenceReview: false } as Parameters<typeof publishProposal>[0];
  await expect(publishProposal(context, 1, "outdated")).rejects.toMatchObject({ status: 409, message: "The appraisal changed. Reload the preview before publishing." });
});

it.each(["property_address", "bedrooms", "bathrooms", "accommodates"] as const)("blocks a new version after the reviewed %s changes", async field => {
  const { report, listing } = createLintRegressionFixtures();
  report.user_overrides_json = { calculatorReview: { status: "verified", propertyKey: calculatorPropertyReviewKey(listing) },
    estimateInputs: { bedrooms: listing.bedrooms!, bathrooms: listing.bathrooms!, accommodates: calculateAccommodates(listing.bedrooms, listing.accommodates) } };
  if (field === "property_address") listing.property_address = "2/24 Different Street";
  else listing[field] = (listing[field] ?? 0) + 1;
  const from = vi.fn();
  const context = { report, listing, supabase: { from }, sourceFingerprint: "current" } as unknown as Parameters<typeof publishProposal>[0];
  await expect(publishProposal(context, 1, "current")).rejects.toMatchObject({ status: 409, message: "Confirm the property details before publishing this proposal." });
  expect(from).not.toHaveBeenCalled();
});
