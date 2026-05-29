import { getAgencyLogoUrl } from "@/lib/branding/logos";
import {
  BUSINESS_CARD_VARIANT_IDS,
  normalizeBusinessCardVariantId,
  type BusinessCardVariantId,
} from "@/lib/collateral/business-card/formats";
import { ensureBusinessCardDocument } from "@/lib/collateral/business-card/normalizeBusinessCardDocument";
import type {
  BusinessCardDocumentJson,
  BusinessCardLayerState,
  CollateralTemplateProps,
} from "@/lib/collateral/templates/types";

export function ClassicBusinessCard({ document, variantId }: CollateralTemplateProps) {
  if (document.type !== "agent_business_card") return null;

  const normalized = ensureBusinessCardDocument(
    document as BusinessCardDocumentJson,
  );
  const selectedVariant =
    variantId === "front" || variantId === "back"
      ? normalizeBusinessCardVariantId(variantId)
      : null;
  const variants = selectedVariant ? [selectedVariant] : BUSINESS_CARD_VARIANT_IDS;

  return (
    <>
      {variants.map((side) =>
        side === "back" ? (
          <BusinessCardBack key="back" document={normalized} />
        ) : (
          <BusinessCardFront key="front" document={normalized} />
        ),
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FRONT SIDE
// ─────────────────────────────────────────────────────────────────────────────

function BusinessCardFront({ document }: { document: BusinessCardDocumentJson }) {
  const { agency, agent, assets } = document;
  const variant = document.variants.front;
  const primary = agency.primary_colour || "#111827";
  const isBrand = variant.background_style === "brand";
  const bg = isBrand ? primary : agency.background_colour || "#ffffff";
  const fg = isBrand ? "#ffffff" : agency.text_colour || "#111827";
  const fgMuted = isBrand ? "rgba(255,255,255,0.70)" : "rgba(15,23,42,0.55)";
  const fgSubtle = isBrand ? "rgba(255,255,255,0.36)" : "rgba(15,23,42,0.20)";

  const logoUrl = variant.show_logo
    ? getAgencyLogoUrl(agency, isBrand ? "dark" : "light")
    : "";
  const qrCodeUrl = variant.show_qr ? (assets.qr_code_url ?? "") : "";
  const layers = variant.layers;

  const initials = agent.name
    ? agent.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <div
      className="collateral-page business-card-page relative overflow-hidden"
      style={{
        width: "var(--collateral-page-width)",
        height: "var(--collateral-page-height)",
        backgroundColor: bg,
        color: fg,
        fontFamily: "var(--collateral-body-font)",
      }}
    >
      {/* Left accent strip */}
      {!isBrand ? (
        <div
          className="absolute bottom-0 left-0 top-0 w-[3.5mm]"
          style={{ backgroundColor: primary }}
        />
      ) : (
        <>
          <div
            className="absolute rounded-full"
            style={{
              width: "46mm",
              height: "46mm",
              top: "-18mm",
              right: "-14mm",
              background: "rgba(255,255,255,0.07)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: "22mm",
              height: "22mm",
              bottom: "-9mm",
              left: "-6mm",
              background: "rgba(255,255,255,0.05)",
            }}
          />
        </>
      )}

      {/* Logo */}
      {variant.show_logo && layers.logo.enabled ? (
        logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={agency.name}
            className="absolute object-contain object-left-top"
            style={layerStyle(layers.logo, { heightMm: 8, maxWidthMm: 36 })}
          />
        ) : (
          <p
            className="absolute truncate font-bold leading-none"
            style={{
              ...layerStyle(layers.logo),
              color: isBrand ? "#ffffff" : primary,
              fontFamily: "var(--collateral-heading-font)",
              fontSize: `${9 * layers.logo.scale}pt`,
            }}
          >
            {agency.name}
          </p>
        )
      ) : null}

      {/* Agent photo */}
      {variant.show_agent_photo && layers.agent_photo.enabled ? (
        agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photo_url}
            alt={agent.name}
            className="absolute object-cover object-top"
            style={{
              ...layerStyle(layers.agent_photo, { widthMm: 20, heightMm: 20 }),
              borderRadius: "50%",
            }}
          />
        ) : initials ? (
          <div
            className="absolute flex items-center justify-center font-bold"
            style={{
              ...layerStyle(layers.agent_photo, { widthMm: 20, heightMm: 20 }),
              borderRadius: "50%",
              backgroundColor: isBrand ? "rgba(255,255,255,0.2)" : primary,
              color: isBrand ? primary : "#ffffff",
              fontSize: `${11 * layers.agent_photo.scale}pt`,
              fontFamily: "var(--collateral-heading-font)",
            }}
          >
            {initials}
          </div>
        ) : null
      ) : null}

      {/* Headline */}
      {variant.headline && layers.headline.enabled ? (
        <p
          className="absolute leading-tight"
          style={{
            ...layerStyle(layers.headline),
            fontFamily: "var(--collateral-heading-font)",
            fontSize: `${10 * layers.headline.scale}pt`,
            fontWeight: 700,
          }}
        >
          {variant.headline}
        </p>
      ) : null}

      {/* Subcopy */}
      {variant.subcopy && layers.subcopy.enabled ? (
        <p
          className="absolute leading-snug"
          style={{
            ...layerStyle(layers.subcopy),
            fontSize: `${7 * layers.subcopy.scale}pt`,
            color: fgMuted,
          }}
        >
          {variant.subcopy}
        </p>
      ) : null}

      {/* Agent contact block */}
      {layers.agent_contact.enabled ? (
        <div className="absolute min-w-0" style={layerStyle(layers.agent_contact)}>
          {agent.name ? (
            <p
              className="truncate leading-tight"
              style={{
                fontFamily: "var(--collateral-heading-font)",
                fontSize: `${10.5 * layers.agent_contact.scale}pt`,
                fontWeight: 700,
              }}
            >
              {agent.name}
            </p>
          ) : null}
          {agent.role_title ? (
            <p
              className="truncate leading-snug"
              style={{
                fontSize: `${7 * layers.agent_contact.scale}pt`,
                color: fgMuted,
                marginTop: `${0.8 * layers.agent_contact.scale}mm`,
              }}
            >
              {agent.role_title}
            </p>
          ) : null}
          {(agent.name || agent.role_title) &&
          variant.show_contact &&
          (agent.phone || agent.email) ? (
            <div
              style={{
                marginTop: `${1.5 * layers.agent_contact.scale}mm`,
                borderTop: `0.4pt solid ${fgSubtle}`,
                paddingTop: `${1.2 * layers.agent_contact.scale}mm`,
              }}
            />
          ) : null}
          {variant.show_contact && agent.phone ? (
            <p
              className="truncate leading-snug"
              style={{
                fontSize: `${7.5 * layers.agent_contact.scale}pt`,
                fontWeight: 500,
              }}
            >
              {agent.phone}
            </p>
          ) : null}
          {variant.show_contact && agent.email ? (
            <p
              className="truncate leading-snug"
              style={{
                fontSize: `${7 * layers.agent_contact.scale}pt`,
                color: fgMuted,
              }}
            >
              {agent.email}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* QR */}
      {qrCodeUrl && layers.qr.enabled ? (
        <div
          className="absolute"
          style={layerStyle(layers.qr, { widthMm: 16, heightMm: 16 })}
        >
          <div
            className="absolute inset-0 rounded-[1.5mm]"
            style={{ backgroundColor: isBrand ? "rgba(255,255,255,0.12)" : "transparent" }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt="QR"
            className="relative h-full w-full object-contain"
            style={{ padding: isBrand ? "1.5mm" : 0 }}
          />
        </div>
      ) : null}

      {/* Agency line */}
      {layers.agency_details.enabled ? (
        <div
          className="absolute min-w-0"
          style={{
            ...layerStyle(layers.agency_details),
            borderTop: `0.4pt solid ${fgSubtle}`,
            paddingTop: `${1 * layers.agency_details.scale}mm`,
          }}
        >
          {variant.show_agency_details ? (
            <p
              className="truncate leading-snug"
              style={{ fontSize: `${6.5 * layers.agency_details.scale}pt`, color: fgMuted }}
            >
              {[agency.website_url, agency.phone, agency.email]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BACK SIDE — colour or photo, with free-placed logo and QR
// ─────────────────────────────────────────────────────────────────────────────

function resolveBackLogoUrl(
  agency: BusinessCardDocumentJson["agency"],
  variant: BusinessCardDocumentJson["variants"]["back"],
): string {
  const logoVariant = variant.back_logo_variant ?? "light";
  if (logoVariant === "custom") return variant.back_logo_custom_url ?? "";
  // "light" → white logo for dark backgrounds; "dark" → dark logo for light backgrounds
  return getAgencyLogoUrl(agency, logoVariant === "light" ? "dark" : "light");
}

function BusinessCardBack({ document }: { document: BusinessCardDocumentJson }) {
  const { agency, listing, assets } = document;
  const variant = document.variants.back;
  const layers = variant.layers;
  const backStyle = variant.back_style ?? "colour";

  const logoUrl = variant.show_logo ? resolveBackLogoUrl(agency, variant) : "";
  const qrCodeUrl = variant.show_qr ? (assets.qr_code_url ?? "") : "";

  const bgColour = variant.back_colour || agency.primary_colour || "#111827";
  const heroImageUrl = listing?.hero_image_url ?? "";

  // Shared element renderers
  const logoEl = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={agency.name}
      className="absolute z-10 object-contain object-left-top"
      style={{
        left: `${layers.logo.x}%`,
        top: `${layers.logo.y}%`,
        maxHeight: `${8 * layers.logo.scale}mm`,
        maxWidth: `${layers.logo.width}%`,
        width: "auto",
        height: "auto",
      }}
    />
  ) : variant.show_logo && agency.name ? (
    <p
      className="absolute z-10 font-bold leading-none"
      style={{
        left: `${layers.logo.x}%`,
        top: `${layers.logo.y}%`,
        color: "#ffffff",
        fontFamily: "var(--collateral-heading-font)",
        fontSize: `${9 * layers.logo.scale}pt`,
      }}
    >
      {agency.name}
    </p>
  ) : null;

  const qrEl =
    qrCodeUrl && layers.qr.enabled ? (
      <div
        className="absolute z-10"
        style={{
          left: `${layers.qr.x}%`,
          top: `${layers.qr.y}%`,
          width: `${14 * layers.qr.scale}mm`,
          height: `${14 * layers.qr.scale}mm`,
          padding: "1.2mm",
          borderRadius: "1.5mm",
          backgroundColor: "rgba(255,255,255,0.16)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCodeUrl} alt="QR" className="h-full w-full object-contain" />
      </div>
    ) : null;

  if (backStyle === "photo") {
    return (
      <div
        className="collateral-page business-card-page relative overflow-hidden"
        style={{
          width: "var(--collateral-page-width)",
          height: "var(--collateral-page-height)",
          backgroundColor: "#111111",
          fontFamily: "var(--collateral-body-font)",
        }}
      >
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${agency.primary_colour || "#111827"} 0%, rgba(15,23,42,0.9) 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.50)" }} />
        {logoEl}
        {qrEl}
      </div>
    );
  }

  // "colour" — solid background with decorative circles
  return (
    <div
      className="collateral-page business-card-page relative overflow-hidden"
      style={{
        width: "var(--collateral-page-width)",
        height: "var(--collateral-page-height)",
        backgroundColor: bgColour,
        fontFamily: "var(--collateral-body-font)",
      }}
    >
      <div
        className="absolute rounded-full"
        style={{ width: "50mm", height: "50mm", top: "-20mm", right: "-16mm", background: "rgba(255,255,255,0.06)" }}
      />
      <div
        className="absolute rounded-full"
        style={{ width: "24mm", height: "24mm", bottom: "-10mm", left: "-8mm", background: "rgba(255,255,255,0.05)" }}
      />
      {logoEl}
      {qrEl}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function layerStyle(
  layer: BusinessCardLayerState,
  size?: { widthMm?: number; heightMm?: number; maxWidthMm?: number },
): React.CSSProperties {
  return {
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: size?.widthMm ? `${size.widthMm * layer.scale}mm` : `${layer.width}%`,
    height: size?.heightMm ? `${size.heightMm * layer.scale}mm` : undefined,
    maxWidth: size?.maxWidthMm ? `${size.maxWidthMm * layer.scale}mm` : undefined,
  };
}
