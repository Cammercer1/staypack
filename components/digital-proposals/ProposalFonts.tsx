import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import { usesManrope, usesMontserrat, usesRoboto } from "@/lib/digital-proposals/fonts";

/** Keep the brand font local and warm it once for charts, page changes and portals. */
export function ProposalFonts({ brand }: { brand: ProposalBrand }) {
  const fonts = [
    ...(usesRoboto(brand) ? [{ family: "Roboto", file: "roboto-latin-variable.woff2", weight: "100 900" }] : []),
    ...(usesManrope(brand) ? [{ family: "Manrope", file: "manrope-latin-variable.woff2", weight: "200 800" }] : []),
    ...(usesMontserrat(brand) ? [{ family: "Montserrat", file: "montserrat-latin-variable.woff2", weight: "100 900" }] : []),
  ];
  return <>{fonts.map(font => <link key={font.file} rel="preload" href={`/fonts/${font.file}`} as="font" type="font/woff2" crossOrigin="anonymous" />)}
    {fonts.length > 0 && <style>{fonts.map(font => `@font-face{font-family:${font.family};font-style:normal;font-weight:${font.weight};font-display:swap;src:url('/fonts/${font.file}') format('woff2')}`).join("")}</style>}
  </>;
}
