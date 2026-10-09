import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { REPORT_TEMPLATES } from "@/lib/reports/templates/registry";
import { SALES_BROCHURE_TEMPLATES } from "@/lib/collateral/templates/sales-brochure/registry";
import { RENTAL_BROCHURE_TEMPLATES } from "@/lib/collateral/templates/rental-brochure/registry";

const qr = "https://example.test/document-qr.png";
describe("all report template families with optional QR", () => {
  it.each(REPORT_TEMPLATES)("renders $id with and without QR without altering the source", (template) => {
    const source = getStrPlaygroundReport();
    source.template_id = template.id;
    source.document_link = { mode: "report" };
    source.assets.qr_code_url = qr;
    const before = structuredClone(source);
    const enabled = renderToStaticMarkup(createElement(template.Component, { report: source }));
    const disabled = renderToStaticMarkup(createElement(template.Component, { report: { ...source, document_link: { mode: "none" }, assets: { ...source.assets, qr_code_url: "" } } }));
    const $ = load(disabled);
    expect($(".report-page").filter((_, el) => $(el).parents(".report-page").length === 0)).toHaveLength(template.pages);
    expect(disabled).not.toContain(qr);
    expect(disabled).not.toContain("Scan to view");
    expect(enabled).not.toContain('src=""');
    expect(enabled).toContain(qr);
    expect(source).toEqual(before);
  });
});
describe("all brochure template families with optional QR", () => {
  it.each([...SALES_BROCHURE_TEMPLATES, ...RENTAL_BROCHURE_TEMPLATES])("renders $id with and without QR", (template) => {
    const source = createPlaygroundSalesBrochureDocument(template.id);
    if (template.collateralType === "rental_brochure") {
      Object.assign(source, { type: "rental_brochure", version: "rental_brochure_v1" });
    }
    source.document_link = { mode: "custom", url: "https://example.test/property" };
    source.assets.qr_code_url = qr;
    const enabled = renderToStaticMarkup(createElement(template.Component, { document: source }));
    const disabled = renderToStaticMarkup(createElement(template.Component, { document: { ...source, document_link: { mode: "none" }, assets: { qr_code_url: "" } } }));
    expect(enabled).toContain(qr);
    expect(disabled).not.toContain(qr);
    expect(disabled).not.toContain("Scan to view");
    expect(disabled).not.toContain("Scan for more information");
    expect(load(disabled)(".report-page")).toHaveLength(template.pages);
  });
});
