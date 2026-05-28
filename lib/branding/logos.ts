import type { CSSProperties } from "react";

/** Surface the logo sits on — not the logo asset colour. */
export type BrandLogoSurface = "light" | "dark";

export type AgencyLogoFields = {
  logo_url?: string | null;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
};

export type ResolvedAgencyLogos = {
  /** Logo for light backgrounds (dark/coloured mark). */
  onLight: string;
  /** Logo for dark backgrounds (light/white mark). */
  onDark: string;
  /** @deprecated Use onLight — kept for legacy `logo_url` consumers. */
  legacy: string;
};

export function resolveAgencyLogos(agency: AgencyLogoFields): ResolvedAgencyLogos {
  const onLight =
    agency.logo_dark_url?.trim() ||
    agency.logo_url?.trim() ||
    "";
  const onDark = agency.logo_light_url?.trim() || "";

  return {
    onLight,
    onDark,
    legacy: onLight,
  };
}

export function getAgencyLogoUrl(
  agency: AgencyLogoFields,
  surface: BrandLogoSurface,
): string {
  const logos = resolveAgencyLogos(agency);
  return surface === "dark" ? logos.onDark : logos.onLight;
}

export function getBrandLogoCssVars(agency: AgencyLogoFields): Record<string, string> {
  const logos = resolveAgencyLogos(agency);

  return {
    "--brand-logo-on-light": logos.onLight,
    "--brand-logo-on-dark": logos.onDark,
    "--brand-logo-url": logos.legacy,
  };
}

export function getBrandLogoCssVarsStyle(agency: AgencyLogoFields): CSSProperties {
  return getBrandLogoCssVars(agency) as CSSProperties;
}
