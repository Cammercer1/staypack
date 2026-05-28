import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function resolveBoldPhotos(document: SalesBrochureDocumentJson) {
  const urls = document.property.page_one_image_urls.filter(Boolean);
  return {
    main: urls[0] ?? document.property.hero_image_url ?? "",
    stackTop: urls[1] ?? urls[0] ?? "",
    stackBottom: urls[2] ?? urls[1] ?? urls[0] ?? "",
  };
}

function formatPropertyAddressLine(document: SalesBrochureDocumentJson) {
  const { property } = document;
  const locality = [property.suburb, property.state, property.postcode]
    .filter(Boolean)
    .join(" ");

  return locality ? `${property.address}, ${locality}` : property.address;
}

function resolveBoldAgents(report: FinalReportJson) {
  if (report.agents?.length) {
    return report.agents.filter(
      (agent) => agent.name || agent.photo_url || agent.phone || agent.email,
    );
  }

  if (
    report.agent.name ||
    report.agent.photo_url ||
    report.agent.phone ||
    report.agent.email
  ) {
    return [report.agent];
  }

  return [];
}

function buildBoldFeatureItems(document: SalesBrochureDocumentJson) {
  const items: string[] = [];

  for (const point of document.copy.appeal_points) {
    if (items.length >= 8) break;
    items.push(point);
  }
  for (const point of document.copy.feature_highlights) {
    if (items.length >= 10) break;
    if (!items.includes(point)) items.push(point);
  }

  return items;
}

function BoldAgentCard({ agent }: { agent: FinalReportJson["agent"] }) {
  return (
    <div className="flex flex-col items-center text-center">
      {agent.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.photo_url}
          alt=""
          className="h-[5.25rem] w-[5.25rem] shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="h-[5.25rem] w-[5.25rem] shrink-0 rounded-full bg-neutral-200" />
      )}
      <div
        className="mt-3 w-full min-w-0 text-[0.74rem] leading-snug text-neutral-700"
        style={{ fontFamily: bodyFont }}
      >
        {agent.name ? (
          <p
            className="text-[0.8rem] font-bold uppercase tracking-wide text-neutral-800"
            style={{ fontFamily: headingFont }}
          >
            {agent.name}
          </p>
        ) : null}
        {agent.role_title ? <p className="mt-1.5">{agent.role_title}</p> : null}
        {agent.phone ? <p className="mt-2">{agent.phone}</p> : null}
        {agent.email ? (
          <p className="mt-1 break-all text-neutral-600">{agent.email}</p>
        ) : null}
      </div>
    </div>
  );
}

export function BoldHeaderBand({ document }: { document: SalesBrochureDocumentJson }) {
  const headerBg =
    document.agency.accent_colour || document.agency.primary_colour;
  const headline = (document.copy.heading?.trim() || "For sale").toUpperCase();
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const headerText = document.agency.text_colour || "#1a1a1a";

  return (
    <header
      className="flex shrink-0 items-start justify-between gap-6 px-8 py-5"
      style={{ backgroundColor: headerBg, color: headerText }}
    >
      <div className="min-w-0 flex-1">
        <h1
          className="text-[2.1rem] font-bold uppercase leading-[0.95] tracking-tight"
          style={{ fontFamily: headingFont }}
        >
          {headline}
        </h1>
        <p
          className="mt-2 text-[0.82rem] font-medium leading-snug"
          style={{ fontFamily: bodyFont }}
        >
          {formatPropertyAddressLine(document)}
        </p>
      </div>
      {logoUrl ? (
        <div className="shrink-0 bg-white px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-9 max-w-[120px] object-contain"
          />
        </div>
      ) : null}
    </header>
  );
}

export function BoldPhotoStrip({ document }: { document: SalesBrochureDocumentJson }) {
  const { main, stackTop, stackBottom } = resolveBoldPhotos(document);

  return (
    <div className="grid h-[72mm] shrink-0 grid-cols-[1.5fr_1fr] gap-[3px] bg-neutral-200">
      {main ? (
        <div className="min-h-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="bg-neutral-300" />
      )}
      <div className="grid min-h-0 grid-rows-2 gap-[3px]">
        {stackTop ? (
          <div className="min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stackTop} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="bg-neutral-300" />
        )}
        {stackBottom ? (
          <div className="min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stackBottom} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="bg-neutral-300" />
        )}
      </div>
    </div>
  );
}

export function BoldContentColumns({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const features = buildBoldFeatureItems(document);
  const agents = resolveBoldAgents(report).slice(0, 2);
  const title =
    document.property.summary?.trim() ||
    document.copy.heading?.trim() ||
    document.property.property_type ||
    "Property overview";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_0.42fr] gap-10 overflow-hidden px-8 py-6">
      <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
        <h2
          className="text-[0.95rem] font-bold uppercase leading-snug tracking-wide text-neutral-800"
          style={{ fontFamily: headingFont }}
        >
          {title}
        </h2>

        {document.copy.blurb ? (
          <p
            className="text-[0.72rem] leading-[1.65] text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.blurb}
          </p>
        ) : null}

        {features.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <h3
              className="text-[0.78rem] font-bold uppercase tracking-wide text-neutral-800"
              style={{ fontFamily: headingFont }}
            >
              Features:
            </h3>
            <ul className="mt-2 space-y-1">
              {features.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-[0.7rem] leading-snug text-neutral-700"
                  style={{ fontFamily: bodyFont }}
                >
                  <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-neutral-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {document.copy.inspection_cta ? (
          <p
            className="shrink-0 text-[0.7rem] leading-snug text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.inspection_cta}
          </p>
        ) : null}

        {document.property.display_price ? (
          <p
            className="shrink-0 text-[0.95rem] font-bold text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {document.property.display_price}
          </p>
        ) : null}
      </div>

      {agents.length > 0 ? (
        <div className="flex min-h-0 flex-col items-center justify-start gap-10">
          {agents.map((agent) => (
            <BoldAgentCard
              key={agent.name || agent.email || agent.phone}
              agent={agent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BoldFooterBand({ document }: { document: SalesBrochureDocumentJson }) {
  const footerBg = document.agency.text_colour || document.agency.primary_colour;

  return (
    <footer
      className="flex shrink-0 items-center justify-center px-8 py-3 text-center text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white"
      style={{
        backgroundColor: footerBg,
        fontFamily: headingFont,
      }}
    >
      {document.agency.name}
    </footer>
  );
}

/** Bold page 1 — header band, photo strip, copy + agents, footer bar. */
export function BoldPageOneSpread({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  return (
    <>
      <BoldHeaderBand document={document} />
      <BoldPhotoStrip document={document} />
      <BoldContentColumns document={document} report={report} />
      <BoldFooterBand document={document} />
    </>
  );
}
