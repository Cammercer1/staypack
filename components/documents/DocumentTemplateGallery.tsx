"use client";

import { useEffect, type ReactNode } from "react";
import { Check, LayoutTemplate, RefreshCw } from "lucide-react";
import {
  useAvailableTemplates,
  type TemplatesResponse,
} from "@/components/templates/useAvailableTemplates";
import { cn } from "@/lib/utils";
import type { TemplateProduct } from "@/lib/templates/types";

export function DocumentTemplateGallery({
  product,
  initialTemplates,
  value,
  onChange,
  renderPreview,
  disabled,
  onReady,
  filterByPages = false,
  description,
}: {
  product: TemplateProduct;
  initialTemplates?: TemplatesResponse;
  value: string;
  onChange: (id: string) => void;
  renderPreview: (id: string) => ReactNode;
  filterByPages?: boolean;
  description: string;
  disabled?: boolean;
  onReady: (ready: boolean) => void;
}) {
  const { data, loading, error, reload } = useAvailableTemplates(
    product,
    initialTemplates,
  );
  const templates = data?.templates ?? [];
  const resolvedValue = templates.some((template) => template.id === value)
    ? value
    : data?.default_template_id || templates[0]?.id;
  useEffect(() => {
    onReady(!loading && !error && Boolean(resolvedValue));
    if (!loading && resolvedValue && resolvedValue !== value)
      onChange(resolvedValue);
  }, [loading, error, resolvedValue, value, onChange, onReady]);

  if (error || (!loading && !templates.length))
    return (
      <div
        role="alert"
        className="du-alert du-alert-error du-alert-soft flex flex-col items-start"
      >
        <p>{error || "No templates are available for your account."}</p>
        <button
          type="button"
          className="du-btn du-btn-sm min-h-11"
          onClick={reload}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading designs"
        className="grid grid-cols-2 gap-3"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-xl border border-base-300 p-3">
            <div className="du-skeleton h-40 w-full" />
            <div className="du-skeleton mt-3 h-4 w-2/3" />
          </div>
        ))}
        <span className="sr-only">Loading designs…</span>
      </div>
    );
  const selectedTemplate = templates.find(
    (template) => template.id === resolvedValue,
  );
  const pages = selectedTemplate?.pages ?? 1;
  const visibleTemplates = filterByPages
    ? templates.filter((template) => template.pages === pages)
    : templates;
  return (
    <div className="min-w-0 space-y-4">
      {filterByPages ? (
        <div className="flex gap-2" aria-label="Brochure length">
          {[1, 2].map((count) => (
            <button
              key={count}
              type="button"
              className={cn(
                "du-btn du-btn-sm min-h-11 flex-1",
                count === pages ? "du-btn-primary" : "du-btn-outline",
              )}
              aria-pressed={count === pages}
              disabled={
                disabled ||
                !templates.some((template) => template.pages === count)
              }
              onClick={() => {
                const next = templates.find(
                  (template) => template.pages === count,
                );
                if (next) onChange(next.id);
              }}
            >{`${count} ${count === 1 ? "page" : "pages"}`}</button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{visibleTemplates.length} agency-ready designs</span>
        <span className="hidden sm:inline">Select to preview</span>
        <span className="sm:hidden">Swipe to browse</span>
      </div>
      <div
        className="grid auto-cols-[10rem] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2"
        aria-label="Report designs"
      >
        {visibleTemplates.map((template) => {
          const selected = value === template.id;
          const preview = renderPreview(template.id);
          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(template.id)}
              className={cn(
                "group min-w-0 overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-base-300 bg-base-100 hover:border-primary/50",
              )}
            >
              <div
                aria-hidden="true"
                inert
                className="pointer-events-none border-b border-base-300 bg-base-200 p-2"
              >
                {preview ? (
                  preview
                ) : (
                  <LayoutTemplate className="mx-auto h-40 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {template.label}
                  </span>
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {template.pages} {template.pages === 1 ? "page" : "pages"} ·{" "}
                  {template.scope === "agency"
                    ? "Agency design"
                    : "Branded report"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
