import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import {
  SOCIAL_POST_VARIANT_IDS,
  getDefaultSocialPostVariantId,
} from "@/lib/collateral/social/formats";
import {
  buildAllVariantStates,
  getLayersForVariant,
} from "@/lib/collateral/social/variantLayers";
import {
  defaultFeaturesEnabledForListing,
  defaultFeaturesLayer,
  listingStatsFromListing,
  normalizeListingSlice,
} from "@/lib/collateral/social/listingFeatures";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

type BuildSocialPostsInput = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
};

function resolveListingAddress(listing: Listing) {
  const scraped = listing.scraped_listing_json;

  return (
    listing.property_address ??
    scraped?.address ??
    listing.listing_title ??
    "Property"
  );
}

function buildVariantBackgrounds(images: string[], fallback: string) {
  const pool = images.length ? images : fallback ? [fallback] : [""];
  const hero = pool[0] ?? "";

  return SOCIAL_POST_VARIANT_IDS.reduce(
    (acc, variantId, index) => {
      const primary = pool[index % pool.length] ?? hero;
      acc[variantId] = {
        background_layout: "single",
        background_image_urls: [primary],
        background_image_url: primary,
      };
      return acc;
    },
    {} as SocialPostsDocumentJson["variants"],
  );
}

export function buildSocialPostsDocument({
  agency,
  listing,
  collateral,
  agentProfile,
  agencyAgents,
}: BuildSocialPostsInput): SocialPostsDocumentJson {
  const scraped = listing.scraped_listing_json;
  const socialImages = resolveCollateralImageSelection(listing, "social_posts");
  const backgrounds = [
    socialImages.hero_image_url,
    ...socialImages.selected_image_urls,
  ].filter((url): url is string => Boolean(url));

  const hero =
    socialImages.hero_image_url ??
    socialImages.selected_image_urls[0] ??
    listing.hero_image_url ??
    listing.selected_image_urls?.[0] ??
    scraped?.images?.[0] ??
    "";

  const address = resolveListingAddress(listing);
  const agencyBrand = buildAgencyBrandSlice(agency);
  const agents = resolveReportAgents({
    scraped,
    agentProfile,
    agencyAgents,
  });
  const agent = primaryReportAgent(agents);
  const activeVariantId = getDefaultSocialPostVariantId();

  const agentSlice = {
    name: agent.name,
    role_title: agent.role_title,
    phone: agent.phone,
    email: agent.email,
    photo_url: agent.photo_url,
  };

  const variantBackgrounds = buildVariantBackgrounds(backgrounds, hero);

  const baseDocument: SocialPostsDocumentJson = {
    version: "social_posts_v1",
    type: "social_posts",
    template_id: resolveCollateralTemplateId(agency, collateral),
    generated_at: new Date().toISOString(),
    agency: agencyBrand,
    listing: normalizeListingSlice({
      address,
      suburb: listing.suburb ?? scraped?.suburb ?? "",
      display_price: listing.display_price ?? scraped?.displayPrice ?? "",
      hero_image_url: hero,
      ...listingStatsFromListing(listing),
    }),
    agent: agentSlice,
    active_variant_id: activeVariantId,
    variants: variantBackgrounds,
    layers: {
      logo: {
        enabled: Boolean(agency.logo_url),
        placement: "top_left",
        scale: 1,
        colour: "original",
      },
      title: {
        enabled: true,
        text: address,
        block_placement: "bottom_left",
        scale: 1,
        box_width_scale: 1,
        box_height_scale: 1,
        align: "left",
        zone_inset_top: 0,
        zone_inset_bottom: 0,
        line_gap_scale: 1,
      },
      subcopy: {
        enabled: false,
        text: "",
        block_placement: "bottom_left",
        scale: 1,
        box_width_scale: 1,
        box_height_scale: 1,
        align: "left",
        zone_inset_top: 0,
        zone_inset_bottom: 0,
        line_gap_scale: 1,
      },
      features: defaultFeaturesLayer("square", {
        enabled: defaultFeaturesEnabledForListing(
          normalizeListingSlice({
            address,
            suburb: listing.suburb ?? scraped?.suburb ?? "",
            display_price: listing.display_price ?? scraped?.displayPrice ?? "",
            hero_image_url: hero,
            ...listingStatsFromListing(listing),
          }),
        ),
      }),
      agent: {
        enabled: false,
        placement: "bottom_left",
        scale: 1,
        inner_gap_scale: 1,
        layout: "horizontal",
        avatar_shape: "circle",
        background_style: "none",
        background_colour: agencyBrand.primary_colour,
        text_colour: "#ffffff",
        brand_colour: "primary",
      },
    },
  };

  const variants = buildAllVariantStates(baseDocument, {
    address,
    agency: agencyBrand,
    agent: agentSlice,
    logoEnabled: Boolean(agency.logo_url),
  });

  const withVariants: SocialPostsDocumentJson = {
    ...baseDocument,
    variants,
    layers: getLayersForVariant(
      { ...baseDocument, variants },
      activeVariantId,
    ),
  };

  return withVariants;
}
