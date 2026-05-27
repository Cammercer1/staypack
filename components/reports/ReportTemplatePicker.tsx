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
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{template.label}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {template.tier}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {template.description}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {template.pages} A4 {template.pages === 1 ? "page" : "pages"}
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
