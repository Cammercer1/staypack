import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";

type Props = {
  document: SalesBrochureDocumentJson;
};

export function ClassicSalesBrochurePageTwo({ document }: Props) {
  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);
  const images = document.property.page_two_image_urls.filter(Boolean);
  const gridClass =
    images.length <= 2
      ? "grid-cols-2"
      : images.length === 3
        ? "grid-cols-3"
        : "grid-cols-2";

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        width: "var(--report-page-width, 210mm)",
        minHeight: "var(--report-page-height, 297mm)",
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col px-10 py-8">
        {images.length > 0 ? (
          <div className={`grid min-h-0 flex-1 gap-2 ${gridClass}`}>
            {images.slice(0, 6).map((url) => (
              <div key={url} className="min-h-0 overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-8 shrink-0 space-y-5">
          {document.copy.feature_highlights.length ? (
            <div>
              <h3
                className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-600"
                style={{
                  fontFamily:
                    "var(--report-heading-font, var(--collateral-heading-font, inherit))",
                }}
              >
                Property highlights
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {document.copy.feature_highlights.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2.5 text-[0.9rem] leading-relaxed text-neutral-800"
                  >
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400"
                      aria-hidden
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {document.copy.inspection_cta ? (
            <p
              className="text-lg font-semibold text-neutral-900"
              style={{
                fontFamily:
                  "var(--report-heading-font, var(--collateral-heading-font, inherit))",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {document.copy.inspection_cta}
            </p>
          ) : null}

          {document.copy.disclaimer ? (
            <p className="text-[0.65rem] leading-relaxed text-neutral-500">
              {document.copy.disclaimer}
            </p>
          ) : null}
        </div>
      </div>

      <ClassicAgentFooter report={report} />
    </section>
  );
}
