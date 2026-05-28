import type { CSSProperties } from "react";
import type { Agency } from "@/lib/types";

export type AgencyBrandAdvanced = {
  // Buttons
  button_background_colour?: string | null;
  button_text_colour?: string | null;
  button_border_radius_px?: number | null;
  button_border_width_px?: number | null;
  button_border_colour?: string | null;
  // Links
  link_colour?: string | null;
  // Cards / panels
  card_border_radius_px?: number | null;
  card_border_width_px?: number | null;
  card_border_colour?: string | null;
  card_background_colour?: string | null;
  card_shadow?: "none" | "soft" | "medium" | "strong" | null;
  // Inputs
  input_border_radius_px?: number | null;
};

export type ResolvedBrandAdvanced = {
  buttonBackground: string;
  buttonText: string;
  buttonBorderRadiusPx: number;
  buttonBorderWidthPx: number;
  buttonBorderColour: string;
  linkColour: string;
  cardBorderRadiusPx: number;
  cardBorderWidthPx: number;
  cardBorderColour: string;
  cardBackgroundColour: string;
  cardShadow: string;
  inputBorderRadiusPx: number;
};

export const DEFAULT_BRAND_ADVANCED: AgencyBrandAdvanced = {};

const SHADOW_VALUES = {
  none: "none",
  soft: "0 1px 4px 0 rgba(0,0,0,0.08)",
  medium: "0 4px 16px 0 rgba(0,0,0,0.12)",
  strong: "0 8px 32px 0 rgba(0,0,0,0.18)",
} as const;

export const CARD_SHADOW_PRESETS: { label: string; value: AgencyBrandAdvanced["card_shadow"] }[] = [
  { label: "None", value: "none" },
  { label: "Soft", value: "soft" },
  { label: "Medium", value: "medium" },
  { label: "Strong", value: "strong" },
];

export function parseAgencyBrandAdvanced(
  value: unknown,
): AgencyBrandAdvanced {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as AgencyBrandAdvanced;
}

export function resolveBrandAdvanced(
  agency: Pick<
    Agency,
    "primary_colour" | "text_colour" | "brand_advanced_json"
  >,
): ResolvedBrandAdvanced {
  const advanced = parseAgencyBrandAdvanced(agency.brand_advanced_json);

  return {
    buttonBackground:
      advanced.button_background_colour?.trim() || agency.primary_colour,
    buttonText: advanced.button_text_colour?.trim() || "#ffffff",
    buttonBorderRadiusPx: clampPx(advanced.button_border_radius_px, 0, 32, 0),
    buttonBorderWidthPx: clampPx(advanced.button_border_width_px, 0, 8, 0),
    buttonBorderColour: advanced.button_border_colour?.trim() || "transparent",
    linkColour: advanced.link_colour?.trim() || agency.primary_colour,
    cardBorderRadiusPx: clampPx(advanced.card_border_radius_px, 0, 24, 0),
    cardBorderWidthPx: clampPx(advanced.card_border_width_px, 0, 8, 1),
    cardBorderColour: advanced.card_border_colour?.trim() || "rgba(0,0,0,0.1)",
    cardBackgroundColour: advanced.card_background_colour?.trim() || "rgba(255,255,255,0.9)",
    cardShadow: SHADOW_VALUES[advanced.card_shadow ?? "none"],
    inputBorderRadiusPx: clampPx(advanced.input_border_radius_px, 0, 16, 4),
  };
}

function clampPx(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  if (value == null || Number.isNaN(Number(value))) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Number(value)));
}

export function getBrandButtonInlineStyle(
  resolved: ResolvedBrandAdvanced,
): CSSProperties {
  return {
    backgroundColor: resolved.buttonBackground,
    color: resolved.buttonText,
    borderRadius: resolved.buttonBorderRadiusPx,
    borderWidth: resolved.buttonBorderWidthPx,
    borderStyle: resolved.buttonBorderWidthPx > 0 ? "solid" : undefined,
    borderColor: resolved.buttonBorderColour,
  };
}

export function getBrandCardInlineStyle(
  resolved: ResolvedBrandAdvanced,
): CSSProperties {
  return {
    borderRadius: resolved.cardBorderRadiusPx,
    borderWidth: resolved.cardBorderWidthPx,
    borderStyle: "solid",
    borderColor: resolved.cardBorderColour,
    backgroundColor: resolved.cardBackgroundColour,
    boxShadow: resolved.cardShadow,
  };
}

export function getBrandAdvancedCssVars(
  resolved: ResolvedBrandAdvanced,
): Record<string, string> {
  return {
    "--brand-button-bg": resolved.buttonBackground,
    "--brand-button-text": resolved.buttonText,
    "--brand-button-radius": `${resolved.buttonBorderRadiusPx}px`,
    "--brand-button-border-width": `${resolved.buttonBorderWidthPx}px`,
    "--brand-button-border-color": resolved.buttonBorderColour,
    "--brand-link-colour": resolved.linkColour,
    "--brand-card-radius": `${resolved.cardBorderRadiusPx}px`,
    "--brand-card-border-width": `${resolved.cardBorderWidthPx}px`,
    "--brand-card-border-color": resolved.cardBorderColour,
    "--brand-card-bg": resolved.cardBackgroundColour,
    "--brand-card-shadow": resolved.cardShadow,
    "--brand-input-radius": `${resolved.inputBorderRadiusPx}px`,
  };
}

export function hasBrandAdvancedOverrides(
  advanced: AgencyBrandAdvanced | null | undefined,
) {
  if (!advanced) return false;

  return Object.values(advanced).some(
    (value) => value != null && value !== "",
  );
}
