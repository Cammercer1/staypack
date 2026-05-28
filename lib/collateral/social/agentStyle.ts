import type { CSSProperties } from "react";
import type { CollateralBrandSlice } from "@/lib/collateral/templates/types";
import type {
  SocialPostAgentBackgroundStyle,
  SocialPostAgentBrandColour,
  SocialPostAgentLayer,
} from "@/lib/collateral/templates/types";

const HEX_COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHexColour(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  if (HEX_COLOUR.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }
  return fallback;
}

export function normalizeAgentBackgroundStyle(
  value: string | undefined,
): SocialPostAgentBackgroundStyle {
  if (
    value === "none" ||
    value === "glass" ||
    value === "brand" ||
    value === "custom"
  ) {
    return value;
  }
  return "none";
}

export function normalizeAgentBrandColour(
  value: string | undefined,
): SocialPostAgentBrandColour {
  if (value === "secondary" || value === "accent") {
    return value;
  }
  return "primary";
}

export function resolveBrandColourKey(
  agency: CollateralBrandSlice,
  key: SocialPostAgentBrandColour,
) {
  switch (key) {
    case "secondary":
      return agency.secondary_colour;
    case "accent":
      return agency.accent_colour;
    default:
      return agency.primary_colour;
  }
}

export type ResolvedAgentBlockStyle = {
  containerClassName: string;
  containerStyle: CSSProperties;
  textColour: string;
  textShadow: string | undefined;
};

export function resolveAgentBlockStyle(
  agency: CollateralBrandSlice,
  layer: SocialPostAgentLayer,
): ResolvedAgentBlockStyle {
  const backgroundStyle = normalizeAgentBackgroundStyle(layer.background_style);
  const brandKey = normalizeAgentBrandColour(layer.brand_colour);
  const defaultText = "#ffffff";
  const textColour = normalizeHexColour(
    layer.text_colour,
    agency.text_colour?.trim() ? normalizeHexColour(agency.text_colour, defaultText) : defaultText,
  );

  switch (backgroundStyle) {
    case "none":
      return {
        containerClassName: "",
        containerStyle: {},
        textColour,
        textShadow: "0 1px 4px rgba(0,0,0,0.85)",
      };
    case "brand": {
      const bg = resolveBrandColourKey(agency, brandKey);
      return {
        containerClassName: "rounded-lg px-2 py-1.5",
        containerStyle: { backgroundColor: bg },
        textColour,
        textShadow: undefined,
      };
    }
    case "custom":
      return {
        containerClassName: "rounded-lg px-2 py-1.5",
        containerStyle: {
          backgroundColor: normalizeHexColour(
            layer.background_colour,
            agency.primary_colour,
          ),
        },
        textColour,
        textShadow: undefined,
      };
    case "glass":
    default:
      return {
        containerClassName:
          "rounded-lg bg-black/45 px-2 py-1.5 backdrop-blur-sm",
        containerStyle: {},
        textColour,
        textShadow: "0 1px 3px rgba(0,0,0,0.75)",
      };
  }
}

export function defaultAgentLayerStyle(
  agency: CollateralBrandSlice,
): Pick<
  SocialPostAgentLayer,
  | "background_style"
  | "background_colour"
  | "text_colour"
  | "brand_colour"
> {
  return {
    background_style: "none",
    background_colour: agency.primary_colour,
    text_colour: "#ffffff",
    brand_colour: "primary",
  };
}
