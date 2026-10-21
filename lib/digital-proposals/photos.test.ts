import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { createProposalFixture } from "./fixtures";
import { availableProposalPhotos, proposalPhotoSelectionSchema, withProposalPhotos } from "./photos";
import { DEFAULT_PROPOSAL_DRAFT, proposalDraftSchema } from "./template";
import { applyAssignment, defaultAssignment } from "./assignment";
import { buildProposalPdfReport, withPdfPhotos } from "./pdfReport";
import { replaceProposalImages } from "./imageSnapshot";

const cover = "https://property.test/cover.jpg";
const second = "https://property.test/second.jpg";
const selection = { heroImageUrl: cover, gallery: [second, cover] };

it("offers valid current property photos and older report photos once without changing either source", () => {
  const data = createProposalFixture();
  data.property.heroImageUrl = cover;
  data.property.gallery = [cover, "/saved-report-photo.jpg", ""];
  const listing = { uploaded_image_urls: [second, "javascript:alert(1)"], scraped_listing_json: { images: [cover, "data:image/png;base64,bad", "https://img.youtube.com/vi/video.jpg"] } };
  const before = structuredClone({ data, listing });
  expect(availableProposalPhotos(listing as Parameters<typeof availableProposalPhotos>[0], data)).toEqual([cover, "/saved-report-photo.jpg", second]);
  expect({ data, listing }).toEqual(before);
});

it("keeps existing drafts compatible and preserves proposal photo overrides when applying agency defaults", () => {
  const fixture = createLintRegressionFixtures();
  expect(proposalDraftSchema.parse(DEFAULT_PROPOSAL_DRAFT)).not.toHaveProperty("propertyImages");
  const draft = proposalDraftSchema.parse({ ...DEFAULT_PROPOSAL_DRAFT, propertyImages: selection });
  expect(applyAssignment(draft, defaultAssignment(fixture.agency)).propertyImages).toEqual(selection);
});

it.each([
  { heroImageUrl: "", gallery: [cover] },
  { heroImageUrl: cover, gallery: [] },
  { heroImageUrl: cover, gallery: [second] },
  { heroImageUrl: "javascript:alert(1)", gallery: ["javascript:alert(1)"] },
])("rejects incomplete or unsafe photo selections: %j", invalid => {
  expect(proposalPhotoSelectionSchema.safeParse(invalid).success).toBe(false);
});

it("can read a frozen selection when different source URLs preserve to the same immutable image", () => {
  const permanent = "https://assets.test/published-image.jpg";
  const frozen = replaceProposalImages(selection, new Map([[cover, permanent], [second, permanent]]));
  expect(proposalPhotoSelectionSchema.parse(frozen)).toEqual({ heroImageUrl: permanent, gallery: [permanent, permanent] });
});

it("applies the same cover and ordered gallery to web and PDF without mutating the source or selection", () => {
  const data = createProposalFixture();
  const fixture = createLintRegressionFixtures();
  const pdf = buildProposalPdfReport({ ...fixture.report.final_report_json!, template_id: "haven-properties-str" })!;
  const before = structuredClone({ data, pdf, selection });
  const web = withProposalPhotos(data, selection);
  const print = withPdfPhotos(pdf, selection);
  expect(web.property.heroImageUrl).toBe(print.property.hero_image_url);
  expect(web.property.gallery).toEqual(print.property.selected_image_urls);
  expect(web.property.gallery).toEqual([second, cover]);
  web.property.gallery.reverse();
  print.property.selected_image_urls.pop();
  expect({ data, pdf, selection }).toEqual(before);
  expect(withProposalPhotos(data)).toBe(data);
  expect(withPdfPhotos(pdf)).toBe(pdf);
});
