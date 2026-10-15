import { describe, expect, it } from "vitest";
import { BRAND_DEFAULTS } from "./brand";
import { proposalPrintFontUrl } from "./fonts";

describe("standalone proposal PDF fonts", () => {
  it("loads the default fonts outside the Next.js layout", () => {
    const url = new URL(proposalPrintFontUrl(BRAND_DEFAULTS)!);
    expect(url.searchParams.getAll("family")).toEqual(["Fraunces:wght@400;500;600;700", "DM Sans:wght@400;500;600;700"]);
  });
  it.each(["Inter", "Manrope", "Montserrat", "Roboto", "Fraunces", "DM Sans"])("loads %s once for quoted and case-insensitive stacks", family => {
    const url = proposalPrintFontUrl({ ...BRAND_DEFAULTS, headingFont: ` '${family.toLowerCase()}' , serif`, bodyFont: `"${family}", Arial, sans-serif` });
    expect(new URL(url!).searchParams.getAll("family")).toEqual([`${family}:wght@400;500;600;700`]);
  });
  it("does not fetch system fallback fonts", () => {
    expect(proposalPrintFontUrl({ ...BRAND_DEFAULTS, headingFont: "Georgia, serif", bodyFont: "Arial, sans-serif" })).toBeNull();
  });
});
