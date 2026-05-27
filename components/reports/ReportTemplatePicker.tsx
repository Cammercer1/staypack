"use client";

import { cn } from "@/lib/utils";
import { REPORT_TEMPLATES } from "@/lib/reports/templates/registry";

type Props = {
  value: string;
  onChange: (templateId: string) => void;
  defaultTemplateId?: string;
};

export function ReportTemplatePicker({
  value,
  onChange,
  defaultTemplateId,
}: Props) {
  const isAgencyDefault = defaultTemplateId != null && value === defaultTemplateId;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_TEMPLATES.map((template) => {
          const selected = value === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/70 hover:border-border",
              )}
            >
              <p className="font-medium">{template.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {template.description}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {template.pages} A4 pages
              </p>
            </button>
          );
        })}
      </div>

      {defaultTemplateId != null ? (
        <p className="text-xs text-muted-foreground">
          {isAgencyDefault
            ? "Using your agency default template."
            : "Overriding the agency default for this report."}
        </p>
      ) : null}
    </div>
  );
}
