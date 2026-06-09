/** Re-exports for backward compatibility — prefer direct imports from submodules. */
export {
  BLURB_LENGTHS,
  BLURB_PARAGRAPH_COUNTS,
  BLURB_PARAGRAPH_MAX,
  BLURB_VARIANT_LABELS,
  getBlurbVariantsAiContract,
  getBlurbVariantsPromptLimits,
  type BlurbLength,
  type BlurbVariantsParagraphs,
  type BlurbVariantsStored,
} from "@/lib/copy/blurbVariantConstants";

export {
  blurbVariantsParagraphsToStored,
  blurbVariantsStoredToParagraphs,
  enforceBlurbParagraphs,
  enforceBlurbVariantsParagraphs,
  mockBlurbVariantsFromText,
  paragraphsToVariantText,
  variantTextToParagraphs,
  normalizeBlurbVariantsFromCopy,
  blurbBlocksForLength,
} from "@/lib/copy/blurbVariantEnforce";

export {
  defaultBlurbLengthForTemplateId,
  isBoldLayoutTemplate,
  resolveTemplateBlurbLength,
} from "@/lib/copy/blurbTemplateDefaults";

export {
  resolveBrochureCopyForTemplate,
  resolveCopyForTemplate,
  resolveReportCopyForTemplate,
} from "@/lib/copy/resolveCopyForTemplate";
