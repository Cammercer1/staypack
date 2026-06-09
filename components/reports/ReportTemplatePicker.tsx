"use client";

import { useAvailableTemplates } from "@/components/templates/useAvailableTemplates";
import type { ReportTemplateTier } from "@/lib/reports/templates/types";

type Props = {
  value: string;
  /**
   * Inherited from the STR estimate step — controls light vs detailed.
   * When omitted the tier is derived from the current value (useful in dev/playground).
   */
  tier?: ReportTemplateTier;
  onChange: (templateId: string) => void;
};

/** One option per visual family; tier (pages) is inherited from the estimate step. */
export function ReportTemplatePicker({ value, tier: tierProp, onChange }: Props) {
  const { data, loading } = useAvailableTemplates("str");
  const tier: ReportTemplateTier =
    tierProp ?? (value.endsWith("-detailed") ? "detailed" : "light");

  const templates = (data?.templates ?? []).filter(
    (entry) => entry.tier === tier,
  );

  const families = templates.map((entry) => ({
    family: entry.family ?? entry.id.replace(/-(?:light|detailed)$/, ""),
    label: entry.label,
  }));

  const currentFamily = value.replace(/-(?:light|detailed)$/, "");

  function handleChange(family: string) {
    const id = `${family}-${tier}`;
    onChange(id);
  }

  if (loading && families.length === 0) {
    return (
      <select
        disabled
        className="h-8 rounded-md border border-input bg-background px-2.5 py-0 text-sm text-muted-foreground"
      >
        <option>Loading templates…</option>
      </select>
    );
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
