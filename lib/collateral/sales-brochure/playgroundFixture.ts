import type {
  SalesBrochureCopyJson,
  SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import { DEFAULT_BRAND_VALUES } from "@/lib/branding/normalize";

/** Property photos for dev previews (stable Unsplash IDs). */
export const PLAYGROUND_BROCHURE_IMAGES = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
  "https://images.unsplash.com/photo-1600573472591-ee6b8c0c2a6a?w=1200&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f84d030cd?w=1200&q=80",
  "https://images.unsplash.com/photo-1600210492486-724fe41c20aa?w=1200&q=80",
] as const;

const PLAYGROUND_COPY: SalesBrochureCopyJson = {
  heading: "Open house",
  blurb:
    "A well-presented four-bedroom home combining open-plan living, a covered alfresco and a practical floor plan for everyday family life. Moments from schools, parks and local village shops.\n\nSet across a generous level block, the home flows from a light-filled lounge to dining and kitchen, with seamless access to covered outdoor entertaining. Ideal for families seeking space, storage and a calm neighbourhood setting.",
  appeal_points: [
    "North-facing living zones with garden outlook",
    "Updated kitchen with stone benchtops",
    "Master suite with walk-in robe and ensuite",
    "Ducted air conditioning throughout",
    "Double garage with internal access",
  ],
  feature_highlights: [
    "Low-maintenance landscaped gardens",
    "Separate study or fifth bedroom option",
    "Covered alfresco ideal for year-round entertaining",
  ],
  inspection_cta: "Saturday, 25 April 2026 | 10:00am – 2:00pm",
  disclaimer:
    "Information is general in nature only. The vendor and agent do not warrant accuracy. Buyers should make their own enquiries.",
};

/** Mock agency — logos/colours come from /api/agencies in live preview when logged in. */
const PLAYGROUND_AGENCY = {
  name: "Sample Agency",
  logo_url: "",
  logo_light_url: "",
  logo_dark_url: "",
  primary_colour: DEFAULT_BRAND_VALUES.primary_colour ?? "#002e36",
  secondary_colour: DEFAULT_BRAND_VALUES.secondary_colour ?? "#f9f5ea",
  accent_colour: DEFAULT_BRAND_VALUES.accent_colour ?? "#e8efe3",
  text_colour: DEFAULT_BRAND_VALUES.text_colour ?? "#002e36",
  background_colour: DEFAULT_BRAND_VALUES.background_colour ?? "#f9f5ea",
  heading_font_family: DEFAULT_BRAND_VALUES.heading_font_family ?? "fraunces",
  body_font_family: DEFAULT_BRAND_VALUES.body_font_family ?? "inter",
  font_family: DEFAULT_BRAND_VALUES.font_family ?? "inter",
  heading_font_file_url: "",
  body_font_file_url: "",
  font_file_url: "",
  website_url: "https://example.com",
  email: "hello@example.com",
  phone: "02 9000 1234",
  brand_advanced: null,
};

const PLAYGROUND_AGENT = {
  name: "Harvey Specter",
  role_title: "Licensed Real Estate Agent",
  phone: "0419 290 030",
  email: "harvey.specter@example.com",
  photo_url: "",
};

export function createPlaygroundSalesBrochureDocument(
  templateId: string = SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID,
): SalesBrochureDocumentJson {
  const images = [...PLAYGROUND_BROCHURE_IMAGES];
  const pageOneImages = [images[0], images[1], images[2], images[3]];

  return {
    version: "sales_brochure_v1",
    type: "sales_brochure",
    template_id: templateId,
    generated_at: new Date().toISOString(),
    agency: PLAYGROUND_AGENCY,
    agent: PLAYGROUND_AGENT,
    agents: [PLAYGROUND_AGENT],
    property: {
      address: "42 Oceanview Parade",
      suburb: "Manly",
      state: "NSW",
      postcode: "2095",
      summary: "Four-bedroom family home with garden and alfresco",
      property_type: "House",
      bedrooms: 4,
      bathrooms: 2,
      car_spaces: 2,
      land_area_sqm: 612,
      display_price: "$2,450,000",
      hero_image_url: images[0],
      selected_image_urls: images,
      page_one_image_urls: pageOneImages,
      page_two_image_urls: images.slice(4),
    },
    copy: PLAYGROUND_COPY,
    qr_target_url: "https://example.com/listing",
    assets: {
      qr_code_url:
        "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://example.com",
    },
  };
}
