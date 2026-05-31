import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { resolveBrochureAgents } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureAgents";
import type { FinalReportJson } from "@/lib/types";
import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

/**
 * Closing band for the visual page-two of brochures — agent contact on the
 * left, agency logo + scan-to-view QR on the right, optional fine-print line.
 */
export function BrochureClosingBand({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const agents = resolveBrochureAgents(report);
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const qr = document.assets.qr_code_url;
  const disclaimer = document.copy.disclaimer?.trim();
  const multiAgent = agents.length > 1;

  return (
    <footer className="shrink-0 border-t border-neutral-200">
      <div className="flex items-center justify-between gap-8 px-10 py-6">
        {/* Agents */}
        {agents.length > 0 ? (
          <div
            className={
              multiAgent
                ? "grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-4"
                : "flex min-w-0 flex-1 items-center gap-4"
            }
          >
            {agents.map((agent, index) => (
              <div
                key={`${agent.name}-${agent.email}-${agent.phone}-${index}`}
                className="flex items-center gap-4"
              >
                {agent.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.photo_url}
                    alt={agent.name || "Agent"}
                    className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
                  />
                ) : null}
                <div className="min-w-0">
                  {agent.name ? (
                    <p
                      className="text-[0.95rem] font-semibold leading-tight text-neutral-900"
                      style={{ fontFamily: headingFont }}
                    >
                      {agent.name}
                    </p>
                  ) : null}
                  {agent.role_title ? (
                    <p
                      className="text-[0.72rem] text-neutral-600"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.role_title}
                    </p>
                  ) : null}
                  {agent.phone ? (
                    <p
                      className="mt-1 text-[0.72rem] text-neutral-700"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.phone}
                    </p>
                  ) : null}
                  {agent.email ? (
                    <p
                      className="truncate text-[0.7rem] text-neutral-600"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.email}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Logo + scan-to-view QR */}
        <div className="flex items-center gap-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={document.agency.name}
              className="h-8 max-w-[150px] object-contain"
            />
          ) : null}
          {qr ? (
            <div className="flex items-center gap-3">
              <p
                className="max-w-[7rem] text-right text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-neutral-500"
                style={{ fontFamily: headingFont }}
              >
                Scan to view the listing
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code" className="h-16 w-16 shrink-0" />
            </div>
          ) : null}
        </div>
      </div>

      {disclaimer ? (
        <Editable
          as="p"
          path="copy.disclaimer"
          className="px-10 pb-4 text-[0.54rem] leading-relaxed text-neutral-400"
          style={{ fontFamily: bodyFont }}
        >
          {disclaimer}
        </Editable>
      ) : null}
    </footer>
  );
}
