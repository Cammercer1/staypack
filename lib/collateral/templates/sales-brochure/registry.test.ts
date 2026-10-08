import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { SALES_BROCHURE_TEMPLATES } from "./registry";

describe("sales brochure templates", () => {
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
