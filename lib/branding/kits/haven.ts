import type { FinalReportJson } from "@/lib/types";

export const HAVEN_BRAND = {
  name: "havenly property",
  tagline: "Short-term rental potential",
  heroSubheadline: "Short-term rental potential · Market-backed estimate",
  leaseAppraisalHeading: "What can you lease this for?",
  leaseAppraisalSubheadline:
    "Rental appraisal · Market-backed weekly rent range",
  logoOnDarkUrl:
    "https://images.zenu.com.au/w336ynmmwwefedna2gdto9mn4u6twg84.png",
  logoOnLightUrl:
    "https://images.zenu.com.au/9ih5p3dcbphy7rxoy2l8qii12px8ayox.png",
  black: "#000000",
  white: "#ffffff",
  blueDeep: "#1a237e",
  blueBright: "#00bcd4",
  statBar: "#009eca",
  statBarMuted: "#007aa3",
  statBarLight: "#4db8d9",
  pageBackground: "#ffffff",
  text: "#111111",
  textMuted: "#4a5568",
  fontId: "manrope",
  websiteUrl: "",
  contactEmail: "",
  contactPhone: "",
} as const;

const HAVEN_SHANNYN_PHOTO_PATH =
  "https://i1.au.reastatic.net/192x192-gravity=north,quality=90/5219a5a1130fbfde99391f698860696431c11f9cb2e9f7f694eaa843bfbdb8a7/main.jpg";
const HAVEN_MIKKI_PHOTO_PATH =
  "https://i1.au.reastatic.net/192x192-gravity=north,quality=90/9b2fd330c55149032d436c6f3f54beb34641509ae86519f0f3e8b93477f2e988/main.jpg";

function havenAgents(): FinalReportJson["agent"][] {
  return [
    {
      name: "Shannyn Laird",
      role_title: "CEO",
      phone: "0412839307",
      email: "",
      photo_url: HAVEN_SHANNYN_PHOTO_PATH,
    },
    {
      name: "Mikki Van Dyk",
      role_title: "General Manager – Brisbane",
      phone: "0488587989",
      email: "",
      photo_url: HAVEN_MIKKI_PHOTO_PATH,
    },
  ];
}

function havenAgent(): FinalReportJson["agent"] {
  return havenAgents()[0]!;
}

export function getHavenAgent(): FinalReportJson["agent"] {
  return havenAgent();
}

export const HAVEN_AGENT_PHOTO_CLASS =
  "h-[4.75rem] w-auto max-w-[5.75rem] shrink-0 object-contain object-top";

export const HAVEN_LEASE_APPRAISAL_AGENT_PHOTO_CLASS =
  "h-[5.75rem] w-auto max-w-[7rem] shrink-0 object-contain object-top";

export const HAVEN_GRADIENT = `linear-gradient(90deg, ${HAVEN_BRAND.blueDeep} 0%, ${HAVEN_BRAND.blueBright} 100%)`;

function isHavenLeaseAppraisalTemplate(report: FinalReportJson) {
  return report.template_id === "haven-properties-lease-appraisal";
}

export function applyHavenBrandKitToReport(
  report: FinalReportJson,
): FinalReportJson {
  const leaseAppraisal = isHavenLeaseAppraisalTemplate(report);

  return {
    ...report,
    template_id: leaseAppraisal
      ? "haven-properties-lease-appraisal"
      : "haven-properties-str",
    assets: {
      ...report.assets,
      qr_code_url: "",
    },
    agent: havenAgent(),
    agents: havenAgents(),
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
