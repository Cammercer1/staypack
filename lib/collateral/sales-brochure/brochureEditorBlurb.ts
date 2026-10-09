import {
  blurbBlocksToPlainText,
  normalizeBlurbBlocksForEditor,
} from "./blurbBlocks";
import {
  resolveCopyForTemplate,
  collateralForReportTemplate,
} from "@/lib/copy/resolveCopyForTemplate";
import { resolveBlurbLengthForTemplate } from "@/lib/copy/blurbTemplateDefaults";
import { normalizeBlurbVariantsFromCopy } from "@/lib/copy/blurbVariantEnforce";
import type {
  BrochureBlurbBlock,
  BrochureCopyJson,
} from "@/lib/collateral/templates/types";

/** Use the same template-specific description in the editor and final document. */
export function getBrochureEditorBlurb(
  copy: BrochureCopyJson,
  templateId: string,
): BrochureBlurbBlock[] {
  const resolved = resolveCopyForTemplate({
    copy,
    templateId,
    collateral: collateralForReportTemplate(templateId),
  });
  const blocks = normalizeBlurbBlocksForEditor(copy.blurb_blocks ?? []);
  return blocks.length &&
    blurbBlocksToPlainText(blocks).trim() === resolved.blurb.trim()
    ? blocks
    : resolved.blurb_blocks;
}

/** Update only the description length used by this layout, keeping other designs' copy. */
export function setBrochureEditorBlurb(
  copy: BrochureCopyJson,
  blocks: BrochureBlurbBlock[],
  templateId: string,
): BrochureCopyJson {
  const blurb_blocks = normalizeBlurbBlocksForEditor(blocks);
  const blurb = blurbBlocksToPlainText(blurb_blocks);
  const length = resolveBlurbLengthForTemplate(
    templateId,
    collateralForReportTemplate(templateId),
  );
  return {
    ...copy,
    blurb,
    blurb_blocks,
    blurb_variants: {
      ...normalizeBlurbVariantsFromCopy(copy),
      [length]: blurb,
    },
  };
}
