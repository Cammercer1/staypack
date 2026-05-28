"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { cn } from "@/lib/utils";
import {
  SALES_BROCHURE_DEV_SOURCES,
  SALES_BROCHURE_SHARED_SOURCES,
} from "@/lib/collateral/templates/sales-brochure/devSources";
import {
  getSalesBrochureTemplatesByPageCount,
  SALES_BROCHURE_TEMPLATES,
} from "@/lib/collateral/templates/sales-brochure/registry";
import { getCollateralTemplate } from "@/lib/collateral/templates/registry";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { Agency } from "@/lib/types";

type PageFilter = "all" | "1" | "2";

type Props = {
  baseDocument: SalesBrochureDocumentJson;
  agency: Agency;
  listingId?: string | null;
  collateralId?: string | null;
};

export function SalesBrochurePlayground({
  baseDocument,
  agency: _agency,
  listingId,
  collateralId,
}: Props) {
  const [templateId, setTemplateId] = useState(baseDocument.template_id);
  const [pageFilter, setPageFilter] = useState<PageFilter>("all");

  const previewDocument = useMemo(
    () =>
      ({
        ...baseDocument,
        template_id: templateId,
      }) as SalesBrochureDocumentJson,
    [baseDocument, templateId],
  );

  const template = getCollateralTemplate(templateId);
  const filteredTemplates =
    pageFilter === "all"
      ? SALES_BROCHURE_TEMPLATES
      : getSalesBrochureTemplatesByPageCount(pageFilter === "1" ? 1 : 2);

  const sourceFiles = [
    ...(SALES_BROCHURE_DEV_SOURCES[templateId] ?? []),
    ...SALES_BROCHURE_SHARED_SOURCES,
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b bg-background lg:w-[420px] lg:border-b-0 lg:border-r">
        <div className="space-y-6 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dev only
            </p>
            <h1 className="mt-1 font-display text-2xl tracking-tight">
              Sales brochure templates
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Build and compare 5 layout families × 1-page and 2-page variants. Edit
              files under <code className="text-xs">lib/collateral/templates/sales-brochure/</code>{" "}
              — preview hot-reloads on save.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "All (10)" },
                { id: "1", label: "1 page (5)" },
                { id: "2", label: "2 pages (5)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPageFilter(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  pageFilter === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2">
            {filteredTemplates.map((entry) => {
              const selected = entry.id === templateId;
              const pageLabel = entry.pages === 1 ? "1 page" : "2 pages";

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTemplateId(entry.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/70 hover:border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{entry.label}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                      {pageLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dev/templates">
              <span className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
                STR templates
              </span>
            </Link>
            {listingId ? (
              <Link href={`/listings/${listingId}/brochure`}>
                <span className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
                  Open brochure editor
                </span>
              </Link>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">
              {template.label} · {template.pages} page{template.pages === 1 ? "" : "s"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{templateId}</p>
            <ul className="max-h-40 space-y-1 overflow-auto font-mono text-[0.65rem] text-muted-foreground">
              {sourceFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            URL:{" "}
            <code>
              /dev/sales-brochures?listingId={"{"}uuid{"}"}&collateralId={"{"}uuid{"}"}
            </code>
            {collateralId ? (
              <>
                <br />
                Fixture: mock photos · {collateralId}
              </>
            ) : (
              <>
                <br />
                Fixture: mock photos (no listing linked)
              </>
            )}
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-auto bg-muted/40 p-6 lg:p-10">
        <FittedBrochurePreview
          document={previewDocument}
          maxHeight="none"
          className="mx-auto w-full max-w-[920px] border-0 bg-transparent shadow-none"
        />
      </main>
    </div>
  );
}
