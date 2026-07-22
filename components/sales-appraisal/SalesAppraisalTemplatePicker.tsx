"use client";

import { useEffect } from "react";
import { useAvailableTemplates } from "@/components/templates/useAvailableTemplates";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (templateId: string) => void;
};

export function SalesAppraisalTemplatePicker({ value, onChange }: Props) {
  const { data, loading } = useAvailableTemplates("sales_appraisal");
  const templates = data?.templates ?? [];
  const resolvedValue = templates.some((template) => template.id === value)
    ? value
    : data?.default_template_id ?? value;
  const selected = templates.find((template) => template.id === resolvedValue);
  const currentFamily = selected?.family ?? "classic";

  useEffect(() => {
    if (!loading && data && value !== resolvedValue) {
      onChange(resolvedValue);
    }
  }, [data, loading, onChange, resolvedValue, value]);

  function handleChange(family: string) {
    const match = templates.find((template) => template.family === family);
    if (match) {
      onChange(match.id);
    }
  }

  if (loading && templates.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading templates…</p>;
  }

  if (templates.length === 1) {
    const template = templates[0];
    return (
      <div className="rounded-xl border border-primary bg-primary/5 p-4">
        <p className="font-medium">{template.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your agency template is applied automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => handleChange(template.family ?? template.id)}
          className={cn(
            "w-full rounded-xl border p-4 text-left transition-colors",
            currentFamily === (template.family ?? template.id)
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40",
          )}
        >
          <p className="font-medium">{template.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {template.pages} pages · Page 2 always shows REA sold &amp; for-sale
            comparables · {template.default_blurb_length} blurb
          </p>
        </button>
      ))}
    </div>
  );
}
