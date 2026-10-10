import { describe, expect, it } from "vitest";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";
import { setStrReportCopyValue } from "./strReportCopyAdapter";
import { resolveCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";

describe("STR inline description edits", () => {
  const copy = {
    ...getStrPlaygroundReport().copy,
    blurb: "First paragraph.\n\nSecond paragraph.",
    blurb_variants: {
      short: "First paragraph.",
      medium: "First paragraph.\n\nSecond paragraph.",
      long: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    },
  };
  it("does not save or shorten stored wording when an unchanged short preview is flushed", () => {
    const displayed = resolveCopyForTemplate({
      copy,
      templateId: "classic-detailed",
      collateral: "str",
    }).blurb;
    expect(
      setStrReportCopyValue(copy, "copy.blurb", displayed, "classic-detailed"),
    ).toBe(copy);
  });
  it("updates the description used by the selected layout and preserves the other long version", () => {
    const updated = setStrReportCopyValue(
      copy,
      "copy.blurb",
      "Edited short description.",
      "classic-detailed",
    );
    expect(
      resolveCopyForTemplate({
        copy: updated,
        templateId: "classic-detailed",
        collateral: "str",
      }).blurb,
    ).toBe("Edited short description.");
    expect(updated.blurb_variants?.long).toBe(copy.blurb_variants.long);
  });
});
