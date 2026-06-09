"use client";

import { PLAYGROUND_LAYOUT_FAMILIES } from "@/lib/reports/templates/playgroundResolve";
import {
  isBoldLayoutTemplate,
  defaultBlurbLengthForTemplateId,
} from "@/lib/copy/blurbTemplateDefaults";
import { salesBrochureTemplateIdForFamily } from "@/lib/reports/templates/salesBrochureFamilyMap";
import {
  BLURB_LENGTHS,
  BLURB_VARIANT_LABELS,
  type BlurbLength,
} from "@/lib/copy/blurbVariantConstants";
import type { BrochureCopyJson } from "@/lib/collateral/templates/types";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import { cn } from "@/lib/utils";

type Props = {
  copy: BrochureCopyJson;
  collateral: ReportPageVariant;
  pages: 1 | 2;
  /** Layout family currently shown in the preview — only this row updates the preview. */
  activeFamilyId?: string;
  onChange: (copy: BrochureCopyJson) => void;
  className?: string;
};

const SALE_FAMILIES = PLAYGROUND_LAYOUT_FAMILIES;

/** Keys must match `resolveTemplateBlurbLength` / `resolveReportForTemplatePreview` (brochure template ids). */
function blurbMappingTemplateId(
  familyId: string,
  collateral: ReportPageVariant,
  pages: 1 | 2,
): string {
  return salesBrochureTemplateIdForFamily(
    familyId,
    collateral === "sale" ? pages : 1,
  );
}

export function BlurbLengthMappingPanel({
  copy,
  collateral,
  pages,
  activeFamilyId,
  onChange,
  className,
}: Props) {
  const mapping = copy.template_blurb_length ?? {};

  function setLength(templateId: string, length: BlurbLength) {
    onChange({
      ...copy,
      template_blurb_length: {
        ...(copy.template_blurb_length ?? {}),
        [templateId]: length,
      },
    });
  }

  const rows = SALE_FAMILIES.map((family) => ({
    key: family.id,
    label:
      collateral === "sale"
        ? family.label
        : `${family.label} (${collateral})`,
    templateId: blurbMappingTemplateId(family.id, collateral, pages),
  }));

  return (
    <div className={cn("space-y-2 rounded-lg border bg-background p-3", className)}>
      <div>
        <p className="text-xs font-medium">Blurb length per layout</p>
        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
          AI generates short (1¶), medium (2¶), and long (3¶). The preview uses the row
          for the layout selected below
          {activeFamilyId ? ` (${SALE_FAMILIES.find((f) => f.id === activeFamilyId)?.label ?? activeFamilyId})` : ""}
          . Bold is always long.
        </p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const boldLocked = isBoldLayoutTemplate(row.templateId, collateral);
          const current = boldLocked
            ? "long"
            : mapping[row.templateId] ??
              defaultBlurbLengthForTemplateId(row.templateId, collateral);
          return (
            <li
              key={row.templateId}
              className="flex items-center justify-between gap-2 text-[0.7rem]"
            >
              <span
                className={cn(
                  "min-w-0 truncate font-medium",
                  activeFamilyId === row.key && "text-foreground",
                )}
              >
                {row.label}
                {activeFamilyId === row.key ? (
                  <span className="ml-1 font-normal text-muted-foreground">· preview</span>
                ) : null}
              </span>
              <select
                className="h-7 max-w-[11rem] shrink-0 rounded-md border bg-background px-2 text-[0.65rem] disabled:cursor-default disabled:opacity-70"
                value={current}
                disabled={boldLocked}
                title={boldLocked ? "Bold always uses the long blurb" : undefined}
                onChange={(event) =>
                  setLength(row.templateId, event.target.value as BlurbLength)
                }
              >
                {BLURB_LENGTHS.map((length) => (
                  <option key={length} value={length}>
                    {BLURB_VARIANT_LABELS[length]}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
