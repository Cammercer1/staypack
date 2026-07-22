"use client";

import { useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAvailableTemplates } from "@/components/templates/useAvailableTemplates";
import { getCollateralPageFormatLabel } from "@/lib/collateral/pageFormat";
import type { TemplateApiEntry } from "@/lib/templates/serializeForApi";
import type { CollateralType } from "@/lib/types";
import { cn } from "@/lib/utils";

type PageTab = "1" | "2";

type BrochureCollateralType = Extract<
  CollateralType,
  "sales_brochure" | "rental_brochure"
>;

type Props = {
  value: string;
  onChange: (templateId: string) => void;
  defaultTemplateId?: string;
  collateralType?: BrochureCollateralType;
};

export function SalesBrochureTemplatePicker({
  value,
  onChange,
  defaultTemplateId,
  collateralType = "sales_brochure",
}: Props) {
  const product =
    collateralType === "rental_brochure" ? "rental_brochure" : "sales_brochure";
  const { data, loading } = useAvailableTemplates(product);
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);
  const onePageTemplates = useMemo(
    () => templates.filter((t) => t.pages === 1),
    [templates],
  );
  const twoPageTemplates = useMemo(
    () => templates.filter((t) => t.pages === 2),
    [templates],
  );
  const resolvedValue = templates.some((template) => template.id === value)
    ? value
    : data?.default_template_id ?? value;

  const selectedPages = useMemo(() => {
    const match =
      onePageTemplates.find((t) => t.id === resolvedValue) ??
      twoPageTemplates.find((t) => t.id === resolvedValue);
    return match?.pages === 2 ? 2 : 1;
  }, [resolvedValue, onePageTemplates, twoPageTemplates]);

  const pageTab: PageTab = selectedPages === 2 ? "2" : "1";

  useEffect(() => {
    if (!loading && data && value !== resolvedValue) {
      onChange(resolvedValue);
    }
  }, [data, loading, onChange, resolvedValue, value]);

  const effectiveDefaultTemplateId =
    data?.default_template_id ?? defaultTemplateId;
  const isAgencyDefault =
    effectiveDefaultTemplateId != null &&
    resolvedValue === effectiveDefaultTemplateId;

  function handleTabChange(next: string) {
    const tab = next as PageTab;
    const pool = tab === "1" ? onePageTemplates : twoPageTemplates;
    if (!pool.some((template) => template.id === value) && pool[0]) {
      onChange(pool[0].id);
    }
  }

  if (loading && onePageTemplates.length === 0 && twoPageTemplates.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading templates…</p>;
  }

  if (templates.length === 1) {
    return (
      <div className="rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
        <p className="font-medium leading-tight">{templates[0].label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your agency template is applied automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs value={pageTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="1">1 page</TabsTrigger>
          <TabsTrigger value="2">2 pages</TabsTrigger>
        </TabsList>

        <TabsContent value="1" className="mt-3 space-y-2">
          <TemplateOptionList
            templates={onePageTemplates}
            value={value}
            onChange={onChange}
          />
        </TabsContent>

        <TabsContent value="2" className="mt-3 space-y-2">
          <TemplateOptionList
            templates={twoPageTemplates}
            value={value}
            onChange={onChange}
          />
        </TabsContent>
      </Tabs>

      {effectiveDefaultTemplateId != null ? (
        <p className="text-xs text-muted-foreground">
          {isAgencyDefault
            ? "Using your agency default brochure template."
            : "Overriding the agency default for this brochure."}
        </p>
      ) : null}
    </div>
  );
}

function TemplateOptionList({
  templates,
  value,
  onChange,
}: {
  templates: TemplateApiEntry[];
  value: string;
  onChange: (templateId: string) => void;
}) {
  return (
    <>
      {templates.map((template) => {
        const selected = value === template.id;
        const formatLabel = getCollateralPageFormatLabel("a4-portrait");

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            className={cn(
              "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border/70 hover:border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-tight">{template.label}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                {formatLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {template.description}
            </p>
          </button>
        );
      })}
    </>
  );
}
