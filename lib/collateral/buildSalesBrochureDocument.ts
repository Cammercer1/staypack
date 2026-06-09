import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import {
  DEFAULT_RENTAL_BROCHURE_PRICE_LABEL,
  DEFAULT_RENTAL_BROCHURE_BOND_LABEL,
  type BrochureCopyJson,
  type BrochureDocumentJson,
  type RentalBrochureDocumentJson,
  type SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import { resolveListingImageMetaForPool } from "@/lib/listings/syncListingImageMeta";
import { mockBlurbVariantsFromText } from "@/lib/copy/blurbVariantEnforce";
import { coerceSalesBrochureCopy } from "@/lib/collateral/sales-brochure/propertyHighlights";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import {
  primaryReportAgent,
  resolveReportAgents,
  type ReportAgent,
} from "@/lib/reports/resolveReportAgents";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  CollateralType,
  Listing,
} from "@/lib/types";

type BrochureCollateralType = Extract<
  CollateralType,
  "sales_brochure" | "rental_brochure"
>;

type BuildInput = {
  collateralType: BrochureCollateralType;
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  copy: BrochureCopyJson;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
  resolvedAgents?: ReportAgent[];
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

export function buildBrochureDocument({
  collateralType,
  agency,
  listing,
  collateral,
  copy,
  agentProfile,
  agencyAgents,
  resolvedAgents,
  qrCodeUrl,
  qrTargetUrl,
}: BuildInput): BrochureDocumentJson {
  const scraped = listing.scraped_listing_json;
  const brochureImages = resolveCollateralImageSelection(listing, collateralType);
  const galleryUrls = [
    ...(brochureImages.hero_image_url ? [brochureImages.hero_image_url] : []),
    ...brochureImages.selected_image_urls.filter(
      (url) => url !== brochureImages.hero_image_url,
    ),
  ];
  const images = splitBrochureImages(galleryUrls);
  const agents =
    resolvedAgents ??
    resolveReportAgents({
      scraped,
      agentProfile,
      agencyAgents,
    });
  const agent = primaryReportAgent(agents);
  const displayPrice = resolveReportDisplayPrice(listing, scraped);

  const base = {
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
    listing_image_meta: resolveListingImageMetaForPool(listing),
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

  if (collateralType === "rental_brochure") {
    return {
      ...base,
      version: "rental_brochure_v1",
      type: "rental_brochure",
    } satisfies RentalBrochureDocumentJson;
  }

  return {
    ...base,
    version: "sales_brochure_v1",
    type: "sales_brochure",
  } satisfies SalesBrochureDocumentJson;
}

type SalesBuildInput = Omit<BuildInput, "collateralType">;

export function buildSalesBrochureDocument(input: SalesBuildInput): SalesBrochureDocumentJson {
  const document = buildBrochureDocument({ ...input, collateralType: "sales_brochure" });
  if (document.type !== "sales_brochure") {
    throw new Error("Expected sales brochure document");
  }
  return document;
}

export function buildRentalBrochureDocument(
  input: SalesBuildInput,
): RentalBrochureDocumentJson {
  const document = buildBrochureDocument({ ...input, collateralType: "rental_brochure" });
  if (document.type !== "rental_brochure") {
    throw new Error("Expected rental brochure document");
  }
  return document;
}

export function getMockSalesBrochureCopy(
  listing: Listing,
  agency: Agency,
): BrochureCopyJson {
  const address = listing.property_address ?? "this property";

  const descriptor = [
    listing.bedrooms ? `${listing.bedrooms} bedroom` : null,
    listing.property_type?.trim().toLowerCase() || null,
  ]
    .filter(Boolean)
    .join(" ");
  const heading = descriptor
    ? `${descriptor.charAt(0).toUpperCase()}${descriptor.slice(1)} for sale`
    : "Your next home awaits";

  const blurb = `Discover ${address} — a well-presented opportunity in a sought-after pocket. Arrange an inspection to experience the layout, natural light and lifestyle appeal for yourself.`;
  const blurb_variants = mockBlurbVariantsFromText(blurb);

  return {
    heading,
    blurb,
    blurb_blocks: [{ type: "paragraph", text: blurb }],
    blurb_variants,
    property_highlights: [
      "Practical floor plan suited to everyday living.",
      "Convenient access to local amenities and transport.",
      "Presented for buyers seeking quality and location.",
      "Generous living zones with flexible accommodation.",
    ],
    inspection_cta:
      agency.default_cta || "Contact us to arrange your private inspection.",
    disclaimer:
      agency.default_disclaimer ??
      "Information is general in nature. Buyers should make their own enquiries.",
  };
}

export function getMockRentalBrochureCopy(
  listing: Listing,
  agency: Agency,
): BrochureCopyJson {
  const address = listing.property_address ?? "this property";

  const descriptor = [
    listing.bedrooms ? `${listing.bedrooms} bedroom` : null,
    listing.property_type?.trim().toLowerCase() || null,
  ]
    .filter(Boolean)
    .join(" ");
  const heading = descriptor
    ? `${descriptor.charAt(0).toUpperCase()}${descriptor.slice(1)} for lease`
    : "Your next rental awaits";

  const blurb = `Discover ${address} — a well-presented rental in a sought-after pocket. Arrange an inspection to experience the layout, natural light and lifestyle appeal for yourself.`;
  const blurb_variants = mockBlurbVariantsFromText(blurb);

  return {
    heading,
    blurb,
    blurb_blocks: [{ type: "paragraph", text: blurb }],
    blurb_variants,
    property_highlights: [
      "Practical floor plan suited to everyday living.",
      "Convenient access to local amenities and transport.",
      "Presented for tenants seeking quality and location.",
      "Generous living zones with flexible accommodation.",
    ],
    inspection_cta:
      agency.default_cta || "Contact us to arrange your inspection.",
    disclaimer:
      agency.default_disclaimer ??
      "Information is general in nature. Applicants should make their own enquiries.",
    price_label: DEFAULT_RENTAL_BROCHURE_PRICE_LABEL,
    bond_label: DEFAULT_RENTAL_BROCHURE_BOND_LABEL,
    bond_value: listing.bond?.trim() || undefined,
  };
}
