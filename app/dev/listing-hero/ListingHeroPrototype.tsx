"use client";

import { useState } from "react";
import { BedDouble, Bath, Car } from "lucide-react";

type Props = {
  // Property
  address: string;
  suburb: string;
  price: string | null;
  beds: number | null;
  baths: number | null;
  cars: number | null;
  heroImage: string | null;
  // Agency
  agencyName: string;
  logoOnDark: string;
  primaryColour: string;
  // Fonts
  googleFontsUrl: string | null;
  headingFontFamily: string;
  bodyFontFamily: string;
  headingFontFaceCSS: string | null;
  bodyFontFaceCSS: string | null;
  // Card
  cardBackgroundColour: string;
  cardBorderColour: string;
  cardBorderRadiusPx: number;
  cardBorderWidthPx: number;
  cardShadow: string;
  // Button
  buttonBackground: string;
  buttonText: string;
  buttonBorderRadiusPx: number;
  buttonBorderWidthPx: number;
  buttonBorderColour: string;
  // Inputs + links
  inputBorderRadiusPx: number;
  linkColour: string;
};

const FADE_UP = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

function LeadForm({
  linkColour,
  cardBackgroundColour,
  cardBorderColour,
  cardBorderRadiusPx,
  cardBorderWidthPx,
  cardShadow,
  buttonBackground,
  buttonText,
  buttonBorderRadiusPx,
  buttonBorderWidthPx,
  buttonBorderColour,
  inputBorderRadiusPx,
}: Pick<
  Props,
  | "linkColour"
  | "cardBackgroundColour"
  | "cardBorderColour"
  | "cardBorderRadiusPx"
  | "cardBorderWidthPx"
  | "cardShadow"
  | "buttonBackground"
  | "buttonText"
  | "buttonBorderRadiusPx"
  | "buttonBorderWidthPx"
  | "buttonBorderColour"
  | "inputBorderRadiusPx"
>) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const cardStyle = {
    backgroundColor: cardBackgroundColour,
    borderColor: cardBorderColour,
    borderWidth: cardBorderWidthPx,
    borderStyle: "solid" as const,
    boxShadow: cardShadow,
    // Round top corners on mobile so it appears as a sheet; all corners on desktop
    borderRadius: `${cardBorderRadiusPx}px ${cardBorderRadiusPx}px 0 0`,
  };

  const inputStyle = {
    borderRadius: inputBorderRadiusPx,
    borderColor: cardBorderColour,
  };

  const inputClass =
    "w-full border px-3 py-2 text-sm outline-none focus:border-black/30 bg-white/80";

  const buttonStyle = {
    background: buttonBackground,
    color: buttonText,
    borderRadius: buttonBorderRadiusPx,
    borderWidth: buttonBorderWidthPx,
    borderStyle: buttonBorderWidthPx > 0 ? ("solid" as const) : undefined,
    borderColor: buttonBorderColour,
  };

  if (submitted) {
    return (
      <div
        className="flex shrink-0 flex-col items-center justify-center gap-2 p-6 text-center md:w-72"
        style={cardStyle}
      >
        <p className="font-semibold" style={{ color: linkColour }}>
          Thanks! Enquiry received.
        </p>
        <p className="text-sm opacity-60">The agent will be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
      className="flex shrink-0 flex-col gap-3 p-5 md:w-72"
      style={cardStyle}
    >
      <div>
        <p className="font-semibold leading-tight" style={{ color: linkColour }}>
          Register your interest
        </p>
        <p className="mt-0.5 text-xs opacity-50">Leave your details below.</p>
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider opacity-50">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            required
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider opacity-50">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider opacity-50">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0400 000 000"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={!name.trim()}
        className="mt-1 w-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 hover:opacity-90"
        style={buttonStyle}
      >
        Submit enquiry
      </button>
    </form>
  );
}

export function ListingHeroPrototype({
  address,
  suburb,
  price,
  beds,
  baths,
  cars,
  heroImage,
  agencyName,
  logoOnDark,
  primaryColour,
  googleFontsUrl,
  headingFontFamily,
  bodyFontFamily,
  headingFontFaceCSS,
  bodyFontFaceCSS,
  ...brand
}: Props) {
  const hasConfig = beds != null || baths != null || cars != null;

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{ fontFamily: bodyFontFamily, color: primaryColour }}
    >
      {/* ── Font loading ───────────────────────────────────── */}
      <style>{FADE_UP}</style>
      {headingFontFaceCSS && <style>{headingFontFaceCSS}</style>}
      {bodyFontFaceCSS && <style>{bodyFontFaceCSS}</style>}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl} />}
      <style>{`h1, h2, h3 { font-family: ${headingFontFamily}; }`}</style>

      {/* Hero image */}
      {heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImage}
          alt={address}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />

      {/* Agency logo — top left, light version for dark bg */}
      <div className="absolute left-6 top-6 z-10">
        {logoOnDark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoOnDark} alt={agencyName} className="h-8 w-auto object-contain" />
        ) : (
          <span
            className="text-sm font-bold uppercase tracking-widest text-white/90"
            style={{ fontFamily: headingFontFamily }}
          >
            {agencyName}
          </span>
        )}
      </div>

      {/* Property text — top of viewport (mobile only) */}
      <div className="absolute left-6 right-6 top-20 z-10 md:hidden">
        <p
          className="text-xl font-bold leading-snug text-white"
          style={{
            fontFamily: headingFontFamily,
            animation: "fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both",
            animationDelay: "0.05s",
          }}
        >
          {address}
        </p>
        {(suburb || hasConfig) && (
          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60"
            style={{
              animation: "fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both",
              animationDelay: "0.15s",
            }}
          >
            {suburb && <span>{suburb}</span>}
            {beds != null && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" />{beds} bed
              </span>
            )}
            {baths != null && (
              <span className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />{baths} bath
              </span>
            )}
            {cars != null && (
              <span className="flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />{cars} car
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom content */}
      <div
        id="form"
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
              {address}
            </h1>
            {suburb && (
              <p
                className="mt-1.5 text-sm text-white/60"
                style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.15s" }}
              >
                {suburb}
              </p>
            )}
            {price && (
              <p
                className="mt-2 text-lg font-semibold text-white/90"
                style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.2s" }}
              >
                {price}
              </p>
            )}
            {hasConfig && (
              <div
                className="mt-3 flex items-center gap-5 text-sm text-white/75"
                style={{ animation: "fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.25s" }}
              >
                {beds != null && (
                  <span className="flex items-center gap-1.5">
                    <BedDouble className="h-4 w-4" /><strong>{beds}</strong> bed
                  </span>
                )}
                {baths != null && (
                  <span className="flex items-center gap-1.5">
                    <Bath className="h-4 w-4" /><strong>{baths}</strong> bath
                  </span>
                )}
                {cars != null && (
                  <span className="flex items-center gap-1.5">
                    <Car className="h-4 w-4" /><strong>{cars}</strong> car
                  </span>
                )}
              </div>
            )}
          </div>

          <LeadForm {...brand} />
        </div>
      </div>
    </div>
  );
}
