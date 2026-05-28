import type { CSSProperties } from "react";
import type { SocialPostLogoColour } from "@/lib/collateral/templates/types";

export const SOCIAL_POST_LOGO_COLOUR_OPTIONS: {
  value: SocialPostLogoColour;
  label: string;
}[] = [
  { value: "original", label: "Original" },
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "primary", label: "Brand" },
];

export function normalizeLogoColour(
  value: string | undefined,
): SocialPostLogoColour {
  if (value === "white" || value === "black" || value === "primary") {
    return value;
  }
  return "original";
}

export type SocialPostLogoPresentation =
  | { mode: "image"; imageStyle?: CSSProperties }
  | {
      mode: "mask";
      backgroundColour: string;
      maskPosition: string;
    };

export function resolveSocialPostLogoPresentation(options: {
  colour: SocialPostLogoColour | undefined;
  primaryColour: string;
  placementEndsRight: boolean;
}): SocialPostLogoPresentation {
  const colour = normalizeLogoColour(options.colour);

  if (colour === "white") {
    return {
      mode: "image",
      imageStyle: { filter: "brightness(0) invert(1)" },
    };
  }

  if (colour === "black") {
    return {
      mode: "image",
      imageStyle: { filter: "brightness(0)" },
    };
  }

  if (colour === "primary") {
    return {
      mode: "mask",
      backgroundColour: options.primaryColour,
      maskPosition: options.placementEndsRight ? "right top" : "left top",
    };
  }

  return { mode: "image" };
}
