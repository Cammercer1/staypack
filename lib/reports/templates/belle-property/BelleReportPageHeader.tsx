import { isLightColour } from "@/lib/branding/contrast";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { resolveBrochureBrandBand } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureBrandBand";
import type { CollateralBrandSlice } from "@/lib/collateral/templates/types";
import type { FinalReportJson } from "@/lib/types";

/** Belle page 2 header — primary brand band so the logo sits on a filled background. */
export function BelleReportPageHeader({ report }: { report: FinalReportJson }) {
  const agency = normalizeReportAgencyForBrandBand(report.agency);
  const band = resolveBrochureBrandBand(agency);
  const onLightBand = isLightColour(band.background);
  let logoUrl = getAgencyLogoUrl(agency, onLightBand ? "light" : "dark");
  let invertLogo = !onLightBand && Boolean(logoUrl);
  if (!onLightBand && !logoUrl) {
    logoUrl = getAgencyLogoUrl(agency, "light");
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
          alt={agency.name}
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
          {agency.name}
        </p>
      )}
    </header>
  );
}

function normalizeReportAgencyForBrandBand(
  agency: FinalReportJson["agency"],
): CollateralBrandSlice {
  return {
    ...agency,
    logo_light_url: agency.logo_light_url ?? "",
    logo_dark_url: agency.logo_dark_url ?? "",
    callout_heading_colour: agency.callout_heading_colour ?? null,
    callout_text_colour: agency.callout_text_colour ?? null,
  };
}
