"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCollateralPageFormatLabel } from "@/lib/collateral/pageFormat";
import { getSalesBrochureTemplatesByPageCount } from "@/lib/collateral/templates/sales-brochure/registry";
import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";
import { cn } from "@/lib/utils";

type PageTab = "1" | "2";

type Props = {
  value: string;
  onChange: (templateId: string) => void;
  defaultTemplateId?: string;
};

export function SalesBrochureTemplatePicker({
  value,
  onChange,
  defaultTemplateId,
}: Props) {
  const onePageTemplates = useMemo(
    () => getSalesBrochureTemplatesByPageCount(1),
    [],
  );
  const twoPageTemplates = useMemo(
    () => getSalesBrochureTemplatesByPageCount(2),
    [],
  );

  const selectedPages = useMemo(() => {
    const match =
      onePageTemplates.find((t) => t.id === value) ??
      twoPageTemplates.find((t) => t.id === value);
    return match?.pages === 2 ? 2 : 1;
  }, [value, onePageTemplates, twoPageTemplates]);

  const [pageTab, setPageTab] = useState<PageTab>(
    selectedPages === 2 ? "2" : "1",
  );

  useEffect(() => {
    setPageTab(selectedPages === 2 ? "2" : "1");
  }, [selectedPages]);

  const isAgencyDefault = defaultTemplateId != null && value === defaultTemplateId;

  function handleTabChange(next: string) {
    const tab = next as PageTab;
    setPageTab(tab);
    const pool = tab === "1" ? onePageTemplates : twoPageTemplates;
    if (!pool.some((template) => template.id === value) && pool[0]) {
      onChange(pool[0].id);
    }
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

      {defaultTemplateId != null ? (
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
  templates: CollateralTemplateDefinition[];
  value: string;
  onChange: (templateId: string) => void;
}) {
  return (
    <>
      {templates.map((template) => {
        const selected = value === template.id;
        const formatLabel = getCollateralPageFormatLabel(template.pageFormat);

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
