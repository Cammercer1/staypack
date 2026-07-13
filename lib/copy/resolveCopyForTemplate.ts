import { blurbBlocksToPlainText } from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { BrochureBlurbBlock, BrochureCopyJson } from "@/lib/collateral/templates/types";
import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";
import {
  blurbBlocksForLength,
  normalizeBlurbVariantsFromCopy,
} from "@/lib/copy/blurbVariantEnforce";
import { resolveBlurbLengthForTemplate } from "@/lib/copy/blurbTemplateDefaults";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

export type CopyWithVariants = Partial<BrochureCopyJson> &
  Pick<BrochureCopyJson, "heading" | "blurb"> & {
    blurb_blocks?: BrochureBlurbBlock[];
    blurb_variants?: BrochureCopyJson["blurb_variants"];
    template_blurb_length?: BrochureCopyJson["template_blurb_length"];
  };

export type ResolveCopyForTemplateInput = {
  copy: CopyWithVariants;
  templateId: string;
  collateral: ReportPageVariant;
  /** Dev playground only — per-template length overrides on stored copy. */
  allowDevBlurbLengthMap?: boolean;
};

export type ResolvedCopyForTemplate = CopyWithVariants & {
  blurb: string;
  blurb_blocks: BrochureBlurbBlock[];
  blurb_variants: NonNullable<BrochureCopyJson["blurb_variants"]>;
};

export function resolveCopyForTemplate({
  copy,
  templateId,
  collateral,
  allowDevBlurbLengthMap = false,
}: ResolveCopyForTemplateInput): ResolvedCopyForTemplate {
  const variants = normalizeBlurbVariantsFromCopy({
    blurb: copy.blurb,
    blurb_blocks: copy.blurb_blocks ?? [],
    blurb_variants: copy.blurb_variants,
  });
  const length = resolveBlurbLengthForTemplate(
    templateId,
    collateral,
    allowDevBlurbLengthMap ? copy : undefined,
  );
  const blurb_blocks = blurbBlocksForLength(
    { blurb: copy.blurb, blurb_variants: variants },
    length,
  );
  const blurb = blurbBlocksToPlainText(blurb_blocks) || copy.blurb || "";

  return {
    ...copy,
    blurb_variants: variants,
    blurb,
    blurb_blocks,
  };
}

export function collateralForReportTemplate(templateId: string): ReportPageVariant {
  if (templateId.includes("sales-appraisal")) {
    return "sales_appraisal";
  }
  if (templateId.includes("lease-appraisal")) {
    return "lease";
  }
  if (templateId.startsWith("rental-brochure-")) {
    return "lease";
  }
  if (templateId.startsWith("sales-brochure-")) {
    return "sale";
  }
  return "str";
}

export function resolveReportCopyForTemplate(
  report: FinalReportJson,
  options?: {
    templateId?: string;
    collateral?: ReportPageVariant;
    allowDevBlurbLengthMap?: boolean;
  },
): FinalReportJson {
  const templateId = options?.templateId ?? report.template_id;
  const collateral =
    options?.collateral ?? collateralForReportTemplate(templateId);
  const resolved = resolveCopyForTemplate({
    copy: {
      ...report.copy,
      blurb_variants: report.copy.blurb_variants,
      template_blurb_length: (report.copy as CopyWithVariants).template_blurb_length,
    },
    templateId,
    collateral,
    allowDevBlurbLengthMap: options?.allowDevBlurbLengthMap,
  });

  return {
    ...report,
    copy: {
      ...report.copy,
      blurb: resolved.blurb,
      blurb_variants: resolved.blurb_variants,
    },
  };
}

/** @deprecated Use resolveCopyForTemplate */
export function resolveBrochureCopyForTemplate(
  copy: BrochureCopyJson,
  templateId: string,
  collateral: ReportPageVariant = "sale",
  allowDevBlurbLengthMap = false,
): BrochureCopyJson {
  const resolved = resolveCopyForTemplate({
    copy,
    templateId,
    collateral,
    allowDevBlurbLengthMap,
  });
  return {
    ...copy,
    blurb: resolved.blurb,
    blurb_blocks: resolved.blurb_blocks,
    blurb_variants: resolved.blurb_variants,
  };
}
