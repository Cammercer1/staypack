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

  const options = templates.map((entry) => ({
    id: entry.id,
    label: entry.label,
  }));

  const normalizedValue = normalizeReportTemplateId(value);
  const selectedValue = options.some((option) => option.id === normalizedValue)
    ? normalizedValue
    : data?.default_template_id ?? normalizedValue;

  if (loading && options.length === 0) {
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
      value={selectedValue}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2.5 py-0 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
