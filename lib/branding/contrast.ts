/** Relative luminance (sRGB), 0–1. */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function parseHexColour(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) {
    return null;
  }
  const hex =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** True when the fill reads as a light surface (use dark text). */
export function isLightColour(colour: string): boolean {
  const rgb = parseHexColour(colour);
  if (!rgb) {
    return false;
  }
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.55;
}

/** Text colour that contrasts with a brand fill (bars, footers, buttons). */
export function getReadableTextOnBackground(
  background: string,
  options?: { lightText?: string; darkText?: string },
): string {
  const lightText = options?.lightText?.trim() || "#ffffff";
  const darkText = options?.darkText?.trim() || "#111111";
  return isLightColour(background) ? darkText : lightText;
}
