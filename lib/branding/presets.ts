export type FontPreset = {
  id: string;
  label: string;
  description: string;
  family: string;
  googleFont?: string;
};

export const HEADING_FONT_PRESETS: FontPreset[] = [
  {
    id: "fraunces",
    label: "Fraunces · elegant serif",
    description: "Premium serif for report titles and agency name.",
    family: "Fraunces, Georgia, serif",
    googleFont: "Fraunces",
  },
  {
    id: "playfair-display",
    label: "Playfair Display · classic",
    description: "High-end classic look for headings.",
    family: '"Playfair Display", Georgia, serif',
    googleFont: "Playfair+Display",
  },
  {
    id: "dm-serif-display",
    label: "DM Serif Display · editorial",
    description: "Strong editorial style for headings.",
    family: '"DM Serif Display", Georgia, serif',
    googleFont: "DM+Serif+Display",
  },
  {
    id: "montserrat",
    label: "Montserrat · modern sans",
    description: "Clean, modern headings without serif.",
    family: "Montserrat, system-ui, sans-serif",
    googleFont: "Montserrat",
  },
  {
    id: "manrope",
    label: "Manrope · geometric sans",
    description: "Rounded geometric sans for headings and body.",
    family: "Manrope, system-ui, sans-serif",
    googleFont: "Manrope",
  },
  {
    id: "oswald",
    label: "Oswald · bold sans",
    description: "Bold, confident headings for high-impact reports.",
    family: "Oswald, Arial, sans-serif",
    googleFont: "Oswald",
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville · traditional",
    description: "Traditional serif for established agencies.",
    family: '"Libre Baskerville", Georgia, serif',
    googleFont: "Libre+Baskerville",
  },
];

export const BODY_FONT_PRESETS: FontPreset[] = [
  {
    id: "inter",
    label: "Inter · modern & clean",
    description: "Best default for easy reading.",
    family: "Inter, system-ui, sans-serif",
    googleFont: "Inter",
  },
  {
    id: "manrope",
    label: "Manrope · geometric sans",
    description: "Rounded geometric sans for headings and body.",
    family: "Manrope, system-ui, sans-serif",
    googleFont: "Manrope",
  },
  {
    id: "dm-sans",
    label: "DM Sans · friendly",
    description: "Soft, approachable body text.",
    family: '"DM Sans", system-ui, sans-serif',
    googleFont: "DM+Sans",
  },
  {
    id: "source-sans-3",
    label: "Source Sans 3 · professional",
    description: "Neutral and highly readable.",
    family: '"Source Sans 3", system-ui, sans-serif',
    googleFont: "Source+Sans+3",
  },
  {
    id: "lato",
    label: "Lato · balanced",
    description: "Popular, balanced sans-serif.",
    family: "Lato, system-ui, sans-serif",
    googleFont: "Lato",
  },
  {
    id: "open-sans",
    label: "Open Sans · safe choice",
    description: "Works everywhere. Good if unsure.",
    family: '"Open Sans", system-ui, sans-serif',
    googleFont: "Open+Sans",
  },
  {
    id: "nunito-sans",
    label: "Nunito Sans · soft",
    description: "Rounded, friendly body copy.",
    family: '"Nunito Sans", system-ui, sans-serif',
    googleFont: "Nunito+Sans",
  },
];

export const FONT_PRESETS = [...HEADING_FONT_PRESETS, ...BODY_FONT_PRESETS];

export const BRAND_COLOUR_FIELDS = [
  {
    key: "background_colour" as const,
    label: "Report background",
    helper: "The main page colour behind your report content.",
    example: "#f9f5ea",
  },
  {
    key: "text_colour" as const,
    label: "Text colour",
    helper: "Used for headings, addresses and body text.",
    example: "#002e36",
  },
  {
    key: "primary_colour" as const,
    label: "Header text",
    helper: "Used for key numbers, headers and important buttons.",
    example: "#002e36",
  },
  {
    key: "accent_colour" as const,
    label: "Highlight box",
    helper: "Used for callouts, cards and secondary sections.",
    example: "#e8efe3",
  },
  {
    key: "callout_heading_colour" as const,
    label: "Highlight box heading colour",
    helper: "Heading colour inside highlight boxes.",
    example: "#ffffff",
  },
  {
    key: "callout_text_colour" as const,
    label: "Highlight box text colour",
    helper: "Body text colour inside highlight boxes. Change this when your callout background is dark.",
    example: "#ffffff",
  },
] as const;

export function getHeadingFontPreset(id: string) {
  return (
    HEADING_FONT_PRESETS.find((preset) => preset.id === id) ??
    HEADING_FONT_PRESETS[0]
  );
}

export function getBodyFontPreset(id: string) {
  return BODY_FONT_PRESETS.find((preset) => preset.id === id) ?? BODY_FONT_PRESETS[0];
}

export function getFontPreset(id: string) {
  return FONT_PRESETS.find((preset) => preset.id === id) ?? getBodyFontPreset("inter");
}
