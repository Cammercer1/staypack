import {
  BUSINESS_CARD_VARIANT_IDS,
  normalizeBusinessCardVariantId,
  type BusinessCardVariantId,
} from "@/lib/collateral/business-card/formats";
import { BUSINESS_CARD_CLASSIC_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import type {
  BusinessCardLayers,
  BusinessCardDocumentJson,
  BusinessCardLayerState,
  BusinessCardVariantState,
  CollateralBrandSlice,
  CollateralListingSlice,
} from "@/lib/collateral/templates/types";

const DEFAULT_VARIANTS: Record<BusinessCardVariantId, BusinessCardVariantState> = {
  front: {
    headline: "",
    subcopy: "",
    show_logo: true,
    show_agent_photo: true,
    show_contact: true,
    show_agency_details: false,
    show_qr: false,
    background_style: "light",
    layers: {
      // Left accent strip occupies ~4% width; content starts at ~8% from left
      logo: { enabled: true, x: 8, y: 10, scale: 1, width: 42 },
      // Photo — right side, large circle
      agent_photo: { enabled: true, x: 67, y: 10, scale: 1, width: 24 },
      // Contact — left side, vertically centred-ish
      agent_contact: { enabled: true, x: 8, y: 40, scale: 1, width: 54 },
      headline: { enabled: false, x: 8, y: 32, scale: 1, width: 56 },
      subcopy: { enabled: false, x: 8, y: 46, scale: 1, width: 52 },
      qr: { enabled: false, x: 72, y: 10, scale: 1, width: 18 },
      agency_details: { enabled: false, x: 8, y: 86, scale: 1, width: 84 },
    },
  },
  back: {
    headline: "Let's talk property.",
    subcopy: "Reach out any time.",
    show_logo: true,
    show_agent_photo: false,
    show_contact: true,
    show_agency_details: true,
    show_qr: true,
    background_style: "brand",
    back_style: "colour",
    back_colour: undefined,
    qr_corner: "bottom_right",
    back_logo_variant: "light",
    back_logo_custom_url: "",
    layers: {
      // Logo — centred area of back card
      logo: { enabled: true, x: 28, y: 40, scale: 1.2, width: 44 },
      headline: { enabled: true, x: 6, y: 30, scale: 1.1, width: 58 },
      subcopy: { enabled: true, x: 6, y: 50, scale: 1, width: 52 },
      agent_photo: { enabled: false, x: 6, y: 44, scale: 1, width: 22 },
      // Contact — bottom-left
      agent_contact: { enabled: true, x: 6, y: 68, scale: 0.9, width: 52 },
      // QR — bottom right
      qr: { enabled: true, x: 68, y: 72, scale: 1.1, width: 22 },
      // Agency line — very bottom
      agency_details: { enabled: true, x: 6, y: 87, scale: 1, width: 84 },
    },
  },
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizeLayer(
  value: Partial<BusinessCardLayerState> | undefined,
  fallback: BusinessCardLayerState,
): BusinessCardLayerState {
  return {
    enabled: normalizeBoolean(value?.enabled, fallback.enabled),
    x: normalizeNumber(value?.x, fallback.x, 0, 100),
    y: normalizeNumber(value?.y, fallback.y, 0, 100),
    scale: normalizeNumber(value?.scale, fallback.scale, 0.25, 3),
    width: normalizeNumber(value?.width, fallback.width, 8, 100),
  };
}

function normalizeLayers(
  value: Partial<BusinessCardLayers> | undefined,
  fallback: BusinessCardLayers,
): BusinessCardLayers {
  return {
    logo: normalizeLayer(value?.logo, fallback.logo),
    headline: normalizeLayer(value?.headline, fallback.headline),
    subcopy: normalizeLayer(value?.subcopy, fallback.subcopy),
    agent_photo: normalizeLayer(value?.agent_photo, fallback.agent_photo),
    agent_contact: normalizeLayer(value?.agent_contact, fallback.agent_contact),
    qr: normalizeLayer(value?.qr, fallback.qr),
    agency_details: normalizeLayer(value?.agency_details, fallback.agency_details),
  };
}

function normalizeQrCorner(
  value: unknown,
  fallback: "bottom_left" | "bottom_right",
): "bottom_left" | "bottom_right" {
  return value === "bottom_left" ? "bottom_left" : value === "bottom_right" ? "bottom_right" : fallback;
}

function normalizeBackStyle(
  value: unknown,
  fallback: "colour" | "photo",
): "colour" | "photo" {
  return value === "photo" ? "photo" : value === "colour" ? "colour" : fallback;
}

function normalizeVariant(
  value: Partial<BusinessCardVariantState> | undefined,
  fallback: BusinessCardVariantState,
): BusinessCardVariantState {
  return {
    headline: value !== undefined ? normalizeText(value?.headline) : fallback.headline,
    subcopy: value !== undefined ? normalizeText(value?.subcopy) : fallback.subcopy,
    show_logo: normalizeBoolean(value?.show_logo, fallback.show_logo),
    show_agent_photo: normalizeBoolean(
      value?.show_agent_photo,
      fallback.show_agent_photo,
    ),
    show_contact: normalizeBoolean(value?.show_contact, fallback.show_contact),
    show_agency_details: normalizeBoolean(
      value?.show_agency_details,
      fallback.show_agency_details,
    ),
    show_qr: normalizeBoolean(value?.show_qr, fallback.show_qr),
    background_style:
      value?.background_style === "brand" ? "brand" : fallback.background_style,
    back_style: normalizeBackStyle(value?.back_style, fallback.back_style ?? "colour"),
    back_colour:
      typeof value?.back_colour === "string" ? value.back_colour : fallback.back_colour,
    qr_corner: normalizeQrCorner(value?.qr_corner, fallback.qr_corner ?? "bottom_right"),
    back_logo_variant:
      value?.back_logo_variant === "dark"
        ? "dark"
        : value?.back_logo_variant === "custom"
          ? "custom"
          : value?.back_logo_variant === "light"
            ? "light"
            : (fallback.back_logo_variant ?? "light"),
    back_logo_custom_url:
      typeof value?.back_logo_custom_url === "string"
        ? value.back_logo_custom_url
        : (fallback.back_logo_custom_url ?? ""),
    layers: normalizeLayers(value?.layers, fallback.layers),
  };
}

function emptyAgency(): CollateralBrandSlice {
  return {
    name: "",
    logo_url: "",
    logo_light_url: "",
    logo_dark_url: "",
    primary_colour: "#111827",
    secondary_colour: "#334155",
    accent_colour: "#f59e0b",
    text_colour: "#111827",
    background_colour: "#ffffff",
    heading_font_family: "fraunces",
    body_font_family: "inter",
    font_family: "inter",
    heading_font_file_url: "",
    body_font_file_url: "",
    font_file_url: "",
    website_url: "",
    email: "",
    phone: "",
    brand_advanced: null,
  };
}

function normalizeListing(value: unknown): CollateralListingSlice | null {
  if (!value || typeof value !== "object") return null;
  const listing = value as Partial<CollateralListingSlice>;
  return {
    address: normalizeText(listing.address),
    suburb: normalizeText(listing.suburb),
    display_price: normalizeText(listing.display_price),
    hero_image_url: normalizeText(listing.hero_image_url),
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    car_spaces: listing.car_spaces ?? null,
    land_area_sqm: listing.land_area_sqm ?? null,
  };
}

export function getDefaultBusinessCardVariants() {
  return {
    front: normalizeVariant(undefined, DEFAULT_VARIANTS.front),
    back: normalizeVariant(undefined, DEFAULT_VARIANTS.back),
  };
}

export function ensureBusinessCardDocument(
  document: BusinessCardDocumentJson,
): BusinessCardDocumentJson {
  const legacyVariant: Partial<BusinessCardVariantState> | undefined =
    document.variants?.front ??
    (document.listing
      ? {
          show_qr: Boolean(document.assets?.qr_code_url),
        }
      : undefined);

  const variants = getDefaultBusinessCardVariants();
  for (const variantId of BUSINESS_CARD_VARIANT_IDS) {
    variants[variantId] = normalizeVariant(
      document.variants?.[variantId] ??
        (variantId === "front" ? legacyVariant : undefined),
      DEFAULT_VARIANTS[variantId],
    );
  }

  return {
    version: "business_card_v1",
    type: "agent_business_card",
    template_id: document.template_id || BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
    generated_at: document.generated_at || new Date().toISOString(),
    agency: document.agency ?? emptyAgency(),
    agent_profile_id: document.agent_profile_id ?? null,
    listing: normalizeListing(document.listing),
    agent: {
      name: normalizeText(document.agent?.name),
      role_title: normalizeText(document.agent?.role_title),
      phone: normalizeText(document.agent?.phone),
      email: normalizeText(document.agent?.email),
      photo_url: normalizeText(document.agent?.photo_url),
    },
    active_variant_id: normalizeBusinessCardVariantId(document.active_variant_id),
    variants,
    qr_listing_id: document.qr_listing_id ?? null,
    qr_target_url: document.qr_target_url ?? "",
    assets: {
      qr_code_url: document.assets?.qr_code_url ?? "",
    },
  };
}
