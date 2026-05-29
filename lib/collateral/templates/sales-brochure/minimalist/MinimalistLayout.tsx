import { Bath, BedDouble, Car } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";
const MINIMALIST_CREAM = "#f5f0e8";

function MinimalistSectionLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[0.62rem] font-bold uppercase tracking-[0.06em] text-neutral-900"
      style={{ fontFamily: headingFont }}
    >
      {children}
    </p>
  );
}

function buildFeatureItems(document: SalesBrochureDocumentJson) {
  const items: string[] = [];

  for (const point of document.copy.feature_highlights) {
    if (items.length >= 10) break;
    items.push(point);
  }
  for (const point of document.copy.appeal_points) {
    if (items.length >= 10) break;
    if (!items.includes(point)) items.push(point);
  }

  return items;
}

function resolveMinimalistImages(document: SalesBrochureDocumentJson) {
  const pageOne = document.property.page_one_image_urls
    .filter(Boolean)
    .filter((url) => !url.includes("floor-plan"));
  const fallback = document.property.hero_image_url ?? "";

  const hero = pageOne[0] ?? fallback;
  const gallery = [
    pageOne[1] ?? pageOne[0] ?? fallback,
    pageOne[2] ?? pageOne[1] ?? pageOne[0] ?? fallback,
    pageOne[3] ?? pageOne[2] ?? pageOne[1] ?? pageOne[0] ?? fallback,
  ].filter(Boolean);

  return {
    hero,
    gallery: gallery.slice(0, 3),
    pageTwoGallery: resolvePageTwoGallery(document, pageOne, fallback),
  };
}

const PAGE_ONE_BLURB_PARAGRAPHS = 3;

function resolvePageTwoGallery(
  document: SalesBrochureDocumentJson,
  pageOne: string[],
  fallback: string,
) {
  const pageTwo = document.property.page_two_image_urls.filter(Boolean);
  const pool = [...pageTwo, ...pageOne.slice(1), ...document.property.selected_image_urls.filter(Boolean)];
  const unique: string[] = [];

  for (const url of pool) {
    if (!url || url.includes("floor-plan") || unique.includes(url)) continue;
    unique.push(url);
    if (unique.length >= 5) break;
  }

  while (unique.length < 5 && unique.length > 0) {
    unique.push(unique[unique.length % unique.length]!);
  }

  if (unique.length === 0 && fallback) {
    return [fallback, fallback, fallback, fallback, fallback];
  }

  return unique.slice(0, 5);
}

function splitBlurbParagraphs(text: string) {
  return text.split(/\n\n+/).filter(Boolean).map((p) => p.trim());
}

function buildClosingParagraph(
  document: SalesBrochureDocumentJson,
  agent: FinalReportJson["agent"],
) {
  const tail = document.copy.appeal_points.at(-1)?.trim();
  if (agent.name && agent.phone) {
    const lead = tail ? `${tail} ` : "";
    return `${lead}Contact ${agent.name} on ${agent.phone} to discuss further.`;
  }
  return tail || null;
}

function MinimalistBlurb({
  text,
  maxParagraphs,
  className = "",
}: {
  text: string;
  maxParagraphs?: number;
  className?: string;
}) {
  if (!text.trim()) return null;

  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const visible =
    maxParagraphs != null ? paragraphs.slice(0, maxParagraphs) : paragraphs;

  return (
    <div className={`space-y-3 ${className}`}>
      {visible.map((paragraph) => (
        <p
          key={paragraph.slice(0, 48)}
          className="text-[0.74rem] leading-[1.72] text-neutral-800"
          style={{ fontFamily: bodyFont }}
        >
          {paragraph.trim()}
        </p>
      ))}
    </div>
  );
}

function MinimalistStatsIcons({ document }: { document: SalesBrochureDocumentJson }) {
  const { property } = document;
  const stats: Array<{ id: string; icon: LucideIcon; value: string }> = [];

  if (property.bedrooms) {
    stats.push({ id: "bed", icon: BedDouble, value: formatNumber(property.bedrooms) });
  }
  if (property.bathrooms) {
    stats.push({ id: "bath", icon: Bath, value: formatNumber(property.bathrooms) });
  }
  if (property.car_spaces) {
    stats.push({ id: "car", icon: Car, value: formatNumber(property.car_spaces) });
  }

  if (!stats.length) return null;

  return (
    <div className="flex items-end gap-6 pb-1">
      {stats.map((stat) => (
        <div key={stat.id} className="flex flex-col items-center gap-1.5">
          <stat.icon className="h-5 w-5 text-neutral-800" strokeWidth={1.75} aria-hidden />
          <span
            className="text-[0.95rem] font-medium leading-none text-neutral-900"
            style={{ fontFamily: bodyFont }}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MinimalistSidebar({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const agent = report.agent;
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const accent = document.agency.primary_colour || "#5c2f2f";

  return (
    <aside className="flex min-h-0 flex-col gap-5">
      <MinimalistStatsIcons document={document} />

      <div className="space-y-1.5">
        <MinimalistSectionLabel>For sale</MinimalistSectionLabel>
        {document.property.display_price ? (
          <p
            className="text-[0.82rem] font-semibold leading-snug text-neutral-900"
            style={{ fontFamily: bodyFont }}
          >
            {document.property.display_price}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <MinimalistSectionLabel>View</MinimalistSectionLabel>
        {document.copy.inspection_cta ? (
          <p
            className="text-[0.74rem] leading-snug text-neutral-800"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.inspection_cta}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <MinimalistSectionLabel>Agents</MinimalistSectionLabel>
        <div className="space-y-0.5">
          {agent.name ? (
            <p className="text-[0.74rem] font-semibold text-neutral-900">{agent.name}</p>
          ) : null}
          {agent.phone ? (
            <p className="text-[0.74rem] text-neutral-800">{agent.phone}</p>
          ) : null}
          {agent.email ? (
            <p className="break-all text-[0.72rem] text-neutral-700">{agent.email}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <MinimalistSectionLabel>Agency</MinimalistSectionLabel>
        <div className="space-y-0.5">
          <p className="text-[0.74rem] font-semibold text-neutral-900">{document.agency.name}</p>
          {document.agency.phone ? (
            <p className="text-[0.74rem] text-neutral-800">{document.agency.phone}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex justify-end pt-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-9 max-w-[130px] object-contain object-right"
          />
        ) : (
          <p
            className="text-right text-[0.68rem] font-bold uppercase tracking-wide"
            style={{ color: accent, fontFamily: headingFont }}
          >
            {document.agency.name}
          </p>
        )}
      </div>
    </aside>
  );
}

function MinimalistPhotoStrip({
  document,
  compact = false,
}: {
  document: SalesBrochureDocumentJson;
  compact?: boolean;
}) {
  const { hero, gallery } = resolveMinimalistImages(document);

  return (
    <div
      className={`flex h-1/2 shrink-0 flex-col ${compact ? "px-6 pt-6" : "px-8 pt-8"}`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[3px]">
        {hero ? (
          <div className="min-h-0 flex-[7] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="min-h-0 flex-[7] bg-neutral-300" />
        )}

        {gallery.length > 0 ? (
          <div className="grid min-h-0 flex-[3] grid-cols-3 gap-[3px]">
            {gallery.map((url, index) => (
              <div key={`${url}-${index}`} className="min-h-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MinimalistDisclaimer({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return null;

  return (
    <p
      className={`text-[0.56rem] leading-relaxed text-neutral-400 ${className}`}
      style={{ fontFamily: bodyFont }}
    >
      {text}
    </p>
  );
}

/** Page 1 — hero + 3-photo strip, two-column copy and sidebar (reference layout). */
export function MinimalistPageOne({
  document,
  report,
  compact = false,
  blurbParagraphLimit,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
  compact?: boolean;
  /** When set (e.g. 3 for 2-page brochures), overflow continues on page 2. */
  blurbParagraphLimit?: number;
}) {
  const headline = document.copy.heading?.trim() || document.property.summary?.trim() || "";
  const accent = document.agency.primary_colour || "#5c2f2f";
  const pageBg = document.agency.background_colour?.trim() || MINIMALIST_CREAM;
  const blurbLimit = blurbParagraphLimit ?? (compact ? 3 : undefined);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ backgroundColor: pageBg, height: "var(--report-page-height, 297mm)" }}
    >
      <MinimalistPhotoStrip document={document} compact={compact} />

      <div
        className={`grid min-h-0 flex-1 ${
          compact ? "grid-cols-[1.55fr_1fr] gap-6 px-6 pb-6 pt-5" : "grid-cols-[1.65fr_1fr] gap-8 px-8 pb-8 pt-6"
        }`}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <p
            className="text-[0.76rem] font-medium text-neutral-900"
            style={{ fontFamily: bodyFont }}
          >
            {document.property.address}
          </p>

          {headline ? (
            <h1
              className={`font-bold leading-[1.12] ${
                compact ? "text-[1.25rem]" : "text-[1.45rem]"
              }`}
              style={{ color: accent, fontFamily: headingFont }}
            >
              {headline}
            </h1>
          ) : null}

          <MinimalistBlurb
            text={document.copy.blurb}
            maxParagraphs={blurbLimit}
          />

          <MinimalistDisclaimer
            text={document.copy.disclaimer}
            className="mt-auto pt-4"
          />
        </div>

        <MinimalistSidebar document={document} report={report} />
      </div>
    </div>
  );
}

function MinimalistPageTwoGallery({ urls }: { urls: string[] }) {
  if (!urls.length) return null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-[3px]">
      {urls.map((url, index) => (
        <div key={`${url}-${index}`} className="min-h-0 flex-1 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

/** Page 2 — features + details left, five-photo stack right, disclaimer/logo footer. */
export function MinimalistPageTwo({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const features = buildFeatureItems(document);
  const { pageTwoGallery } = resolveMinimalistImages(document);
  const rightStack = pageTwoGallery.slice(0, 3);
  const bottomImage = pageTwoGallery[3] ?? pageTwoGallery[0] ?? "";
  const agent = report.agent;
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const pageBg = document.agency.background_colour?.trim() || MINIMALIST_CREAM;
  const blurbParagraphs = splitBlurbParagraphs(document.copy.blurb);
  const continuation = blurbParagraphs.slice(PAGE_ONE_BLURB_PARAGRAPHS).join("\n\n");
  const closingParagraph = buildClosingParagraph(document, agent);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ backgroundColor: pageBg, height: "var(--report-page-height, 297mm)" }}
    >
      <div className="grid min-h-0 flex-1 grid-cols-[1.55fr_1fr] gap-6 px-8 pb-4 pt-8">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {continuation ? <MinimalistBlurb text={continuation} /> : null}

          {features.length > 0 ? (
            <div>
              <p
                className="text-[0.74rem] font-medium text-neutral-900"
                style={{ fontFamily: bodyFont }}
              >
                Features include:
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {features.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[0.72rem] leading-snug text-neutral-800"
                    style={{ fontFamily: bodyFont }}
                  >
                    <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-neutral-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {closingParagraph ? (
            <p
              className="text-[0.74rem] leading-[1.72] text-neutral-800"
              style={{ fontFamily: bodyFont }}
            >
              {closingParagraph}
            </p>
          ) : null}

          {document.property.property_type ? (
            <div className="space-y-2.5 pt-1">
              <MinimalistSectionLabel>More details</MinimalistSectionLabel>
              <div className="flex gap-10 text-[0.72rem]">
                <span className="text-neutral-800" style={{ fontFamily: bodyFont }}>
                  Property type
                </span>
                <span className="text-neutral-800" style={{ fontFamily: bodyFont }}>
                  {document.property.property_type}
                </span>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 pt-1">
            {(agent.name || agent.phone) && (
              <p className="text-[0.74rem] text-neutral-900" style={{ fontFamily: bodyFont }}>
                {agent.name ? <span className="font-bold">{agent.name}</span> : null}
                {agent.name && agent.phone ? " " : null}
                {agent.phone ? <span className="font-bold">{agent.phone}</span> : null}
              </p>
            )}
            {(agent.role_title || agent.email) && (
              <p className="text-[0.72rem] text-neutral-800" style={{ fontFamily: bodyFont }}>
                {[agent.role_title, agent.email].filter(Boolean).join(" | ")}
              </p>
            )}

            <p className="text-[0.72rem] text-neutral-800" style={{ fontFamily: bodyFont }}>
              {document.agency.name ? (
                <span className="font-bold">{document.agency.name}</span>
              ) : null}
              {document.agency.name && document.agency.phone ? " " : null}
              {document.agency.phone ? <span>{document.agency.phone}</span> : null}
            </p>

            {(document.agency.website_url || document.agency.email) && (
              <p className="text-[0.72rem] text-neutral-700" style={{ fontFamily: bodyFont }}>
                {[document.agency.website_url, document.agency.email]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            )}
          </div>
        </div>

        <MinimalistPageTwoGallery urls={rightStack} />
      </div>

      {bottomImage ? (
        <div className="shrink-0 px-8">
          <div className="h-[72mm] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bottomImage} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      ) : null}

      <footer className="flex shrink-0 items-end justify-between gap-8 px-8 pb-6 pt-2">
        <MinimalistDisclaimer text={document.copy.disclaimer} className="max-w-[70%]" />
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-9 max-w-[130px] shrink-0 object-contain object-right"
          />
        ) : (
          <p
            className="shrink-0 text-right text-[0.68rem] font-bold uppercase tracking-wide text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {document.agency.name}
          </p>
        )}
      </footer>
    </div>
  );
}

/** Single-page spread — same structure, slightly tighter photo heights. */
export function MinimalistSpread({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  return <MinimalistPageOne document={document} report={report} compact />;
}
