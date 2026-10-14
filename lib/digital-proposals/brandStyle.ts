import type { CSSProperties } from "react";
import type { ProposalBrand } from "./brand";

function fontCss(value: string) {
  if (value.startsWith("Fraunces")) return "var(--font-display), Georgia, serif";
  if (value.startsWith("DM Sans")) return "var(--font-sans), Arial, sans-serif";
  return value;
}
/** Runtime CSS variables are intentional: presets/overrides are user-editable data. */
export function proposalBrandStyle(brand: ProposalBrand): CSSProperties {
  return {
    "--proposal-bg": brand.background, "--proposal-surface": brand.surface, "--proposal-text": brand.text,
    "--proposal-muted": brand.muted, "--proposal-primary": brand.primary, "--proposal-on-primary": brand.primaryText,
    "--proposal-heading": fontCss(brand.headingFont), "--proposal-body": fontCss(brand.bodyFont),
    "--proposal-radius": `${brand.radius}px`,
  } as CSSProperties;
}
