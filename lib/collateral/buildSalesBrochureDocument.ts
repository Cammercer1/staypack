import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import type {
  SalesBrochureCopyJson,
  SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import { coerceSalesBrochureCopy } from "@/lib/collateral/sales-brochure/propertyHighlights";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

type BuildInput = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  copy: SalesBrochureCopyJson;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
  qrCodeUrl: string;
  qrTargetUrl: string;
};

export function splitBrochureImages(urls: string[]) {
  const unique = dedupeImageUrls(urls);
  const hero = unique[0] ?? "";
  const pageOne = unique.slice(0, 4);
  const pageTwo = unique.slice(4);

  return {
    hero_image_url: hero,
    selected_image_urls: unique,
    page_one_image_urls: pageOne,
    page_two_image_urls: pageTwo.length > 0 ? pageTwo : unique.slice(1),
  };
}

export function buildSalesBrochureDocument({
  agency,
  listing,
  collateral,
  copy,
  agentProfile,
  agencyAgents,
  qrCodeUrl,
  qrTargetUrl,
}: BuildInput): SalesBrochureDocumentJson {
  const scraped = listing.scraped_listing_json;
  const brochureImages = resolveCollateralImageSelection(listing, "sales_brochure");
  const galleryUrls = [
    ...(brochureImages.hero_image_url ? [brochureImages.hero_image_url] : []),
    ...brochureImages.selected_image_urls.filter(
      (url) => url !== brochureImages.hero_image_url,
    ),
  ];
  const images = splitBrochureImages(galleryUrls);
  const agents = resolveReportAgents({
    scraped,
    agentProfile,
    agencyAgents,
  });
  const agent = primaryReportAgent(agents);
  const displayPrice = resolveReportDisplayPrice(listing, scraped);

  return {
    version: "sales_brochure_v1",
    type: "sales_brochure",
    template_id: resolveCollateralTemplateId(agency, collateral),
    generated_at: new Date().toISOString(),
    agency: buildAgencyBrandSlice(agency),
    agent: {
      name: agent.name,
      role_title: agent.role_title,
      phone: agent.phone,
      email: agent.email,
      photo_url: agent.photo_url,
    },
    agents: agents.map((entry) => ({
      name: entry.name,
      role_title: entry.role_title,
      phone: entry.phone,
      email: entry.email,
      photo_url: entry.photo_url,
    })),
    property: {
      address:
        listing.property_address ??
        scraped?.address ??
        listing.listing_title ??
        "Property",
      suburb: listing.suburb ?? scraped?.suburb ?? "",
      state: listing.state ?? scraped?.state ?? "",
      postcode: listing.postcode ?? scraped?.postcode ?? "",
      summary:
        listing.listing_title ??
        listing.listing_description?.slice(0, 200) ??
        listing.property_address ??
        "",
      property_type: listing.property_type ?? scraped?.propertyType ?? "",
      bedrooms: listing.bedrooms ?? scraped?.bedrooms ?? 0,
      bathrooms: listing.bathrooms ?? scraped?.bathrooms ?? 0,
      car_spaces: listing.car_spaces ?? scraped?.carSpaces ?? 0,
      land_area_sqm: null,
      display_price: displayPrice ?? listing.display_price ?? scraped?.displayPrice ?? "",
      hero_image_url: images.hero_image_url,
      selected_image_urls: images.selected_image_urls,
      page_one_image_urls: images.page_one_image_urls,
      page_two_image_urls: images.page_two_image_urls,
    },
    copy: coerceSalesBrochureCopy(copy),
    qr_target_url: qrTargetUrl,
    assets: {
      qr_code_url: qrCodeUrl,
    },
  };
}

export function getMockSalesBrochureCopy(
  listing: Listing,
  agency: Agency,
): SalesBrochureCopyJson {
  const address = listing.property_address ?? "this property";

  const purposeLabel = listing.listing_purpose === "lease" ? "for lease" : "for sale";
  const descriptor = [
    listing.bedrooms ? `${listing.bedrooms} bedroom` : null,
    listing.property_type?.trim().toLowerCase() || null,
  ]
    .filter(Boolean)
    .join(" ");
  const heading = descriptor
    ? `${descriptor.charAt(0).toUpperCase()}${descriptor.slice(1)} ${purposeLabel}`
    : "Your next home awaits";

  const blurb = `Discover ${address} — a well-presented opportunity in a sought-after pocket. Arrange an inspection to experience the layout, natural light and lifestyle appeal for yourself.`;

  return {
    heading,
    blurb,
    blurb_blocks: [{ type: "paragraph", text: blurb }],
    property_highlights: [
      "Practical floor plan suited to everyday living.",
      "Convenient access to local amenities and transport.",
      "Presented for buyers seeking quality and location.",
      "Generous living zones with flexible accommodation.",
      "Low-maintenance outdoor areas for relaxed entertaining.",
      "Secure parking and storage where applicable.",
    ],
    inspection_cta:
      agency.default_cta || "Contact us to arrange your private inspection.",
    disclaimer:
      agency.default_disclaimer ??
      "Information is general in nature. Buyers should make their own enquiries.",
  };
}
