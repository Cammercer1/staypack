"use client";

import { useAvailableTemplates } from "@/components/templates/useAvailableTemplates";
import { normalizeReportTemplateId } from "@/lib/reports/templates/ids";

type Props = {
  value: string;
  onChange: (templateId: string) => void;
};

/** One option per visual family; all STR reports use the detailed (2-page) layout. */
export function ReportTemplatePicker({ value, onChange }: Props) {
  const { data, loading } = useAvailableTemplates("str");

  const templates = data?.templates ?? [];

  const families = templates.map((entry) => ({
    family: entry.family ?? entry.id.replace(/-detailed$/, ""),
    label: entry.label,
  }));

  const normalizedValue = normalizeReportTemplateId(value);
  const currentFamily = normalizedValue.replace(/-detailed$/, "");

  function handleChange(family: string) {
    onChange(`${family}-detailed`);
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
