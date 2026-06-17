import { describe, expect, it } from "vitest";
import { BLURB_PARAGRAPH_MAX } from "@/lib/copy/blurbVariantConstants";
import {
  pageOneFromAiShape,
  pageOneMarketingCopyAiSchema,
} from "@/lib/copy/pageOneMarketingCopy";

describe("pageOneMarketingCopyAiSchema", () => {
  it("rejects blurbs over the paragraph character limit", () => {
    const overLimit = "x".repeat(BLURB_PARAGRAPH_MAX + 1);
    const parsed = pageOneMarketingCopyAiSchema.safeParse({
      heading: "Heading",
      blurb_short: "Short blurb",
      blurb_medium_paragraphs: ["Medium one", "Medium two"],
      blurb_long_paragraphs: ["Long one", overLimit, "Long three"],
      bullets: ["One", "Two", "Three", "Four"],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("pageOneFromAiShape", () => {
  it("preserves validated paragraphs without adding an ellipsis", () => {
    const longTwo = "Luxury finishes throughout the home.".padEnd(280, " ");
    const pageOne = pageOneFromAiShape({
      heading: "Heading",
      blurb_short: "Short blurb",
      blurb_medium_paragraphs: ["Medium one", "Medium two"],
      blurb_long_paragraphs: ["Long one", longTwo.trim(), "Long three"],
      bullets: ["One", "Two", "Three", "Four"],
    });

    expect(pageOne.blurb_variants.long).not.toContain("…");
    expect(pageOne.blurb_variants.long.split(/\n\n+/)[1]?.length).toBeLessThanOrEqual(
      BLURB_PARAGRAPH_MAX,
    );
  });
});
