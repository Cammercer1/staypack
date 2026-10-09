import { describe, expect, it } from "vitest";
import { createPlaygroundSalesBrochureDocument } from "./playgroundFixture";
import {
  getBrochureEditorBlurb,
  setBrochureEditorBlurb,
} from "./brochureEditorBlurb";
import { coerceSalesBrochureDocument } from "./coerceBrochureDocument";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";

const templateId = "sales-brochure-classic-2pg";
describe("brochure description matches the chosen layout", () => {
  const document = createPlaygroundSalesBrochureDocument();
  const copy = {
    ...document.copy,
    blurb: "Original long source description",
    blurb_variants: {
      short: "Short template copy",
      medium: "Medium template copy",
      long: "Long template copy",
    },
  };
  it("shows the template wording in the editor without changing source copy", () => {
    expect(getBrochureEditorBlurb(copy, templateId)).toEqual([
      { type: "paragraph", text: "Short template copy" },
    ]);
    expect(copy.blurb).toBe("Original long source description");
  });
  it("saves edits into the active length and uses them in the final document", () => {
    const updated = setBrochureEditorBlurb(
      copy,
      [{ type: "paragraph", text: "Reviewed description" }],
      templateId,
    );
    const rendered = coerceSalesBrochureDocument({
      ...document,
      template_id: templateId,
      copy: updated,
    });
    expect(rendered.copy.blurb).toBe("Reviewed description");
    expect(updated.blurb_variants?.medium).toBe("Medium template copy");
    expect(updated.blurb_variants?.long).toBe("Long template copy");
  });
  it("keeps formatted paragraphs for layouts whose saved wording matches those blocks", () => {
    const blocks: BrochureBlurbBlock[] = [
      { type: "paragraph", text: "First paragraph" },
      { type: "heading", text: "Local lifestyle" },
      { type: "paragraph", text: "Second paragraph" },
    ];
    const boldId = "sales-brochure-bold-2pg";
    const updated = setBrochureEditorBlurb(copy, blocks, boldId);
    const rendered = coerceSalesBrochureDocument({
      ...document,
      template_id: boldId,
      copy: updated,
    });
    expect(rendered.copy.blurb_blocks).toEqual(blocks);
  });
});
