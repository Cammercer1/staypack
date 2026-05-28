import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
      <path d="M7 6c0-1.1.9-2 2-2s2 .9 2 2H7zm-4 6h18v2c0 2.76-2.24 5-5 5H8c-2.76 0-5-2.24-5-5v-2zm0-2h2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v6h10V10H3z" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

function LandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
      <path d="M3 3h7v2H5v4H3V3zm14 0h4v6h-2V5h-2V3zM3 14h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z" />
    </svg>
  );
}

function StatBadge({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span
        className="text-[1rem] font-semibold leading-none text-white"
        style={{ fontFamily: bodyFont }}
      >
        {value}
      </span>
      <span
        className="text-[0.7rem] text-white/70"
        style={{ fontFamily: bodyFont }}
      >
        {label}
      </span>
    </div>
  );
}

function LandmarkStatsBanner({
  document,
}: {
  document: SalesBrochureDocumentJson;
}) {
  const { property } = document;
  const accent = document.agency.primary_colour || "#1a1a2e";

  const stats: Array<{ icon: React.ReactNode; value: string; label: string }> = [];

  if (property.bedrooms) {
    stats.push({ icon: <BedIcon />, value: formatNumber(property.bedrooms), label: "" });
  }
  if (property.bathrooms) {
    stats.push({ icon: <BathIcon />, value: formatNumber(property.bathrooms), label: "" });
  }
  if (property.car_spaces) {
    stats.push({ icon: <CarIcon />, value: formatNumber(property.car_spaces), label: "" });
  }
  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    stats.push({
      icon: <LandIcon />,
      value: `${formatNumber(property.land_area_sqm)}`,
      label: "m2",
    });
  }

  return (
    <div
      className="flex shrink-0 items-center justify-between px-8 py-4"
      style={{ backgroundColor: accent }}
    >
      <p
        className="text-[1rem] font-bold text-white"
        style={{ fontFamily: headingFont }}
      >
        For Sale
      </p>
      {stats.length > 0 ? (
        <div className="flex items-center gap-7">
          {stats.map((s, i) => (
            <StatBadge key={i} icon={s.icon} value={s.value} label={s.label} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LandmarkSectionLabel({
  children,
  accent,
}: {
  children: string;
  accent: string;
}) {
  return (
    <p
      className="text-[0.6rem] font-bold uppercase tracking-[0.1em]"
      style={{ color: accent, fontFamily: headingFont }}
    >
      {children}
    </p>
  );
}

function LandmarkRightColumn({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const accent = document.agency.primary_colour || "#c0392b";
  const agent = report.agent;
  const allAgents = report.agents?.filter((a) => a.name || a.phone) ?? [agent];

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden pl-6">
      {document.property.display_price ? (
        <div className="space-y-1">
          <LandmarkSectionLabel accent={accent}>Price</LandmarkSectionLabel>
          <p
            className="text-[0.78rem] font-semibold text-neutral-900"
            style={{ fontFamily: bodyFont }}
          >
            {document.property.display_price}
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <LandmarkSectionLabel accent={accent}>Address</LandmarkSectionLabel>
        <p
          className="text-[0.74rem] leading-snug text-neutral-800"
          style={{ fontFamily: bodyFont }}
        >
          {[
            document.property.address,
            [document.property.suburb, document.property.state, document.property.postcode]
              .filter(Boolean)
              .join(", "),
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>

      <div className="space-y-2">
        <LandmarkSectionLabel accent={accent}>Agents</LandmarkSectionLabel>
        <div className="space-y-3">
          {allAgents.map((a) => (
            <div key={a.name || a.email} className="space-y-0.5">
              {(a.name || a.phone) && (
                <p
                  className="text-[0.74rem] font-semibold text-neutral-900"
                  style={{ fontFamily: bodyFont }}
                >
                  {[a.name, a.phone].filter(Boolean).join(" \u2013 ")}
                </p>
              )}
              {a.email && (
                <p
                  className="break-all text-[0.68rem] text-neutral-600"
                  style={{ fontFamily: bodyFont }}
                >
                  {a.email}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <LandmarkSectionLabel accent={accent}>{document.agency.name}</LandmarkSectionLabel>
        <div className="space-y-0.5">
          {document.agency.website_url && (
            <p className="break-all text-[0.68rem] text-neutral-600" style={{ fontFamily: bodyFont }}>
              {document.agency.website_url}
            </p>
          )}
          {document.agency.email && (
            <p className="break-all text-[0.68rem] text-neutral-600" style={{ fontFamily: bodyFont }}>
              {document.agency.email}
            </p>
          )}
          {document.agency.phone && (
            <p className="text-[0.68rem] text-neutral-600" style={{ fontFamily: bodyFont }}>
              {document.agency.phone}
            </p>
          )}
        </div>
      </div>

      {/* Agent photos */}
      {allAgents.some((a) => a.photo_url) ? (
        <div className="mt-auto flex shrink-0 justify-end gap-2 pt-2">
          {allAgents
            .filter((a) => a.photo_url)
            .slice(0, 2)
            .map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.name || a.email}
                src={a.photo_url!}
                alt={a.name || "Agent"}
                className="h-[52mm] w-[42mm] object-cover object-top"
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}

function LandmarkLeftColumn({
  document,
}: {
  document: SalesBrochureDocumentJson;
}) {
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const headline =
    document.copy.heading?.trim() || document.property.summary?.trim() || "";
  const paragraphs = document.copy.blurb.split(/\n\n+/).filter(Boolean);

  const bullets = [
    ...document.copy.appeal_points,
    ...document.copy.feature_highlights,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {headline ? (
        <h1
          className="mb-3 text-[1.1rem] font-bold leading-[1.2] text-neutral-900"
          style={{ fontFamily: headingFont }}
        >
          {headline}
        </h1>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden">
        {paragraphs.map((para) => (
          <p
            key={para.slice(0, 48)}
            className="text-[0.7rem] leading-[1.68] text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {para.trim()}
          </p>
        ))}

        {bullets.length > 0 ? (
          <ul className="space-y-1.5 pt-1">
            {bullets.slice(0, 5).map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[0.7rem] leading-snug text-neutral-700"
                style={{ fontFamily: bodyFont }}
              >
                <span className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full bg-neutral-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-auto shrink-0 pt-3">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={document.agency.name}
              className="h-9 max-w-[160px] object-contain object-left"
            />
          ) : (
            <p
              className="text-sm font-bold text-neutral-900"
              style={{ fontFamily: headingFont }}
            >
              {document.agency.name}
            </p>
          )}
          {document.assets.qr_code_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.assets.qr_code_url}
              alt="QR"
              className="h-10 w-10 shrink-0"
            />
          ) : null}
        </div>
        {document.copy.disclaimer ? (
          <p
            className="mt-1.5 text-[0.56rem] leading-relaxed text-neutral-400"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.disclaimer}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Full Landmark page — hero, stats banner, two-column body. */
export function LandmarkSpread({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const images = document.property.page_one_image_urls
    .filter(Boolean)
    .filter((url) => !url.includes("floor-plan"));
  const hero = images[0] ?? document.property.hero_image_url ?? "";
  const logoUrl = getAgencyLogoUrl(document.agency, "light");

  return (
    <div className="flex h-[297mm] flex-col overflow-hidden bg-white">
      {/* Hero — ~42% of page */}
      <div className="relative h-[125mm] shrink-0 overflow-hidden">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full bg-neutral-300" />
        )}
        {/* Logo watermark over hero */}
        {logoUrl ? (
          <div className="absolute bottom-4 right-5 flex items-center gap-2 rounded bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={document.agency.name}
              className="h-6 max-w-[110px] object-contain brightness-0 invert drop-shadow"
            />
          </div>
        ) : null}
      </div>

      {/* Stats banner */}
      <LandmarkStatsBanner document={document} />

      {/* Two-column body */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] gap-0 overflow-hidden">
        {/* Left — divider */}
        <div className="min-h-0 overflow-hidden border-r border-neutral-200 px-8 py-6">
          <LandmarkLeftColumn document={document} />
        </div>

        {/* Right */}
        <div className="min-h-0 overflow-hidden px-6 py-6">
          <LandmarkRightColumn document={document} report={report} />
        </div>
      </div>
    </div>
  );
}
