import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function resolveBoldPhotos(document: SalesBrochureDocumentJson) {
  const urls = document.property.page_one_image_urls
    .filter(Boolean)
    .filter((url) => !url.includes("floor-plan"));
  return {
    hero: urls[0] ?? document.property.hero_image_url ?? "",
    secondary: urls.slice(1, 4),
  };
}

function resolveBoldAgents(report: FinalReportJson) {
  if (report.agents?.length) {
    return report.agents.filter(
      (a) => a.name || a.photo_url || a.phone || a.email,
    );
  }
  if (report.agent.name || report.agent.photo_url || report.agent.phone || report.agent.email) {
    return [report.agent];
  }
  return [];
}

function buildBoldFeatureItems(document: SalesBrochureDocumentJson) {
  const items: string[] = [];
  for (const point of document.copy.appeal_points) {
    if (items.length >= 9) break;
    items.push(point);
  }
  for (const point of document.copy.feature_highlights) {
    if (items.length >= 9) break;
    if (!items.includes(point)) items.push(point);
  }
  return items;
}

function BoldStatPill({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="text-[1.1rem] font-bold leading-none text-white"
        style={{ fontFamily: bodyFont }}
      >
        {value}
      </span>
      <span
        className="text-[0.62rem] font-medium uppercase tracking-[0.08em] text-white/70"
        style={{ fontFamily: headingFont }}
      >
        {label}
      </span>
    </div>
  );
}

function BoldStatStrip({ document }: { document: SalesBrochureDocumentJson }) {
  const { property } = document;
  const accent = document.agency.accent_colour || document.agency.primary_colour || "#1a1a2e";

  const stats: Array<{ value: string; label: string }> = [];
  if (property.bedrooms) stats.push({ value: formatNumber(property.bedrooms), label: "Bed" });
  if (property.bathrooms) stats.push({ value: formatNumber(property.bathrooms), label: "Bath" });
  if (property.car_spaces) stats.push({ value: formatNumber(property.car_spaces), label: "Car" });
  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    stats.push({ value: `${formatNumber(property.land_area_sqm)}`, label: "m²" });
  }

  return (
    <div
      className="flex shrink-0 items-center justify-between px-8 py-3.5"
      style={{ backgroundColor: accent }}
    >
      <div className="flex items-center gap-8">
        {stats.map((s) => (
          <BoldStatPill key={s.label} value={s.value} label={s.label} />
        ))}
      </div>
      {property.display_price ? (
        <p
          className="text-[1rem] font-bold text-white"
          style={{ fontFamily: headingFont }}
        >
          {property.display_price}
        </p>
      ) : null}
    </div>
  );
}

function BoldHero({ document }: { document: SalesBrochureDocumentJson }) {
  const { hero } = resolveBoldPhotos(document);
  const logoUrl = getAgencyLogoUrl(document.agency, "dark");
  const headline = document.copy.heading?.trim() || document.property.address;

  return (
    <div className="relative h-[140mm] shrink-0 overflow-hidden">
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full bg-neutral-300" />
      )}

      {/* Top gradient for logo legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent"
        aria-hidden
      />

      {/* Bottom gradient for text overlay */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
        aria-hidden
      />

      {/* Logo — top left */}
      {logoUrl ? (
        <div className="absolute left-7 top-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-10 max-w-[160px] object-contain drop-shadow-md"
          />
        </div>
      ) : (
        <p
          className="absolute left-7 top-6 text-sm font-bold uppercase tracking-widest text-white drop-shadow"
          style={{ fontFamily: headingFont }}
        >
          {document.agency.name}
        </p>
      )}

      {/* Address + headline overlay */}
      <div className="absolute inset-x-0 bottom-0 px-8 pb-7">
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/75"
          style={{ fontFamily: headingFont }}
        >
          {[document.property.suburb, document.property.state, document.property.postcode]
            .filter(Boolean)
            .join(", ")}
        </p>
        <h1
          className="mt-1.5 text-[1.75rem] font-bold leading-[1.1] text-white"
          style={{ fontFamily: headingFont }}
        >
          {document.property.address}
        </h1>
        {headline !== document.property.address ? (
          <p
            className="mt-2 text-[0.9rem] font-medium leading-snug text-white/90"
            style={{ fontFamily: headingFont }}
          >
            {headline}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BoldAgentCard({
  agent,
  accent,
}: {
  agent: FinalReportJson["agent"];
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {agent.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.photo_url}
          alt={agent.name || "Agent"}
          className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
        />
      ) : (
        <div
          className="h-14 w-14 shrink-0 rounded-full"
          style={{ backgroundColor: `${accent}22` }}
        />
      )}
      <div className="min-w-0">
        {agent.name ? (
          <p
            className="text-[0.82rem] font-bold leading-tight text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {agent.name}
          </p>
        ) : null}
        {agent.role_title ? (
          <p className="text-[0.7rem] text-neutral-600" style={{ fontFamily: bodyFont }}>
            {agent.role_title}
          </p>
        ) : null}
        {agent.phone ? (
          <p className="text-[0.7rem] text-neutral-700" style={{ fontFamily: bodyFont }}>
            {agent.phone}
          </p>
        ) : null}
        {agent.email ? (
          <p className="truncate text-[0.68rem] text-neutral-600" style={{ fontFamily: bodyFont }}>
            {agent.email}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BoldBody({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const features = buildBoldFeatureItems(document);
  const agents = resolveBoldAgents(report).slice(0, 2);
  const accent = document.agency.primary_colour || "#1a1a2e";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-8 overflow-hidden px-8 py-6">
      {/* Left — blurb + features */}
      <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
        {document.copy.blurb ? (
          <p
            className="text-[0.74rem] leading-[1.7] text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.blurb}
          </p>
        ) : null}

        {features.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {features.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[0.7rem] leading-snug text-neutral-800"
                style={{ fontFamily: bodyFont }}
              >
                <span
                  className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Right — agents + QR */}
      <div className="flex min-h-0 flex-col justify-between gap-5 overflow-hidden">
        <div className="space-y-5">
          {agents.map((agent) => (
            <BoldAgentCard
              key={agent.name || agent.email || agent.phone}
              agent={agent}
              accent={accent}
            />
          ))}
        </div>

        <div className="flex items-end justify-between gap-4">
          {document.copy.inspection_cta ? (
            <p
              className="text-[0.72rem] leading-snug text-neutral-700"
              style={{ fontFamily: bodyFont }}
            >
              {document.copy.inspection_cta}
            </p>
          ) : null}
          {document.assets.qr_code_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.assets.qr_code_url}
              alt="QR"
              className="h-14 w-14 shrink-0"
            />
          ) : null}
        </div>

        {document.copy.disclaimer ? (
          <p
            className="text-[0.56rem] leading-relaxed text-neutral-400"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.disclaimer}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function BoldFooterBand({ document }: { document: SalesBrochureDocumentJson }) {
  const footerBg = document.agency.accent_colour || document.agency.primary_colour || "#1a1a2e";
  const logoUrl = getAgencyLogoUrl(document.agency, "dark");

  return (
    <footer
      className="flex shrink-0 items-center justify-between px-8 py-3"
      style={{ backgroundColor: footerBg }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={document.agency.name}
          className="h-7 max-w-[130px] object-contain brightness-0 invert"
        />
      ) : (
        <p
          className="text-sm font-bold uppercase tracking-[0.14em] text-white"
          style={{ fontFamily: headingFont }}
        >
          {document.agency.name}
        </p>
      )}
      {document.agency.website_url ? (
        <p
          className="text-[0.65rem] text-white/70"
          style={{ fontFamily: bodyFont }}
        >
          {document.agency.website_url}
        </p>
      ) : null}
    </footer>
  );
}

/** Bold page 1 — full-bleed hero overlay, stat strip, body columns, footer. */
export function BoldPageOneSpread({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  return (
    <>
      <BoldHero document={document} />
      <BoldStatStrip document={document} />
      <BoldBody document={document} report={report} />
      <BoldFooterBand document={document} />
    </>
  );
}

// Keep old exports so page 2 (BoldBrochure.tsx) still compiles
export { resolveBoldPhotos };
export type { BoldBodyProps };
type BoldBodyProps = { document: SalesBrochureDocumentJson; report: FinalReportJson };
