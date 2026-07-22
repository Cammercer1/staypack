"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!loading && data && value !== selectedValue) {
      onChange(selectedValue);
    }
  }, [data, loading, onChange, selectedValue, value]);

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

  if (options.length === 1) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-muted/30 px-2.5 text-sm">
        <span className="font-medium">{options[0].label}</span>
        <span className="text-xs text-muted-foreground">Agency template</span>
      </div>
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
