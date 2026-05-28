import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  document: CollateralDocumentJson;
};

export function ClassicBusinessCard({ document }: Props) {
  if (document.type !== "agent_business_card") return null;

  const { agency, agent, listing, assets } = document;
  const primary = agency.primary_colour;
  const text = agency.text_colour || "#1a1a1a";

  return (
    <div
      className="collateral-page business-card-page relative overflow-hidden"
      style={{
        width: "var(--collateral-page-width)",
        height: "var(--collateral-page-height)",
        backgroundColor: agency.background_colour || "#ffffff",
        color: text,
        fontFamily: "var(--collateral-body-font)",
      }}
    >
      {/* Accent strip */}
      <div
        className="absolute left-0 right-0 top-0 h-[3mm]"
        style={{ backgroundColor: primary }}
      />

      <div className="flex h-full flex-col px-[5mm] pb-[4mm] pt-[5mm]">
        {/* Top row: logo + QR */}
        <div className="flex items-start justify-between gap-[3mm]">
          {agency.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agency.logo_url}
              alt={agency.name}
              className="h-[8mm] w-auto max-w-[35mm] object-contain object-left"
            />
          ) : (
            <p
              className="text-[9pt] font-bold leading-none"
              style={{ color: primary, fontFamily: "var(--collateral-heading-font)" }}
            >
              {agency.name}
            </p>
          )}

          {assets.qr_code_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assets.qr_code_url}
              alt="Property QR code"
              className="h-[14mm] w-[14mm] shrink-0 object-contain"
            />
          ) : null}
        </div>

        {/* Agent + property */}
        <div className="mt-[3mm] flex min-h-0 flex-1 items-center gap-[4mm]">
          {agent.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.photo_url}
              alt={agent.name}
              className="h-[18mm] w-[18mm] shrink-0 object-cover object-top"
            />
          ) : agent.name ? (
            <div
              className="flex h-[18mm] w-[18mm] shrink-0 items-center justify-center text-[14pt] font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {agent.name.charAt(0)}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            {agent.name ? (
              <p
                className="truncate text-[11pt] font-bold leading-tight"
                style={{ fontFamily: "var(--collateral-heading-font)" }}
              >
                {agent.name}
              </p>
            ) : null}
            {agent.role_title ? (
              <p className="truncate text-[7.5pt] leading-snug opacity-70">
                {agent.role_title}
              </p>
            ) : null}
            {agent.phone ? (
              <p className="mt-[1mm] truncate text-[7.5pt] font-medium leading-snug">
                {agent.phone}
              </p>
            ) : null}
            {agent.email ? (
              <p className="truncate text-[7pt] leading-snug opacity-70">
                {agent.email}
              </p>
            ) : null}
          </div>
        </div>

        {/* Property line */}
        <div
          className="mt-auto border-t pt-[2mm]"
          style={{ borderColor: `${primary}22` }}
        >
          <p
            className="truncate text-[7pt] font-semibold leading-snug"
            style={{ color: primary }}
          >
            {listing.address}
          </p>
          {listing.display_price ? (
            <p className="truncate text-[7pt] leading-snug opacity-70">
              {listing.display_price}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
