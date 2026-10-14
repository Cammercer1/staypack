import { z } from "zod";
import { BODY_FONT_PRESETS, HEADING_FONT_PRESETS } from "@/lib/branding/presets";
import type { FinalReportJson } from "@/lib/types";

const colour = z.string().regex(/^#[\da-f]{6}$/i, "Use a six-digit hex colour.");
const font = z.string().min(1).max(160).regex(/^[\w\s,'"-]+$/, "Use a font family name.");
export const brandSchema = z.object({
  background: colour, surface: colour, text: colour, muted: colour,
  primary: colour, primaryText: colour,
  chartLtr: colour, chartMarket: colour, chartManaged: colour,
  headingFont: font, bodyFont: font, radius: z.number().int().min(0).max(32),
}).strict();
export const brandOverridesSchema = brandSchema.partial();
export type ProposalBrand = z.infer<typeof brandSchema>;
export type BrandOverrides = Partial<ProposalBrand>;
export type BrandField = keyof ProposalBrand;
export const BRAND_DEFAULTS: ProposalBrand = {
  background: "#fffdf8", surface: "#f3ede0", text: "#002e36", muted: "#4d6568",
  primary: "#095b42", primaryText: "#ffffff", chartLtr: "#7b8984", chartMarket: "#91af9d", chartManaged: "#095b42",
  headingFont: "Fraunces, Georgia, serif", bodyFont: "DM Sans, Arial, sans-serif", radius: 16,
};
export const BRAND_PRESETS = {
  staypack: { name: "StayPack · editorial", values: {} },
  coastal: { name: "Coastal · relaxed", values: {
    background: "#f7fafb", surface: "#e9f0f3", text: "#173c4a", muted: "#506975",
    primary: "#23586a", chartLtr: "#869aa2", chartMarket: "#9dbbca", chartManaged: "#23586a", radius: 24,
  } },
  studio: { name: "Studio · minimal", values: {
    background: "#ffffff", surface: "#f0f0ee", text: "#222824", muted: "#5c625e",
    primary: "#222824", chartLtr: "#929b96", chartMarket: "#bac3bd", chartManaged: "#222824",
    headingFont: "DM Sans, Arial, sans-serif", radius: 2,
  } },
} satisfies Record<string, { name: string; values: BrandOverrides }>;
export type PresetId = keyof typeof BRAND_PRESETS;
export type BrandSource = "base" | "preset" | "account" | "template" | "appraisal";

export function resolveProposalBrand(input: {
  presetId: PresetId; account?: BrandOverrides; template?: BrandOverrides; appraisal?: BrandOverrides;
  lockedFields?: readonly BrandField[]; editableFields?: readonly BrandField[];
}) {
  const values = { ...BRAND_DEFAULTS };
  const sources = Object.fromEntries(Object.keys(values).map(key => [key, "base"])) as Record<BrandField, BrandSource>;
  const apply = (layer: BrandOverrides | undefined, source: BrandSource) => {
    const parsed = brandOverridesSchema.parse(layer ?? {});
    for (const key of Object.keys(parsed) as BrandField[]) {
      if (parsed[key] === undefined) continue;
      if (source === "appraisal" && (input.lockedFields?.includes(key) || !input.editableFields?.includes(key))) continue;
      Object.assign(values, { [key]: parsed[key] });
      sources[key] = source;
    }
  };
  apply(BRAND_PRESETS[input.presetId].values, "preset");
  apply(input.account, "account"); apply(input.template, "template"); apply(input.appraisal, "appraisal");
  return { values: brandSchema.parse(values), sources };
}
export function resetBrandOverride(overrides: BrandOverrides, key: BrandField): BrandOverrides {
  const next = { ...overrides }; delete next[key]; return next;
}

/** Adapt existing brand settings without binding digital templates to PDF design IDs. */
export function brandFromReport(agency: FinalReportJson["agency"]): BrandOverrides {
  const candidates = {
    background: agency.background_colour, surface: agency.brand_advanced?.card_background_colour,
    text: agency.text_colour, primary: agency.primary_colour, chartManaged: agency.primary_colour,
    primaryText: agency.brand_advanced?.button_text_colour, radius: agency.brand_advanced?.card_border_radius_px,
    headingFont: HEADING_FONT_PRESETS.find(f => f.id === agency.heading_font_family)?.family ?? agency.heading_font_family,
    bodyFont: BODY_FONT_PRESETS.find(f => f.id === agency.body_font_family)?.family ?? agency.body_font_family,
  };
  const result: BrandOverrides = {};
  for (const key of Object.keys(candidates) as (keyof typeof candidates)[]) {
    const value = candidates[key];
    if (value !== undefined && brandSchema.shape[key].safeParse(value).success) Object.assign(result, { [key]: value });
  }
  return result;
}

export { proposalBrandStyle } from "./brandStyle";
export function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const rgb = hex.slice(1).match(/../g)!.map(n => parseInt(n, 16) / 255)
      .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
