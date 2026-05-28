"use client";

import { REPORT_TEMPLATES } from "@/lib/reports/templates/registry";
import type { ReportTemplateTier } from "@/lib/reports/templates/types";

type Props = {
  value: string;
  /** Inherited from the STR estimate step — controls light vs detailed. */
  tier: ReportTemplateTier;
  onChange: (templateId: string) => void;
};

/** One option per visual family; tier (pages) is inherited from the estimate step. */
export function ReportTemplatePicker({ value, tier, onChange }: Props) {
  // Deduplicate: one entry per family (use the light variant as the canonical label)
  const families = REPORT_TEMPLATES.filter((t) => t.tier === "light").map((t) => ({
    family: t.family,
    label: t.label,
  }));

  // Derive the current family from the full template ID
  const currentFamily = value.replace(/-(?:light|detailed)$/, "");

  function handleChange(family: string) {
    const id = `${family}-${tier}`;
    onChange(id);
  }

  return (
    <select
      value={currentFamily}
      onChange={(e) => handleChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2.5 py-0 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {families.map((f) => (
        <option key={f.family} value={f.family}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
