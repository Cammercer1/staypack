import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { generateLeaseAppraisalCopy } from "./generateLeaseAppraisalCopy";
import { generateSalesAppraisalCopy } from "./generateSalesAppraisalCopy";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));

function response(blurb = "A private rear apartment with character details and timber flooring.") {
  return { choices: [{ message: { content: JSON.stringify({
    heading: "Art Deco character near the coast", blurb_short: blurb,
    blurb_medium_paragraphs: [blurb, "The kitchen opens to a casual dining area."],
    blurb_long_paragraphs: [blurb, "The kitchen opens to a casual dining area.", "The home includes bedroom storage and laundry facilities."],
    bullets: ["Private rear setting", "Timber flooring", "Character details", "Bedroom storage"],
  }) } }] };
}

async function generate(kind: "lease" | "sales") {
  const { listing, agency } = createLintRegressionFixtures();
  listing.country = "AU";
  listing.listing_description = "A renovated apartment with high ceilings and timber flooring, in a building of 12. Private rear setting with minimal entry stairs.";
  const parsed = resolveAppraisalInput(listing);
  if (kind === "lease") return generateLeaseAppraisalCopy({ agency, listing, parsed, compCount: 6, weeklyMin: 540, weeklyMax: 590 });
  return generateSalesAppraisalCopy({ agency, listing, parsed, soldCompCount: 6, forSaleCompCount: 0, priceMin: 835000, priceMax: 925000 });
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key-no-network");
  mocks.create.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe.each(["lease", "sales"] as const)("%s appraisal copy validation", kind => {
  it("repairs mixed-script text before returning marketing copy", async () => {
    mocks.create.mockResolvedValueOnce(response("A tightly held lifestyle位置.")).mockResolvedValueOnce(response("A café nearby and a character façade enhance the setting."));
    const copy = await generate(kind);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(copy)).not.toContain("位置");
    expect(copy.blurb).toContain("café");
    expect(mocks.create.mock.calls[1][0].messages[1].content).toContain("unexpected non-Latin");
  });

  it("falls back to stored property facts if generated text remains invalid", async () => {
    mocks.create.mockResolvedValue(response("A tightly held lifestyle位置."));
    const copy = await generate(kind);
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(copy.blurb).toContain("renovated apartment");
    expect(JSON.stringify(copy)).not.toMatch(/位置|elevated position|PropRadar|\bREA\b/);
  });

  it("rejects unsupported elevation in otherwise valid generated text", async () => {
    mocks.create.mockResolvedValueOnce(response("An elevated position provides a relaxed setting.")).mockResolvedValueOnce(response());
    const copy = await generate(kind);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(copy.blurb).not.toContain("elevated position");
  });
});

it.each([
  "The rent sits toward the upper end of local one-bedroom rental expectations.",
  "A strong rental yield supports the investment.",
  "The weekly rental guide is competitive for this market.",
])("rejects unsupported rental positioning: %s", async blurb => {
  mocks.create.mockResolvedValueOnce(response(blurb)).mockResolvedValueOnce(response());
  const copy = await generate("lease");
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(copy.blurb).not.toContain(blurb);
});
