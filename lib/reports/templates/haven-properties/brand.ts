import type { FinalReportJson } from "@/lib/types";

/**
 * havenly property — hardcoded brand kit (managed delivery).
 * Does not use StayPacks agency Settings or UI profiles.
 */
export const HAVEN_BRAND = {
  name: "havenly property",
  tagline: "Short-term rental potential",
  /** Hero line under the address on page 1 (not the property address repeated). */
  heroSubheadline: "Short-term rental potential · Market-backed estimate",
  /** Lease appraisal (investor LTR) — page 1 heading line. */
  leaseAppraisalHeading: "What can you lease this for?",
  leaseAppraisalSubheadline:
    "Long-term rental appraisal · Market-backed weekly rent range",
  /** Logo for dark backgrounds (black header) — cyan/light wordmark */
  logoOnDarkUrl:
    "https://images.zenu.com.au/w336ynmmwwefedna2gdto9mn4u6twg84.png",
  /** Logo for light backgrounds (white footer) — dark wordmark */
  logoOnLightUrl:
    "https://images.zenu.com.au/9ih5p3dcbphy7rxoy2l8qii12px8ayox.png",
  black: "#000000",
  white: "#ffffff",
  /** Wordmark gradient (left → right) */
  blueDeep: "#1a237e",
  blueBright: "#00bcd4",
  /** Stat strip, footer, revenue box, snapshot, charts */
  statBar: "#009eca",
  statBarMuted: "#007aa3",
  statBarLight: "#4db8d9",
  pageBackground: "#ffffff",
  text: "#111111",
  textMuted: "#4a5568",
  /** Google Font id — used for heading, body, and loader */
  fontId: "manrope",
  websiteUrl: "",
  contactEmail: "",
  contactPhone: "",
} as const;

const HAVEN_AGENT_PHOTO_PATH = "/delivery/haven-properties/shannyn-laird.png";

function havenAgent(): FinalReportJson["agent"] {
  return {
    name: "Shannyn Laird",
    role_title: "CEO",
    phone: "0403172544",
    email: "",
    // Relative so PDF mirroring resolves against the print page origin
    photo_url: HAVEN_AGENT_PHOTO_PATH,
  };
}

/** Fixed contact on Haven STR (managed delivery — not from StayPacks agent settings). */
export function getHavenAgent(): FinalReportJson["agent"] {
  return havenAgent();
}

/** Agent headshot includes signature — avoid circular crop. */
export const HAVEN_AGENT_PHOTO_CLASS =
  "h-[4.75rem] w-auto max-w-[5.75rem] shrink-0 object-contain object-top";

/** Page-1 lease appraisal — larger contact block with signature. */
export const HAVEN_LEASE_APPRAISAL_AGENT_PHOTO_CLASS =
  "h-[5.75rem] w-auto max-w-[7rem] shrink-0 object-contain object-top";

export const HAVEN_GRADIENT = `linear-gradient(90deg, ${HAVEN_BRAND.blueDeep} 0%, ${HAVEN_BRAND.blueBright} 100%)`;

/** Strip agency UI branding; template owns look and feel. */
function isHavenLeaseAppraisalTemplate(report: FinalReportJson) {
  return report.template_id?.includes("lease-appraisal") ?? false;
}

/** Investor lease appraisal — same brand kit as STR, LTR template id and copy. */
export function applyHavenLeaseAppraisalBrandToReport(
  report: FinalReportJson,
): FinalReportJson {
  return applyHavenBrandToReport({
    ...report,
    template_id: "haven-properties-lease-appraisal",
  });
}

export function applyHavenBrandToReport(report: FinalReportJson): FinalReportJson {
  const leaseAppraisal = isHavenLeaseAppraisalTemplate(report);

  return {
    ...report,
    template_id: leaseAppraisal ? "haven-properties-lease-appraisal" : "haven-properties-str",
    assets: {
      ...report.assets,
      qr_code_url: "",
    },
    agent: havenAgent(),
    agents: [havenAgent()],
    copy: {
      ...report.copy,
      heading: leaseAppraisal
        ? report.copy.heading &&
          !/long-term rental appraisal/i.test(report.copy.heading)
          ? report.copy.heading
          : HAVEN_BRAND.leaseAppraisalHeading
        : HAVEN_BRAND.heroSubheadline,
    },
    agency: {
      ...report.agency,
      name: HAVEN_BRAND.name,
      // logo_light_url = mark for dark surfaces; logo_dark_url = mark for light surfaces
      logo_url: HAVEN_BRAND.logoOnDarkUrl,
      logo_light_url: HAVEN_BRAND.logoOnDarkUrl,
      logo_dark_url: HAVEN_BRAND.logoOnLightUrl,
      primary_colour: HAVEN_BRAND.statBar,
      secondary_colour: HAVEN_BRAND.pageBackground,
      accent_colour: HAVEN_BRAND.statBar,
      text_colour: HAVEN_BRAND.text,
      callout_heading_colour: HAVEN_BRAND.white,
      callout_text_colour: HAVEN_BRAND.white,
      background_colour: HAVEN_BRAND.pageBackground,
      heading_font_family: HAVEN_BRAND.fontId,
      body_font_family: HAVEN_BRAND.fontId,
      font_family: HAVEN_BRAND.fontId,
      heading_font_file_url: "",
      body_font_file_url: "",
      font_file_url: "",
      website_url: HAVEN_BRAND.websiteUrl,
      email: HAVEN_BRAND.contactEmail,
      phone: HAVEN_BRAND.contactPhone,
    },
  };
}
