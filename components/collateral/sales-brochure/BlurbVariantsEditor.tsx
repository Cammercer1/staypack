"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BLURB_LENGTHS,
  BLURB_VARIANT_LABELS,
  blurbVariantsStoredToParagraphs,
  enforceBlurbVariantsParagraphs,
  paragraphsToVariantText,
  type BlurbLength,
} from "@/lib/copy/blurbVariants";
import type { BrochureCopyJson } from "@/lib/collateral/templates/types";

type BlurbVariantsEditorCopy = Pick<
  BrochureCopyJson,
  | "heading"
  | "blurb"
  | "blurb_variants"
  | "property_highlights"
  | "inspection_cta"
  | "disclaimer"
> & { blurb_blocks?: BrochureCopyJson["blurb_blocks"] };

type Props = {
  copy: BlurbVariantsEditorCopy;
  onChange: (copy: BrochureCopyJson) => void;
};

export function BlurbVariantsEditor({ copy, onChange }: Props) {
  const variants = copy.blurb_variants ?? {
    short: copy.blurb,
    medium: copy.blurb,
    long: copy.blurb,
  };
  const paragraphs = blurbVariantsStoredToParagraphs(variants);

  function updateLength(length: BlurbLength, text: string) {
    const parts = text.split(/\n\n+/).map((p) => p.trim());
    const nextParagraphs = { ...paragraphs, [length]: parts };
    const enforced = enforceBlurbVariantsParagraphs(nextParagraphs);
    const blurb_variants = {
      short: paragraphsToVariantText(enforced.short),
      medium: paragraphsToVariantText(enforced.medium),
      long: paragraphsToVariantText(enforced.long),
    };
    onChange({
      ...copy,
      blurb_variants,
      blurb: blurb_variants.medium,
      blurb_blocks: enforced.medium
        .filter(Boolean)
        .map((paragraph) => ({ type: "paragraph" as const, text: paragraph })),
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Three AI lengths — separate paragraphs with a blank line between them for medium
        and long.
      </p>
      {BLURB_LENGTHS.map((length) => (
        <div key={length} className="space-y-1.5">
          <Label htmlFor={`blurb-variant-${length}`}>{BLURB_VARIANT_LABELS[length]}</Label>
          <Textarea
            id={`blurb-variant-${length}`}
            rows={length === "short" ? 3 : length === "medium" ? 5 : 7}
            value={paragraphs[length].join("\n\n")}
            onChange={(event) => updateLength(length, event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
