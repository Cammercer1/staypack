import { z } from "zod";
import type { Agency, AiCopyJson } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";
import { formatCurrency } from "@/lib/reports/formatters";
import type { StrEstimate } from "@/lib/types";
import {
  BLURB_PARAGRAPH_COUNTS,
  getBlurbVariantsAiContract,
  getBlurbVariantsPromptLimits,
  type BlurbVariantsParagraphs,
  type BlurbVariantsStored,
} from "@/lib/copy/blurbVariantConstants";
import {
  blurbVariantsParagraphsToStored,
  blurbVariantsStoredToParagraphs,
  enforceBlurbVariantsParagraphs,
  normalizeBlurbVariantsParagraphs,
} from "@/lib/copy/blurbVariantEnforce";
import { BLURB_PARAGRAPH_MAX } from "@/lib/copy/blurbVariantConstants";

/** Shared page-1 marketing copy contract (STR / lease / sale brochures). */
export const PAGE_ONE_HEADING_MAX = 90;
/** @deprecated Use BLURB_PARAGRAPH_MAX per paragraph in blurb variants. */
export const PAGE_ONE_BLURB_MAX = 350;
export const PAGE_ONE_BULLET_COUNT = 4;
export const PAGE_ONE_BULLET_MAX = 140;

export type PageOneMarketingCopy = {
  heading: string;
  bullets: string[];
  blurb_variants: BlurbVariantsStored;
};

export const pageOneMarketingCopyAiSchema = z.object({
  heading: z.string().max(PAGE_ONE_HEADING_MAX),
  blurb_short: z.string().max(BLURB_PARAGRAPH_MAX),
  blurb_medium_paragraphs: z
    .array(z.string().max(BLURB_PARAGRAPH_MAX))
    .length(BLURB_PARAGRAPH_COUNTS.medium),
  blurb_long_paragraphs: z
    .array(z.string().max(BLURB_PARAGRAPH_MAX))
    .length(BLURB_PARAGRAPH_COUNTS.long),
  bullets: z
    .array(z.string().max(PAGE_ONE_BULLET_MAX))
    .length(PAGE_ONE_BULLET_COUNT),
});

export const PAGE_ONE_COPY_MAX_ATTEMPTS = 3;

export function buildPageOneCopyRepairPrompt(
  payload: unknown,
  invalidJson: unknown,
  validationErrors: unknown,
) {
  return `Repair the invalid JSON below. Every text field must fit within the character limits exactly — shorten over-limit fields with tighter prose; do not truncate with an ellipsis. Return valid JSON matching the schema.

Validation errors:
${JSON.stringify(validationErrors)}

Invalid JSON:
${JSON.stringify(invalidJson)}

Source payload:
${JSON.stringify(payload)}`;
}

export const PAGE_ONE_MARKETING_COPY_JSON_CONTRACT = `Return JSON with exactly these snake_case fields (no other keys):
- heading: string — engaging title, not the street address alone (max ${PAGE_ONE_HEADING_MAX} characters)
- ${getBlurbVariantsAiContract()}
- bullets: array of exactly ${PAGE_ONE_BULLET_COUNT} strings — short feature bullets (max ${PAGE_ONE_BULLET_MAX} characters each)`;

export function getPageOneMarketingCopyPromptLimits() {
  return `Strict character limits (responses over these limits are rejected — rewrite shorter, never truncate):
- heading: max ${PAGE_ONE_HEADING_MAX} characters
- ${getBlurbVariantsPromptLimits()}
- bullets: exactly ${PAGE_ONE_BULLET_COUNT} items, max ${PAGE_ONE_BULLET_MAX} characters each`;
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function pageOneFromAiShape(raw: z.infer<typeof pageOneMarketingCopyAiSchema>): PageOneMarketingCopy {
  const paragraphs = normalizeBlurbVariantsParagraphs({
    short: [raw.blurb_short],
    medium: raw.blurb_medium_paragraphs,
    long: raw.blurb_long_paragraphs,
  });

  return {
    heading: normalizeHeading(raw.heading),
    bullets: raw.bullets.map((item) => normalizeParagraph(String(item))),
    blurb_variants: blurbVariantsParagraphsToStored(paragraphs),
  };
}

function normalizeHeading(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeParagraph(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function enforcePageOneMarketingCopy(
  raw: PageOneMarketingCopy,
): PageOneMarketingCopy {
  const stored = raw.blurb_variants;
  const paragraphs = enforceBlurbVariantsParagraphs(
    stored ? blurbVariantsStoredToParagraphs(stored) : { short: [], medium: [], long: [] },
  );
  const blurb_variants = blurbVariantsParagraphsToStored(paragraphs);

  const bullets = (raw.bullets ?? [])
    .map((item) => truncate(String(item), PAGE_ONE_BULLET_MAX))
    .filter(Boolean)
    .slice(0, PAGE_ONE_BULLET_COUNT);

  while (bullets.length < PAGE_ONE_BULLET_COUNT) {
    bullets.push("");
  }

  return {
    heading: truncate(raw.heading, PAGE_ONE_HEADING_MAX),
    blurb_variants,
    bullets,
  };
}

/** Legacy single-blurb AI responses → all variants use the same text. */
function legacyBlurbToVariants(blurb: string): BlurbVariantsStored {
  const normalized = blurb.replace(/\s+/g, " ").trim();
  return blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: normalized ? [normalized] : [""],
      medium: normalized ? [normalized, ""] : ["", ""],
      long: normalized ? [normalized, "", ""] : ["", "", ""],
    }),
  );
}

export function parsePageOneMarketingCopy(raw: unknown): PageOneMarketingCopy | null {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!source) {
    return null;
  }

  const aiParsed = pageOneMarketingCopyAiSchema.safeParse(source);
  if (aiParsed.success) {
    return pageOneFromAiShape(aiParsed.data);
  }

  const heading =
    typeof source.heading === "string"
      ? source.heading
      : typeof source.sales_pack_heading === "string"
        ? source.sales_pack_heading
        : "";

  const bulletSource = Array.isArray(source.bullets)
    ? source.bullets
    : Array.isArray(source.property_highlights)
      ? source.property_highlights
      : Array.isArray(source.property_appeal_points)
        ? source.property_appeal_points
        : Array.isArray(source.appeal_points)
          ? source.appeal_points
          : [];

  const bullets = bulletSource.map(String).map((item) => item.trim());
  while (bullets.length < PAGE_ONE_BULLET_COUNT) {
    bullets.push("");
  }

  const variantsSource = source.blurb_variants as BlurbVariantsStored | undefined;
  const legacyBlurb =
    typeof source.blurb === "string"
      ? source.blurb
      : typeof source.sales_pack_blurb === "string"
        ? source.sales_pack_blurb
        : "";

  if (variantsSource && typeof variantsSource === "object") {
    return enforcePageOneMarketingCopy({
      heading,
      bullets: bullets.slice(0, PAGE_ONE_BULLET_COUNT),
      blurb_variants: {
        short: String(variantsSource.short ?? legacyBlurb),
        medium: String(variantsSource.medium ?? legacyBlurb),
        long: String(variantsSource.long ?? legacyBlurb),
      },
    });
  }

  const blurb_variants = legacyBlurbToVariants(legacyBlurb);

  if (!heading && !legacyBlurb && bullets.every((b) => !b)) {
    return null;
  }

  return enforcePageOneMarketingCopy({
    heading,
    bullets: bullets.slice(0, PAGE_ONE_BULLET_COUNT),
    blurb_variants,
  });
}

export function pageOneToBrochureCopy(
  pageOne: PageOneMarketingCopy,
  agency: Agency,
): SalesBrochureCopyJson {
  const enforced = enforcePageOneMarketingCopy(pageOne);
  const mediumParagraphs = blurbVariantsStoredToParagraphs(enforced.blurb_variants).medium.filter(
    Boolean,
  );
  const mediumBlocks = mediumParagraphs
    .filter(Boolean)
    .map((text) => ({ type: "paragraph" as const, text }));
  const blurb = mediumBlocks.map((b) => b.text).join("\n\n");

  return {
    heading: enforced.heading,
    blurb,
    blurb_blocks: mediumBlocks,
    blurb_variants: enforced.blurb_variants,
    property_highlights: enforced.bullets.slice(0, PAGE_ONE_BULLET_COUNT),
    inspection_cta: agency.default_cta?.trim() || "",
    disclaimer: agency.default_disclaimer?.trim() || DEFAULT_DISCLAIMER,
  };
}

export function deriveStrKeyMetricsLine(estimate?: Pick<StrEstimate, "annualRevenue"> | null) {
  if (estimate?.annualRevenue == null) {
    return "Estimated gross short-term rental revenue before costs.";
  }
  return `Estimated gross STR revenue ${formatCurrency(estimate.annualRevenue)} per year before costs.`;
}

/** Replace hallucinated gross revenue figures in AI blurbs with the canonical estimate. */
export function enforceCanonicalStrRevenueInText(
  text: string,
  annualRevenue: number,
): string {
  if (!text.trim()) {
    return text;
  }

  const canonical = formatCurrency(annualRevenue);
  const tolerance = annualRevenue * 0.03;

  return text.replace(
    /\$[\d,]+(?:\.\d+)?(?:\s*(?:k|K))?(?:\s*(?:\/|per)\s*(?:year|annum|yr))?/gi,
    (match) => {
      const digits = match.replace(/[^\d]/g, "");
      const value = Number(digits);
      if (!Number.isFinite(value) || value < 1000) {
        return match;
      }
      if (Math.abs(value - annualRevenue) <= tolerance) {
        return match;
      }
      return canonical;
    },
  );
}

function enforceCanonicalStrRevenueInVariants(
  variants: BlurbVariantsStored,
  annualRevenue: number | null | undefined,
): BlurbVariantsStored {
  if (annualRevenue == null) {
    return variants;
  }

  return {
    short: enforceCanonicalStrRevenueInText(variants.short, annualRevenue),
    medium: enforceCanonicalStrRevenueInText(variants.medium, annualRevenue),
    long: enforceCanonicalStrRevenueInText(variants.long, annualRevenue),
  };
}

const DEFAULT_STR_METHODOLOGY =
  "Estimates are derived from comparable short-term rental market data near the subject property.";

/** Fills legacy STR report copy fields not produced by page-one AI. */
export function pageOneToAiCopyJson(
  pageOne: PageOneMarketingCopy,
  agency: Agency,
  estimate?: Pick<StrEstimate, "annualRevenue"> | null,
): AiCopyJson {
  const enforced = enforcePageOneMarketingCopy(pageOne);
  const blurbVariants = enforceCanonicalStrRevenueInVariants(
    enforced.blurb_variants,
    estimate?.annualRevenue,
  );
  const medium = blurbVariantsStoredToParagraphs(blurbVariants).medium
    .filter(Boolean)
    .join("\n\n");

  return {
    sales_pack_heading: enforced.heading,
    sales_pack_blurb: medium,
    sales_pack_blurb_variants: blurbVariants,
    key_metrics_line: deriveStrKeyMetricsLine(estimate),
    property_appeal_points: enforced.bullets.slice(0, PAGE_ONE_BULLET_COUNT),
    performance_supporting_factors: [],
    buyer_checks: [],
    methodology_note: DEFAULT_STR_METHODOLOGY,
    disclaimer: agency.default_disclaimer?.trim() || DEFAULT_DISCLAIMER,
    confidence_notes: "",
  };
}

/** Medium-length blurb as plain text (default active blurb). */
export function pageOneMediumBlurb(pageOne: PageOneMarketingCopy): string {
  const enforced = enforcePageOneMarketingCopy(pageOne);
  return blurbVariantsStoredToParagraphs(enforced.blurb_variants).medium
    .filter(Boolean)
    .join("\n\n");
}
