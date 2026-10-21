import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { proposalFromAppraisalReport } from "@/lib/digital-proposals/data";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { ProposalHero } from "./DigitalProposal";

it.each(["str", "lease", "sales"] as const)("uses singular property feature labels on the %s cover", kind => {
  const data = kind === "str" ? createProposalFixture() : proposalFromAppraisalReport(createLintRegressionFixtures()[kind].final_report_json!, kind);
  Object.assign(data.property, { bedrooms: 1, bathrooms: 1, carSpaces: 1, guests: 1 });
  const html = renderToStaticMarkup(<ProposalHero data={data} draft={DEFAULT_PROPOSAL_DRAFT} brand={BRAND_DEFAULTS} />);
  const text = html.replace(/<[^>]+>/g, "");
  for (const feature of ["bedroom", "bathroom", "car space"]) {
    expect(text).toContain(`1 ${feature}`);
    expect(text).not.toContain(`1 ${feature}s`);
  }
  if (kind === "str") { expect(text).toContain("1 guest"); expect(text).not.toContain("1 guests"); }
  else expect(text).not.toContain("guest");
});

it.each(["overlay", "split", "panorama"] as const)("keeps the selected cover without a gallery button on the %s cover", heroLayout => {
  const data = createProposalFixture();
  data.property.gallery = [data.property.heroImageUrl, "https://example.com/selected-kitchen.jpg"];
  const draft = { ...DEFAULT_PROPOSAL_DRAFT, heroLayout };
  expect(renderToStaticMarkup(<ProposalHero data={data} draft={draft} brand={BRAND_DEFAULTS} />)).not.toContain("View property photos");
  const selected = { ...draft, propertyImages: { heroImageUrl: data.property.heroImageUrl, gallery: data.property.gallery } };
  const html = renderToStaticMarkup(<ProposalHero data={data} draft={selected} brand={BRAND_DEFAULTS} />);
  expect(html).not.toContain("View property photos");
  expect(html).toContain(data.property.heroImageUrl.replace(/&/g, "&amp;"));
});
