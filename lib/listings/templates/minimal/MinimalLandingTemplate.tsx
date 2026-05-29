"use client";

import { useState } from "react";
import { BedDouble, Bath, Car, Mail, Phone } from "lucide-react";
import { getBrandButtonInlineStyle, getBrandCardInlineStyle } from "@/lib/branding/advanced";
import type { LandingTemplateProps } from "@/lib/listings/templates/types";
import type { ParsedListing } from "@/lib/types";

type Agent = ParsedListing["agents"][number];

const FADE_UP = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// Compact agent identity row — small avatar, name, and contact links.
function AgentRow({
  agent,
  brandAdvanced,
  primaryColour,
}: {
  agent: Agent;
  brandAdvanced: LandingTemplateProps["brandAdvanced"];
  primaryColour: string;
}) {
  return (
    <div
      className="mt-1 flex items-center gap-2.5 border-t pt-3"
      style={{ borderColor: brandAdvanced.cardBorderColour }}
    >
      {agent.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.photo_url}
          alt={agent.name ?? "Agent"}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: primaryColour }}
        >
          {agent.name?.charAt(0) ?? "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight">{agent.name}</p>
        <div className="mt-0.5 flex items-center gap-3 text-[11px]">
          {agent.phone ? (
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center gap-1 hover:underline"
              style={{ color: brandAdvanced.linkColour }}
            >
              <Phone className="h-3 w-3" />
              {agent.phone}
            </a>
          ) : null}
          {agent.email ? (
            <a
              href={`mailto:${agent.email}`}
              className="flex items-center gap-1 hover:underline"
              style={{ color: brandAdvanced.linkColour }}
              aria-label={`Email ${agent.name ?? "agent"}`}
            >
              <Mail className="h-3 w-3" />
              Email
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Thin wrapper so the form inherits lead-form behaviour but matches the minimal card styles.
function MinimalLeadForm({ agencySlug, listingSlug, brandAdvanced, cardBorderRadiusPx, agent, primaryColour }: {
  agencySlug: string;
  listingSlug: string;
  brandAdvanced: LandingTemplateProps["brandAdvanced"];
  cardBorderRadiusPx: number;
  agent: Agent | null;
  primaryColour: string;
}) {
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const cardStyle = {
    ...getBrandCardInlineStyle(brandAdvanced),
    // Round top corners only on mobile; on desktop all four corners round.
    borderRadius: `${cardBorderRadiusPx}px ${cardBorderRadiusPx}px 0 0`,
  };

  const inputStyle = {
    borderRadius: brandAdvanced.inputBorderRadiusPx,
    borderColor: brandAdvanced.cardBorderColour,
  };

  const inputClass =
    "w-full border px-3 py-2 text-sm outline-none focus:border-black/30 bg-white/80";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency_slug: agencySlug, listing_slug: listingSlug, name, email: email || null, phone: phone || null }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  const agentFirstName = agent?.name?.trim().split(/\s+/)[0];

  if (done) {
    return (
      <div className="flex shrink-0 flex-col items-center justify-center gap-2 p-6 text-center md:w-72" style={cardStyle}>
        <p className="font-semibold" style={{ color: brandAdvanced.linkColour }}>
          Thanks! Enquiry received.
        </p>
        <p className="text-sm opacity-60">
          {agentFirstName
            ? `${agentFirstName} will be in touch shortly.`
            : "The agent will be in touch shortly."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex shrink-0 flex-col gap-3 p-5 md:w-72" style={cardStyle}>
      <div>
        <p className="font-semibold leading-tight" style={{ color: brandAdvanced.linkColour }}>
          Register your interest
        </p>
        <p className="mt-0.5 text-xs opacity-50">Leave your details below.</p>
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider opacity-50">
            Name <span className="text-red-500">*</span>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider opacity-50">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider opacity-50">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" className={inputClass} style={inputStyle} />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="mt-1 w-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 hover:opacity-90"
        style={getBrandButtonInlineStyle(brandAdvanced)}
      >
        {loading ? "Submitting…" : "Submit enquiry"}
      </button>
      {agent ? (
        <AgentRow agent={agent} brandAdvanced={brandAdvanced} primaryColour={primaryColour} />
      ) : null}
    </form>
  );
}

export function MinimalLandingTemplate({
  listing: l,
  agency: a,
  agencySlug,
  listingSlug,
  brandAdvanced,
  logos,
  allImages,
  suburb,
  headingFontFamily,
  bodyFontFamily,
  googleFontsUrl,
  headingFontFaceCSS,
  bodyFontFaceCSS,
  primaryColour,
}: LandingTemplateProps) {
  const hasConfig = l.bedrooms != null || l.bathrooms != null || l.car_spaces != null;
  const heroImage = allImages[0] ?? null;
  const agent = (l.scraped_listing_json?.agents ?? []).find((ag) => ag.name) ?? null;

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ fontFamily: bodyFontFamily }}>
      {/* ── Fonts ───────────────────────────────────────────────── */}
      <style>{FADE_UP}</style>
      {headingFontFaceCSS ? <style>{headingFontFaceCSS}</style> : null}
      {bodyFontFaceCSS ? <style>{bodyFontFaceCSS}</style> : null}
      {googleFontsUrl ? <link rel="stylesheet" href={googleFontsUrl} /> : null}
      <style>{`h1, h2, h3 { font-family: ${headingFontFamily}; }`}</style>

      {/* Hero image */}
      {heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={heroImage} alt={l.property_address ?? "Property"} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />

      {/* Agency logo — top left, light version for dark bg */}
      <div className="absolute left-6 top-6 z-10">
        {logos.onDark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logos.onDark} alt={a.name} className="h-8 w-auto object-contain" />
        ) : logos.onLight ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logos.onLight} alt={a.name} className="h-8 w-auto object-contain" />
        ) : (
          <span className="text-sm font-bold uppercase tracking-widest text-white/90" style={{ fontFamily: headingFontFamily }}>
            {a.name}
          </span>
        )}
      </div>

      {/* Property text — top of viewport (mobile only) */}
      <div className="absolute left-6 right-6 top-20 z-10 md:hidden">
        <p
          className="text-xl font-bold leading-snug text-white"
          style={{ fontFamily: headingFontFamily, animation: "fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.05s" }}
        >
          {l.listing_title ?? l.property_address ?? "Property"}
        </p>
        {(suburb || hasConfig) && (
          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60"
            style={{ animation: "fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.15s" }}
          >
            {suburb && <span>{suburb}</span>}
            {l.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{l.bedrooms} bed</span>}
            {l.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{l.bathrooms} bath</span>}
            {l.car_spaces != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{l.car_spaces} car</span>}
          </div>
        )}
      </div>

      {/* Bottom content */}
      <div
        id="lead-form"
        className="absolute bottom-0 left-0 right-0 z-10"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
      >
        <div className="flex flex-col items-stretch md:flex-row md:items-end md:gap-8 md:px-8 md:pb-8 md:pt-32">

          {/* Desktop property info */}
          <div className="hidden min-w-0 flex-1 md:block">
            <h1
              className="text-3xl font-bold leading-tight tracking-tight text-white"
              style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.05s" }}
            >
              {l.listing_title ?? l.property_address ?? "Property"}
            </h1>
            {suburb && (
              <p className="mt-1.5 text-sm text-white/60" style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.15s" }}>
                {suburb}
              </p>
            )}
            {l.display_price && (
              <p className="mt-2 text-lg font-semibold text-white/90" style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.2s" }}>
                {l.display_price}
              </p>
            )}
            {hasConfig && (
              <div className="mt-3 flex items-center gap-5 text-sm text-white/75" style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.25s" }}>
                {l.bedrooms != null && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4" /><strong>{l.bedrooms}</strong> bed</span>}
                {l.bathrooms != null && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4" /><strong>{l.bathrooms}</strong> bath</span>}
                {l.car_spaces != null && <span className="flex items-center gap-1.5"><Car className="h-4 w-4" /><strong>{l.car_spaces}</strong> car</span>}
              </div>
            )}
          </div>

          <MinimalLeadForm
            agencySlug={agencySlug}
            listingSlug={listingSlug}
            brandAdvanced={brandAdvanced}
            cardBorderRadiusPx={brandAdvanced.cardBorderRadiusPx}
            agent={agent}
            primaryColour={primaryColour}
          />
        </div>
      </div>
    </div>
  );
}
