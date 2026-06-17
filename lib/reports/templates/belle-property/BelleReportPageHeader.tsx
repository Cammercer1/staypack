import { isLightColour } from "@/lib/branding/contrast";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { resolveBrochureBrandBand } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureBrandBand";
import type { FinalReportJson } from "@/lib/types";

/** Belle page 2 header — primary brand band so the logo sits on a filled background. */
export function BelleReportPageHeader({ report }: { report: FinalReportJson }) {
  const band = resolveBrochureBrandBand(report.agency);
  const onLightBand = isLightColour(band.background);
  let logoUrl = getAgencyLogoUrl(report.agency, onLightBand ? "light" : "dark");
  let invertLogo = !onLightBand && Boolean(logoUrl);
  if (!onLightBand && !logoUrl) {
    logoUrl = getAgencyLogoUrl(report.agency, "light");
    invertLogo = Boolean(logoUrl);
  }

  return (
    <header
      className="shrink-0 px-10 py-4"
      style={{ backgroundColor: band.background, color: band.text }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={report.agency.name}
          className={`h-10 max-w-[180px] object-contain object-left ${invertLogo ? "brightness-0 invert" : ""}`}
        />
      ) : (
        <p
          className="text-lg font-semibold"
          style={{
            fontFamily: "var(--report-heading-font, inherit)",
            color: band.text,
          }}
        >
          {report.agency.name}
        </p>
      )}
    </header>
  );
}
