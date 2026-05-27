import {
  BODY_FONT_PRESETS,
  FONT_PRESETS,
  HEADING_FONT_PRESETS,
  type FontPreset,
} from "@/lib/branding/presets";

export type GoogleFontCategory =
  | "All"
  | "Sans Serif"
  | "Serif"
  | "Display"
  | "Handwriting"
  | "Monospace";

export type GoogleFontListItem = {
  family: string;
  category: string;
  popularity: number;
};

const FALLBACKS: Record<string, string> = {
  "Sans Serif": "system-ui, sans-serif",
  Serif: "Georgia, serif",
  Display: "Georgia, serif",
  Handwriting: "cursive",
  Monospace: "ui-monospace, monospace",
};

export function slugifyFontFamily(family: string) {
  return family.toLowerCase().replace(/\s+/g, "-");
}

export function encodeGoogleFontFamily(family: string) {
  return family.trim().replace(/\s+/g, "+");
}

export function findFontPreset(fontId: string): FontPreset | undefined {
  const normalized = fontId.trim().toLowerCase();

  return FONT_PRESETS.find(
    (preset) =>
      preset.id === fontId ||
      preset.id.toLowerCase() === normalized ||
      preset.googleFont?.replace(/\+/g, " ").toLowerCase() === normalized ||
      preset.family.replace(/"/g, "").split(",")[0]?.trim().toLowerCase() === normalized,
  );
}

function findPreset(fontId: string): FontPreset | undefined {
  return findFontPreset(fontId);
}

export function getFontDisplayName(fontId: string) {
  const preset = findPreset(fontId);
  if (preset) {
    return preset.label.split(" · ")[0] ?? preset.label;
  }

  return fontId;
}

export function getGoogleFontCssName(fontId: string) {
  const preset = findPreset(fontId);
  if (preset?.googleFont) {
    return preset.googleFont;
  }

  return encodeGoogleFontFamily(fontId);
}

export function resolveGoogleFontFamily(
  fontId: string,
  fontFileUrl?: string | null,
  options?: { customName?: string; category?: string },
) {
  if (fontFileUrl) {
    return `${options?.customName ?? "AgencyFont"}, ${
      FALLBACKS[options?.category ?? "Sans Serif"] ?? "system-ui, sans-serif"
    }`;
  }

  const preset = findPreset(fontId);
  if (preset) {
    return preset.family;
  }

  const fallback =
    FALLBACKS[options?.category ?? "Sans Serif"] ?? "system-ui, sans-serif";
  const quoted = fontId.includes(" ") ? `"${fontId}"` : fontId;
  return `${quoted}, ${fallback}`;
}

export function resolveHeadingFontFamily(
  fontId: string,
  fontFileUrl?: string | null,
) {
  if (fontFileUrl) {
    return "AgencyHeadingFont, Georgia, serif";
  }

  const preset = findFontPreset(fontId);
  if (preset) {
    return preset.family;
  }

  return resolveGoogleFontFamily(fontId, null, { category: "Serif" });
}

export function resolveBodyFontFamily(
  fontId: string,
  fontFileUrl?: string | null,
) {
  if (fontFileUrl) {
    return "AgencyBodyFont, system-ui, sans-serif";
  }

  const preset = findFontPreset(fontId);
  if (preset) {
    return preset.family;
  }

  return resolveGoogleFontFamily(fontId, null, { category: "Sans Serif" });
}

export function buildGoogleFontStylesheetUrl(
  families: string[],
  options?: { text?: string; weights?: string },
) {
  const unique = [...new Set(families.filter(Boolean))];
  if (unique.length === 0) {
    return null;
  }

  const weightSpec = options?.weights ?? "400;500;600;700";
  const params = unique.map(
    (family) => `family=${getGoogleFontCssName(family)}:wght@${weightSpec}`,
  );

  if (options?.text) {
    params.push(`text=${encodeURIComponent(options.text)}`);
  }

  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

export function buildBrandGoogleFontsUrl(
  headingFontId: string,
  bodyFontId: string,
  headingFontFileUrl?: string | null,
  bodyFontFileUrl?: string | null,
) {
  const families: string[] = [];

  if (!headingFontFileUrl) {
    families.push(headingFontId);
  }

  if (!bodyFontFileUrl && bodyFontId !== headingFontId) {
    families.push(bodyFontId);
  }

  return buildGoogleFontStylesheetUrl(families);
}

export const GOOGLE_FONT_CATEGORIES: GoogleFontCategory[] = [
  "All",
  "Sans Serif",
  "Serif",
  "Display",
  "Handwriting",
  "Monospace",
];

export const POPULAR_HEADING_FONTS = [
  "fraunces",
  "playfair-display",
  "dm-serif-display",
  "montserrat",
  "oswald",
  "libre-baskerville",
];

export const POPULAR_BODY_FONTS = [
  "inter",
  "dm-sans",
  "source-sans-3",
  "lato",
  "open-sans",
  "nunito-sans",
];
