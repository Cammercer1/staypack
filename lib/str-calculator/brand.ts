import type { CSSProperties } from "react";
import type { Agency } from "@/lib/types";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { resolveBodyFontFamily, resolveHeadingFontFamily } from "@/lib/branding/google-fonts";
import { contrastRatio } from "@/lib/digital-proposals/brand";

export type CalculatorBrand = Pick<Agency, "name" | "heading_font_family" | "body_font_family" | "heading_font_file_url" | "body_font_file_url"> & {
  logo: string; primary: string; onPrimary: string; background: string; text: string; surface: string;
};
const colour = (value: unknown, fallback: string) => typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
const readable = (foreground: string, background: string) => contrastRatio(foreground, background) >= 4.5
  ? foreground : contrastRatio("#ffffff", background) > contrastRatio("#172b26", background) ? "#ffffff" : "#172b26";
const asset = (value: string | null | undefined) => value && (/^https:\/\//i.test(value) || /^\/(?!\/)/.test(value)) && !/["'<>\s\\]/.test(value) ? value : null;

/** Public projection: never serialize the whole agency row into an embed. */
export function calculatorBrand(agency: Agency): CalculatorBrand {
  const background = colour(agency.background_colour, "#ffffff");
  const primary = colour(agency.brand_advanced_json?.button_background_colour, colour(agency.primary_colour, "#095b42"));
  return {
    name: agency.name,
    logo: asset(getAgencyLogoUrl(agency, contrastRatio("#ffffff", background) > 4.5 ? "dark" : "light")) ?? "",
    primary, onPrimary: readable(colour(agency.brand_advanced_json?.button_text_colour, "#ffffff"), primary),
    background, text: readable(colour(agency.text_colour, "#172b26"), background), surface: background,
    heading_font_family: agency.heading_font_family || agency.font_family || "fraunces",
    body_font_family: agency.body_font_family || agency.font_family || "inter",
    heading_font_file_url: asset(agency.heading_font_file_url),
    body_font_file_url: asset(agency.body_font_file_url || agency.font_file_url),
  };
}

/** Runtime brand values are user data, following the existing proposal theme. */
export function calculatorBrandStyle(brand: CalculatorBrand): CSSProperties {
  return {
    "--proposal-bg": brand.background, "--proposal-surface": brand.surface, "--proposal-text": brand.text,
    "--proposal-primary": brand.primary, "--proposal-on-primary": brand.onPrimary,
    // Tailwind's existing primary utilities use the shadcn token aliases.
    "--primary": brand.primary, "--primary-foreground": brand.onPrimary,
    "--proposal-heading": resolveHeadingFontFamily(brand.heading_font_family, brand.heading_font_file_url),
    "--proposal-body": resolveBodyFontFamily(brand.body_font_family, brand.body_font_file_url),
  } as CSSProperties;
}
