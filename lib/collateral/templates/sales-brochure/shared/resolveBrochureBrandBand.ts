import { resolveBrandAdvanced } from "@/lib/branding/advanced";
import { getReadableTextOnBackground } from "@/lib/branding/contrast";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";

/** Primary brand fill + contrasting label/text for brochure header/footer/stat bars. */
export function resolveBrochureBrandBand(agency: BrochureDocumentJson["agency"]) {
  const background = agency.primary_colour?.trim() || "#1a1a2e";
  const advanced = resolveBrandAdvanced({
    primary_colour: agency.primary_colour,
    text_colour: agency.text_colour,
    brand_advanced_json: agency.brand_advanced ?? null,
  });

  const text = getReadableTextOnBackground(background, {
    lightText: advanced.buttonText,
    darkText: agency.text_colour?.trim() || "#111111",
  });

  return { background, text };
}
