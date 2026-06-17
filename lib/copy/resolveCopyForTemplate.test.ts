import { describe, expect, it } from "vitest";
import { mockBlurbVariantsFromText } from "@/lib/copy/blurbVariantEnforce";
import { resolveCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";
import { BLURB_PARAGRAPH_COUNTS } from "@/lib/copy/blurbVariantConstants";

const variants = mockBlurbVariantsFromText("Opening paragraph about the property.");

describe("resolveCopyForTemplate", () => {
  it("uses long blurb for minimalist STR template", () => {
    const resolved = resolveCopyForTemplate({
      copy: { heading: "Test", blurb: "fallback", blurb_variants: variants },
      templateId: "minimalist-detailed",
      collateral: "str",
    });
    expect(resolved.blurb_blocks).toHaveLength(
      BLURB_PARAGRAPH_COUNTS.long,
    );
  });

  it("uses long blurb for bold sales brochure", () => {
    const resolved = resolveCopyForTemplate({
      copy: { heading: "Test", blurb: "fallback", blurb_variants: variants },
      templateId: "sales-brochure-bold-1pg",
      collateral: "sale",
    });
    expect(resolved.blurb_blocks).toHaveLength(BLURB_PARAGRAPH_COUNTS.long);
  });

  it("uses long blurb for haven STR via template metadata", () => {
    const resolved = resolveCopyForTemplate({
      copy: { heading: "Test", blurb: "fallback", blurb_variants: variants },
      templateId: "haven-properties-str",
      collateral: "str",
    });
    expect(resolved.blurb_blocks).toHaveLength(BLURB_PARAGRAPH_COUNTS.long);
  });

  it("uses long blurb for belle STR and sales brochure", () => {
    for (const templateId of [
      "belle-property-str",
      "belle-property-lease-appraisal",
      "sales-brochure-belle-2pg",
    ]) {
      const resolved = resolveCopyForTemplate({
        copy: { heading: "Test", blurb: "fallback", blurb_variants: variants },
        templateId,
        collateral: templateId.startsWith("sales-brochure") ? "sale" : "str",
      });
      expect(resolved.blurb_blocks).toHaveLength(BLURB_PARAGRAPH_COUNTS.long);
    }
  });
});
