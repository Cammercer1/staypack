"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import {
  LayoutFamilyGrid,
  type LayoutFamilyId,
} from "@/components/dev/LayoutFamilyGrid";
import { Button } from "@/components/ui/button";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import {
  familyFromTemplateId,
  pagesFromTemplateId,
  resolvePlaygroundMeta,
} from "@/lib/reports/templates/playgroundResolve";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import { enrichSalesBrochureDocumentAgents } from "@/lib/collateral/enrichSalesBrochureDocument";
import { SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import { BlurbLengthMappingPanel } from "@/components/dev/BlurbLengthMappingPanel";
import { normalizePlaygroundTemplateBlurbLength } from "@/components/dev/normalizePlaygroundBlurbMapping";
import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";
import { mergeClassicBrochureMetricsReport } from "@/lib/collateral/templates/sales-brochure/shared/mergeClassicBrochureMetricsReport";
import { finalReportToBrochureShape } from "@/lib/reports/finalReportToBrochureShape";
import type { PlaygroundListingPreview } from "@/lib/reports/playgroundListingPreview";
import { cn } from "@/lib/utils";
import type { AgentProfile, FinalReportJson } from "@/lib/types";

type LiveFlags = { str: boolean; lease: boolean; sale: boolean };

type BaseProps = {
  reportId: string;
  propertyAddress: string | null;
  strReport: FinalReportJson;
  leaseReport: FinalReportJson;
  salesBrochure: BrochureDocumentJson;
};

type FixtureProps = BaseProps & {
  mode: "fixture";
};

type BrandedProps = BaseProps & {
  mode: "listing" | "report";
  listingId: string;
  agencyName: string;
  agencyPrimaryColour: string;
  listingPreview: PlaygroundListingPreview;
  agentProfile: AgentProfile | null;
  agencyAgents: AgentProfile[];
  liveFlags: LiveFlags;
  strReportId?: string | null;
  leaseReportId?: string | null;
};

type Props = FixtureProps | BrandedProps;

const COLLATERAL_OPTIONS: { id: ReportPageVariant; label: string; short: string }[] = [
  { id: "str", label: "STR report", short: "STR" },
  { id: "lease", label: "Lease appraisal", short: "Lease" },
  { id: "sale", label: "Sales brochure", short: "Sale" },
];

function isBrandedMode(props: Props): props is BrandedProps {
  return props.mode === "listing" || props.mode === "report";
}

export function TemplatePlayground(props: Props) {
  const {
    reportId,
    propertyAddress,
    strReport,
    leaseReport,
    salesBrochure,
  } = props;

  const branded = isBrandedMode(props);
  const useDocumentBrand = branded;
  const liveFlags = branded ? props.liveFlags : null;
  const listingPreview = branded ? props.listingPreview : null;
  const agentProfile = branded ? props.agentProfile : null;
  const agencyAgents = branded ? props.agencyAgents : [];

  const initialCollateral: ReportPageVariant = isLeaseAppraisalTemplateId(
    strReport.template_id,
  )
    ? "lease"
    : "str";

  const [collateral, setCollateral] = useState<ReportPageVariant>(initialCollateral);
  const [family, setFamily] = useState<LayoutFamilyId>(() =>
    familyFromTemplateId(strReport.template_id, initialCollateral),
  );
  const [pages, setPages] = useState<1 | 2>(() =>
    pagesFromTemplateId(strReport.template_id, initialCollateral),
  );
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [templateBlurbLength, setTemplateBlurbLength] = useState<
    Partial<Record<string, BlurbLength>>
  >(() =>
    normalizePlaygroundTemplateBlurbLength(
      salesBrochure.copy.template_blurb_length,
    ),
  );

  const meta = useMemo(
    () => resolvePlaygroundMeta(collateral, family, pages),
    [collateral, family, pages],
  );

  const withBlurbMapping = <T extends { copy: { template_blurb_length?: Partial<Record<string, BlurbLength>> } }>(
    item: T,
  ): T => ({
    ...item,
    copy: { ...item.copy, template_blurb_length: templateBlurbLength },
  });

  const previewReport = useMemo(() => {
    const base = collateral === "lease" ? leaseReport : strReport;
    return withBlurbMapping({ ...base, template_id: meta.templateId });
  }, [collateral, leaseReport, strReport, meta.templateId, templateBlurbLength]);

  const previewBrochure = useMemo(() => {
    const doc = withBlurbMapping({
      ...salesBrochure,
      template_id: meta.templateId,
    });
    if (!listingPreview) {
      return doc;
    }
    return enrichSalesBrochureDocumentAgents(doc, listingPreview, {
      agentProfile,
      agencyAgents,
    });
  }, [
    salesBrochure,
    meta.templateId,
    listingPreview,
    agentProfile,
    agencyAgents,
    templateBlurbLength,
  ]);

  /** Classic page 1 — always render as the 1pg sales brochure (same shell + gallery flex). */
  const classicBrochurePreview = useMemo(() => {
    if (family !== "classic") {
      return null;
    }
    const classicTemplateId =
      collateral === "sale" && pages === 1
        ? meta.templateId
        : SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID;

    if (collateral === "sale") {
      return { ...previewBrochure, template_id: classicTemplateId };
    }

    const reportSource = withBlurbMapping(
      collateral === "lease" ? leaseReport : strReport,
    );
    const shaped = finalReportToBrochureShape(reportSource, collateral, {
      layoutFamily: "classic",
      allowDevBlurbLengthMap: true,
    });
    const withAgents = listingPreview
      ? enrichSalesBrochureDocumentAgents(shaped, listingPreview, {
          agentProfile,
          agencyAgents,
        })
      : shaped;

    const saleImages = previewBrochure.property.page_one_image_urls.filter(Boolean);

    return {
      ...withAgents,
      template_id: classicTemplateId,
      property: {
        ...withAgents.property,
        ...(saleImages.length > 0
          ? {
              hero_image_url:
                saleImages[0] ?? previewBrochure.property.hero_image_url,
              page_one_image_urls: saleImages.slice(0, 4),
              selected_image_urls: saleImages.slice(0, 4),
            }
          : {}),
      },
    };
  }, [
    family,
    collateral,
    pages,
    meta.templateId,
    previewBrochure,
    leaseReport,
    strReport,
    listingPreview,
    agentProfile,
    agencyAgents,
    templateBlurbLength,
  ]);

  const useClassicBrochurePreview = family === "classic" && classicBrochurePreview != null;

  const classicMetricsReport = useMemo(
    () =>
      mergeClassicBrochureMetricsReport(strReport, {
        strReport,
        leaseReport,
      }),
    [strReport, leaseReport],
  );

  const address =
    collateral === "sale"
      ? previewBrochure.property.address
      : (propertyAddress ?? previewReport.property.address);

  const secondaryFiles = meta.sourceFiles.filter((f) => f !== meta.primaryFile);

  const openReportHref =
    collateral === "str" && branded && props.strReportId
      ? `/reports/${props.strReportId}`
      : collateral === "lease" && branded && props.leaseReportId
        ? `/reports/${props.leaseReportId}`
        : reportId !== "fixture" && reportId !== "listing" && collateral !== "sale"
          ? `/reports/${reportId}`
          : null;

  function switchCollateral(next: ReportPageVariant) {
    let nextFamily = family;
    if (nextFamily === "haven-properties" && next !== "lease") {
      nextFamily = "classic";
    }
    const nextPages = next === "lease" ? 2 : pages;
    const templateId = resolvePlaygroundMeta(next, nextFamily, nextPages).templateId;
    setCollateral(next);
    setFamily(familyFromTemplateId(templateId, next));
    setPages(pagesFromTemplateId(templateId, next));
  }

  function switchFamily(next: LayoutFamilyId) {
    setFamily(next);
  }

  function switchPages(next: 1 | 2) {
    if (collateral === "lease") return;
    setPages(next);
  }

  const pagesLocked = collateral === "lease";

  const collateralLive =
    liveFlags &&
    (collateral === "str"
      ? liveFlags.str
      : collateral === "lease"
        ? liveFlags.lease
        : liveFlags.sale);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b lg:w-[300px] lg:border-b-0 lg:border-r">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight">
              Templates
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={address}>
              {address}
            </p>
            {branded ? (
              <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: props.agencyPrimaryColour }}
                  aria-hidden
                />
                <p className="truncate text-[0.65rem] text-foreground">
                  Brand: <span className="font-medium">{props.agencyName}</span>
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Collateral
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {COLLATERAL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => switchCollateral(opt.id)}
                  className={cn(
                    "rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    collateral === opt.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.short}
                </button>
              ))}
            </div>
            {branded && liveFlags ? (
              <p className="text-[0.65rem] text-muted-foreground">
                {collateralLive
                  ? "Live listing data"
                  : "Mock content · account fonts & colours applied"}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Layout family
            </p>
            <BlurbLengthMappingPanel
              copy={{
                heading:
                  collateral === "sale"
                    ? previewBrochure.copy.heading
                    : previewReport.copy.heading,
                blurb:
                  collateral === "sale"
                    ? previewBrochure.copy.blurb
                    : previewReport.copy.blurb,
                blurb_blocks: [],
                blurb_variants:
                  collateral === "sale"
                    ? previewBrochure.copy.blurb_variants
                    : previewReport.copy.blurb_variants,
                template_blurb_length: templateBlurbLength,
                property_highlights:
                  collateral === "sale"
                    ? previewBrochure.copy.property_highlights
                    : (previewReport.copy.appeal_points ?? []),
                inspection_cta: "",
                disclaimer:
                  collateral === "sale"
                    ? previewBrochure.copy.disclaimer
                    : previewReport.copy.disclaimer,
              }}
              collateral={collateral}
              pages={pages}
              activeFamilyId={family}
              onChange={(next) =>
                setTemplateBlurbLength(
                  normalizePlaygroundTemplateBlurbLength(
                    next.template_blurb_length,
                  ),
                )
              }
            />

            <LayoutFamilyGrid
              value={family}
              onChange={switchFamily}
              extraFamilies={
                collateral === "lease"
                  ? [{ id: "haven-properties", label: "Haven" }]
                  : undefined
              }
            />
          </div>

          <div className="space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Pages
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={pagesLocked && n === 1}
                  onClick={() => switchPages(n)}
                  className={cn(
                    "rounded-md py-2 text-xs font-medium transition-colors",
                    pages === n
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    pagesLocked && n === 1 && "cursor-not-allowed opacity-40",
                  )}
                >
                  {n} page{n === 1 ? "" : "s"}
                </button>
              ))}
            </div>
            {pagesLocked ? (
              <p className="text-[0.65rem] text-muted-foreground">
                Lease appraisals are always 2 pages (comps on page 2).
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary">
              Edit in Cursor
            </p>
            <p className="mt-2 break-all font-mono text-[0.7rem] leading-snug text-foreground">
              {meta.primaryFile}
            </p>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Save the file — preview updates automatically. Branch layout differences
              with{" "}
              <code className="text-[0.6rem]">reportVariant=&quot;str&quot; | &quot;lease&quot;</code>
              {collateral === "sale" ? " in report templates; sale uses brochure components." : "."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAllFiles((v) => !v)}
            className="flex w-full items-center gap-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showAllFiles ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            All source files ({meta.sourceFiles.length})
          </button>
          {showAllFiles ? (
            <ul className="max-h-40 space-y-0.5 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[0.6rem] leading-relaxed text-muted-foreground">
              {secondaryFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          ) : null}

          {openReportHref ? (
            <Link href={openReportHref} className="block">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Open live report
              </Button>
            </Link>
          ) : null}

          {branded && props.listingId ? (
            <Link href={`/listings/${props.listingId}`} className="block">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                Open listing workspace
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="shrink-0 border-t bg-muted/40 px-4 py-2">
          <p className="font-mono text-[0.6rem] text-muted-foreground">
            {meta.label} · {collateral} · {meta.pages}pg
          </p>
          {props.mode === "fixture" ? (
            <p className="mt-0.5 text-[0.6rem] text-muted-foreground">
              Mock data ·{" "}
              <code className="text-[0.55rem]">?listingId=uuid</code> for live preview
            </p>
          ) : branded ? (
            <p className="mt-0.5 break-all text-[0.6rem] text-muted-foreground">
              <code className="text-[0.55rem]">?listingId={props.listingId}</code>
            </p>
          ) : null}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col bg-neutral-200/80">
        <div className="shrink-0 border-b bg-background/90 px-4 py-2 backdrop-blur">
          <p className="text-center text-xs text-muted-foreground">
            {meta.templateId}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          {useClassicBrochurePreview || collateral === "sale" ? (
            <FittedBrochurePreview
              document={
                useClassicBrochurePreview && classicBrochurePreview
                  ? classicBrochurePreview
                  : previewBrochure
              }
              listing={listingPreview}
              agentProfile={agentProfile}
              agencyAgents={agencyAgents}
              metricsReport={
                useClassicBrochurePreview ? classicMetricsReport : undefined
              }
              reportVariant={collateral}
              allowDevBlurbLengthMap
              maxHeight="none"
              fitToWidth
              useDocumentBrand={useDocumentBrand}
              className="mx-auto w-full max-w-[min(100%,920px)] border-0 bg-transparent shadow-none"
            />
          ) : (
            <FittedReportPreview
              report={previewReport}
              maxHeight="none"
              fitToWidth
              className="mx-auto w-full max-w-[min(100%,920px)] border-0 bg-transparent shadow-none"
            />
          )}
        </div>
      </main>
    </div>
  );
}
