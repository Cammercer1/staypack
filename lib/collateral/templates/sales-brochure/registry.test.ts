import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { SALES_BROCHURE_TEMPLATES } from "./registry";
import { RENTAL_BROCHURE_TEMPLATES } from "../rental-brochure/registry";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";

describe("sales brochure templates", () => {
  it.each([...SALES_BROCHURE_TEMPLATES, ...RENTAL_BROCHURE_TEMPLATES])(
    "$id shows the advertised price for its document purpose",
    (template) => {
      const rental = template.collateralType === "rental_brochure";
      const base = createPlaygroundSalesBrochureDocument(template.id);
      const copy = { ...base.copy, price_value: rental ? "$920 per week" : "$1,650,000", price_label: "" };
      const document: BrochureDocumentJson = rental
        ? { ...base, type: "rental_brochure", version: "rental_brochure_v1", copy }
        : { ...base, copy };
      const original = structuredClone(document);
      const $ = load(renderToStaticMarkup(createElement(template.Component, { document })));
      const text = $("body").text();
      expect(text).toContain(document.copy.price_value);
      expect(text).not.toMatch(/Indicative rent|Estimated sale price|Annual revenue estimate/i);
      if (rental) expect(text).not.toMatch(/for sale/i);
      if (template.id.includes("landmark")) expect(text).toMatch(rental ? /for lease/i : /for sale/i);
      expect(document).toEqual(original);
    },
  );
  for (const type of ["sales_brochure", "rental_brochure"] as const) {
    it.each(SALES_BROCHURE_TEMPLATES.filter((template) => template.id.includes("gallery")))(
      `${type} Gallery $id includes the saved disclaimer`,
      (template) => {
        const base = createPlaygroundSalesBrochureDocument(template.id);
        const document: BrochureDocumentJson = type === "rental_brochure"
          ? { ...base, type, version: "rental_brochure_v1" }
          : base;
        const html = renderToStaticMarkup(createElement(template.Component, { document }));
        expect(load(html)("body").text()).toContain(document.copy.disclaimer);
      },
    );
  }
  it.each(SALES_BROCHURE_TEMPLATES)("renders $id without changing the saved document", (template) => {
    const document = createPlaygroundSalesBrochureDocument(template.id);
    const original = structuredClone(document);
    const html = renderToStaticMarkup(createElement(template.Component, { document }));
    const $ = load(html);
    expect($("body").text().replace(/\s+/g, " ").toLowerCase()).toContain("42 oceanview parade");
    expect($(".report-page")).toHaveLength(template.pages);
    expect($("img").length).toBeGreaterThan(0);
    expect(document).toEqual(original);
  });
});
