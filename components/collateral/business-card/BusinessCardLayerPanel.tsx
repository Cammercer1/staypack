"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Image, Palette, Sparkles } from "lucide-react";
import { LayerSection } from "@/components/collateral/social/LayerSection";
import { LayerScaleControl } from "@/components/collateral/social/LayerScaleControl";
import { LayerChoiceControl } from "@/components/collateral/social/LayerChoiceControl";
import { CardPositionPicker } from "@/components/collateral/business-card/CardPositionPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  BusinessCardDocumentJson,
  BusinessCardLayerState,
  BusinessCardVariantState,
} from "@/lib/collateral/templates/types";
import type { AgentProfile, Listing } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type SectionId =
  | "background"
  | "logo"
  | "headline"
  | "subcopy"
  | "agent"
  | "agent_photo"
  | "contact"
  | "qr"
  | "agency_line";

type Props = {
  document: BusinessCardDocumentJson;
  agents: AgentProfile[];
  listings: Listing[];
  onChange: (doc: BusinessCardDocumentJson) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function LayerToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {checked ? "On" : "Off"}
    </label>
  );
}

function positionFormat(v: number) {
  return v;
}

function PositionSliders({
  layer,
  id,
  onChange,
}: {
  layer: BusinessCardLayerState;
  id: string;
  onChange: (patch: Partial<BusinessCardLayerState>) => void;
}) {
  return (
    <div className="space-y-3">
      <LayerScaleControl
        id={`${id}-x`}
        label="Left →"
        value={layer.x}
        min={0}
        max={100}
        step={1}
        onChange={(x) => onChange({ x })}
        formatDisplay={positionFormat}
      />
      <LayerScaleControl
        id={`${id}-y`}
        label="Top ↓"
        value={layer.y}
        min={0}
        max={100}
        step={1}
        onChange={(y) => onChange({ y })}
        formatDisplay={positionFormat}
      />
    </div>
  );
}

function textPreview(text: string, max = 38) {
  const t = text.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// ── Back-specific panel ────────────────────────────────────────────────────────

function ColourSwatch({
  colour,
  label,
  selected,
  onSelect,
}: {
  colour: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onSelect}
      className={cn(
        "h-7 w-7 rounded-full ring-2 ring-offset-2 transition-all",
        selected ? "ring-foreground" : "ring-transparent hover:ring-border",
      )}
      style={{ backgroundColor: colour }}
    />
  );
}

type BackSectionId = "background" | "logo" | "qr";

function BackPanel({
  document,
  listings,
  onChange,
}: {
  document: BusinessCardDocumentJson;
  listings: Listing[];
  onChange: (doc: BusinessCardDocumentJson) => void;
}) {
  const variant = document.variants.back;
  const layers = variant.layers;
  const backStyle = variant.back_style ?? "colour";
  const logoVariant = variant.back_logo_variant ?? "light";
  const qrListingId = document.qr_listing_id;
  const qrCodeUrl = document.assets.qr_code_url ?? "";
  const qrPending = Boolean(qrListingId && !qrCodeUrl);
  const agency = document.agency;

  const [openSections, setOpenSections] = useState<Set<BackSectionId>>(
    () => new Set<BackSectionId>(["background", "logo", "qr"]),
  );
  function isOpen(id: BackSectionId) { return openSections.has(id); }
  function setOpen(id: BackSectionId, open: boolean) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
  }

  const sortedListings = useMemo(
    () =>
      [...listings].sort((a, b) =>
        (a.property_address ?? a.listing_title ?? "").localeCompare(
          b.property_address ?? b.listing_title ?? "",
        ),
      ),
    [listings],
  );

  const selectedListingLabel = qrListingId
    ? (sortedListings.find((l) => l.id === qrListingId)?.property_address ?? "Property selected")
    : null;

  const heroImageUrl =
    document.listing?.hero_image_url ??
    sortedListings.find((l) => l.id === qrListingId)?.hero_image_url ??
    "";

  function patchBack(patch: Partial<BusinessCardVariantState>) {
    onChange({
      ...document,
      variants: { ...document.variants, back: { ...variant, ...patch } },
    });
  }

  function patchBackLayer(
    layerId: keyof typeof layers,
    p: Partial<BusinessCardLayerState>,
  ) {
    patchBack({ layers: { ...layers, [layerId]: { ...layers[layerId], ...p } } });
  }

  // Brand colour presets
  const brandColours: { label: string; value: string }[] = [
    { label: "Primary", value: agency.primary_colour || "#111827" },
    ...(agency.secondary_colour ? [{ label: "Secondary", value: agency.secondary_colour }] : []),
    ...(agency.accent_colour ? [{ label: "Accent", value: agency.accent_colour }] : []),
    ...(agency.text_colour && agency.text_colour !== agency.primary_colour
      ? [{ label: "Text colour", value: agency.text_colour }]
      : []),
  ];
  const resolvedBackColour = variant.back_colour || agency.primary_colour || "#111827";
  const isCustomColour = Boolean(
    variant.back_colour && !brandColours.some((c) => c.value === variant.back_colour),
  );

  return (
    <div className="space-y-2">
      {/* ── Template picker ───────────────────────────────────────── */}
      <div className="space-y-2 pb-1">
        <p className="px-1 text-xs font-medium text-muted-foreground">Back side style</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "colour", icon: <Palette className="h-5 w-5" />, label: "Colour", desc: "Solid colour + logo" },
              { id: "photo", icon: <Image className="h-5 w-5" />, label: "Photo", desc: "Property photo + overlay" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => patchBack({ back_style: opt.id, show_qr: true, show_logo: true })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-xs font-medium transition-colors",
                backStyle === opt.id
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {opt.icon}
              <span>{opt.label}</span>
              <span className="text-center text-[10px] font-normal leading-tight opacity-60">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Background options ────────────────────────────────────── */}
      <LayerSection
        title={backStyle === "colour" ? "Background colour" : "Property photo"}
        open={isOpen("background")}
        onOpenChange={(o) => setOpen("background", o)}
      >
        {backStyle === "colour" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {brandColours.map((c) => (
                <ColourSwatch
                  key={c.value}
                  colour={c.value}
                  label={c.label}
                  selected={resolvedBackColour === c.value && !isCustomColour}
                  onSelect={() => patchBack({ back_colour: c.value })}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-muted-foreground">Custom</label>
              <input
                type="color"
                value={resolvedBackColour.startsWith("#") && resolvedBackColour.length >= 4 ? resolvedBackColour : "#111827"}
                onChange={(e) => patchBack({ back_colour: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
              />
              <input
                type="text"
                value={resolvedBackColour}
                onChange={(e) => patchBack({ back_colour: e.target.value || undefined })}
                className="h-7 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs"
                placeholder="#111827"
                maxLength={9}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImageUrl}
                alt="Hero"
                className="h-16 w-full rounded-lg object-cover"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a listing in the QR section to use the property photo as the background.
              </p>
            )}
            <p className="text-xs text-muted-foreground">50% black overlay is applied automatically.</p>
          </div>
        )}
      </LayerSection>

      {/* ── Logo ──────────────────────────────────────────────────── */}
      <LayerSection
        title="Logo"
        description={layers.logo.enabled ? logoVariant === "custom" ? "Custom" : logoVariant === "dark" ? "Dark version" : "Light version" : "Hidden"}
        open={isOpen("logo")}
        onOpenChange={(o) => setOpen("logo", o)}
        trailing={
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={layers.logo.enabled}
              onChange={(e) =>
                patchBack({
                  show_logo: e.target.checked,
                  layers: { ...layers, logo: { ...layers.logo, enabled: e.target.checked } },
                })
              }
            />
            {layers.logo.enabled ? "On" : "Off"}
          </label>
        }
      >
        {/* Logo variant */}
        <LayerChoiceControl
          id="bc-back-logo-variant"
          label="Version"
          value={logoVariant}
          options={[
            { value: "light", label: "Light (white)" },
            { value: "dark", label: "Dark" },
            { value: "custom", label: "Custom URL" },
          ]}
          onChange={(v) => patchBack({ back_logo_variant: v as "light" | "dark" | "custom" })}
        />
        {logoVariant === "custom" ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Logo URL</Label>
            <Input
              value={variant.back_logo_custom_url ?? ""}
              placeholder="https://…"
              onChange={(e) => patchBack({ back_logo_custom_url: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
        ) : null}
        {/* Logo position */}
        <CardPositionPicker
          label="Position"
          x={layers.logo.x}
          y={layers.logo.y}
          onChange={(x, y) => patchBackLayer("logo", { x, y })}
          reserved={{ x: layers.qr.x, y: layers.qr.y }}
        />
        <LayerScaleControl
          id="bc-back-logo-scale"
          label="Size"
          value={layers.logo.scale}
          min={0.4}
          max={2.5}
          step={0.05}
          onChange={(scale) => patchBackLayer("logo", { scale })}
        />
        <LayerScaleControl
          id="bc-back-logo-width"
          label="Max width"
          value={layers.logo.width}
          min={10}
          max={100}
          step={1}
          onChange={(width) => patchBackLayer("logo", { width })}
          formatDisplay={(v) => v}
        />
      </LayerSection>

      {/* ── QR code ───────────────────────────────────────────────── */}
      <LayerSection
        title="QR code"
        description={
          layers.qr.enabled
            ? qrCodeUrl
              ? (selectedListingLabel ?? "QR ready")
              : qrPending
                ? "Save to generate"
                : "Select a listing below"
            : "Hidden"
        }
        open={isOpen("qr")}
        onOpenChange={(o) => setOpen("qr", o)}
        trailing={
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={layers.qr.enabled}
              onChange={(e) =>
                patchBack({
                  show_qr: e.target.checked,
                  layers: { ...layers, qr: { ...layers.qr, enabled: e.target.checked } },
                })
              }
            />
            {layers.qr.enabled ? "On" : "Off"}
          </label>
        }
      >
        {/* Listing picker */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Property listing</Label>
          <select
            value={qrListingId ?? ""}
            onChange={(e) =>
              onChange({ ...document, qr_listing_id: e.target.value || null })
            }
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">No property QR</option>
            {sortedListings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.property_address ?? listing.listing_title ?? "Listing"}
              </option>
            ))}
          </select>
          {qrPending ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              QR code will be generated when you save.
            </div>
          ) : qrCodeUrl ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              QR ready.{selectedListingLabel ? ` ${selectedListingLabel}` : ""}
            </div>
          ) : null}
        </div>
        {/* QR position */}
        <CardPositionPicker
          label="Position"
          x={layers.qr.x}
          y={layers.qr.y}
          onChange={(x, y) => patchBackLayer("qr", { x, y })}
          reserved={{ x: layers.logo.x, y: layers.logo.y }}
        />
        <LayerScaleControl
          id="bc-back-qr-scale"
          label="Size"
          value={layers.qr.scale}
          min={0.5}
          max={3}
          step={0.1}
          onChange={(scale) => patchBackLayer("qr", { scale })}
        />
      </LayerSection>
    </div>
  );
}

// ── Front panel ────────────────────────────────────────────────────────────────

function FrontPanel({
  document,
  agents,
  listings,
  onChange,
}: {
  document: BusinessCardDocumentJson;
  agents: AgentProfile[];
  listings: Listing[];
  onChange: (doc: BusinessCardDocumentJson) => void;
}) {
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    () => new Set<SectionId>(["background"]),
  );

  const variant = document.variants.front;
  const layers = variant.layers;

  function isOpen(id: SectionId) {
    return openSections.has(id);
  }

  function setOpen(id: SectionId, open: boolean) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function patchVariant(patch: Partial<BusinessCardVariantState>) {
    onChange({
      ...document,
      variants: {
        ...document.variants,
        front: { ...variant, ...patch },
      },
    });
  }

  function patchLayer(
    layerId: keyof typeof layers,
    patch: Partial<BusinessCardLayerState>,
  ) {
    patchVariant({ layers: { ...layers, [layerId]: { ...layers[layerId], ...patch } } });
  }

  function patchAgent(patch: Partial<typeof document.agent>) {
    onChange({ ...document, agent: { ...document.agent, ...patch } });
  }

  function handleAgentProfileChange(agentId: string) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    onChange({
      ...document,
      agent_profile_id: agent.id,
      agent: {
        name: agent.name,
        role_title: agent.role_title ?? "",
        phone: agent.phone ?? "",
        email: agent.email ?? "",
        photo_url: agent.photo_url ?? "",
      },
    });
  }

  return (
    <div className="space-y-2">
      {/* Background */}
      <LayerSection
        title="Background"
        description={variant.background_style === "brand" ? "Brand colour" : "Light"}
        open={isOpen("background")}
        onOpenChange={(o) => setOpen("background", o)}
      >
        <LayerChoiceControl
          id="bc-bg"
          label="Style"
          value={variant.background_style}
          options={[
            { value: "light", label: "Light" },
            { value: "brand", label: "Brand colour" },
          ]}
          onChange={(v) =>
            patchVariant({ background_style: v as "light" | "brand" })
          }
        />
      </LayerSection>

      {/* Logo */}
      <LayerSection
        title="Logo"
        description={layers.logo.enabled ? undefined : "Hidden"}
        open={isOpen("logo")}
        onOpenChange={(o) => setOpen("logo", o)}
        trailing={
          <LayerToggle
            checked={layers.logo.enabled}
            onChange={(v) =>
              patchVariant({
                show_logo: v,
                layers: { ...layers, logo: { ...layers.logo, enabled: v } },
              })
            }
          />
        }
      >
        <PositionSliders layer={layers.logo} id="bc-logo" onChange={(p) => patchLayer("logo", p)} />
        <LayerScaleControl
          id="bc-logo-scale"
          label="Size"
          value={layers.logo.scale}
          min={0.4}
          max={2.5}
          step={0.05}
          onChange={(scale) => patchLayer("logo", { scale })}
        />
        <LayerScaleControl
          id="bc-logo-width"
          label="Width"
          value={layers.logo.width}
          min={10}
          max={100}
          step={1}
          onChange={(width) => patchLayer("logo", { width })}
          formatDisplay={positionFormat}
        />
      </LayerSection>

      {/* Headline */}
      <LayerSection
        title="Headline"
        description={
          layers.headline.enabled
            ? (textPreview(variant.headline) ?? "No text — enter text below")
            : "Hidden"
        }
        open={isOpen("headline")}
        onOpenChange={(o) => setOpen("headline", o)}
        trailing={
          <LayerToggle
            checked={layers.headline.enabled}
            onChange={(v) =>
              patchVariant({
                layers: { ...layers, headline: { ...layers.headline, enabled: v } },
              })
            }
          />
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Text</Label>
          <Input
            value={variant.headline}
            placeholder="e.g. Let's talk property."
            onChange={(e) => patchVariant({ headline: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <PositionSliders layer={layers.headline} id="bc-headline" onChange={(p) => patchLayer("headline", p)} />
        <LayerScaleControl
          id="bc-headline-scale"
          label="Size"
          value={layers.headline.scale}
          min={0.5}
          max={2.5}
          step={0.05}
          onChange={(scale) => patchLayer("headline", { scale })}
        />
        <LayerScaleControl
          id="bc-headline-width"
          label="Width"
          value={layers.headline.width}
          min={20}
          max={100}
          step={1}
          onChange={(width) => patchLayer("headline", { width })}
          formatDisplay={positionFormat}
        />
      </LayerSection>

      {/* Subcopy */}
      <LayerSection
        title="Subcopy"
        description={
          layers.subcopy.enabled
            ? (textPreview(variant.subcopy) ?? "No text — enter text below")
            : "Hidden"
        }
        open={isOpen("subcopy")}
        onOpenChange={(o) => setOpen("subcopy", o)}
        trailing={
          <LayerToggle
            checked={layers.subcopy.enabled}
            onChange={(v) =>
              patchVariant({
                layers: { ...layers, subcopy: { ...layers.subcopy, enabled: v } },
              })
            }
          />
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Text</Label>
          <Textarea
            value={variant.subcopy}
            placeholder="Supporting copy…"
            rows={2}
            onChange={(e) => patchVariant({ subcopy: e.target.value })}
            className="text-sm"
          />
        </div>
        <PositionSliders layer={layers.subcopy} id="bc-subcopy" onChange={(p) => patchLayer("subcopy", p)} />
        <LayerScaleControl
          id="bc-subcopy-scale"
          label="Size"
          value={layers.subcopy.scale}
          min={0.5}
          max={2.5}
          step={0.05}
          onChange={(scale) => patchLayer("subcopy", { scale })}
        />
        <LayerScaleControl
          id="bc-subcopy-width"
          label="Width"
          value={layers.subcopy.width}
          min={20}
          max={100}
          step={1}
          onChange={(width) => patchLayer("subcopy", { width })}
          formatDisplay={positionFormat}
        />
      </LayerSection>

      {/* Agent */}
      <LayerSection
        title="Agent"
        description={textPreview(document.agent.name) ?? "No agent selected"}
        open={isOpen("agent")}
        onOpenChange={(o) => setOpen("agent", o)}
      >
        {agents.length > 0 ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Profile</Label>
            <select
              value={document.agent_profile_id ?? ""}
              onChange={(e) => handleAgentProfileChange(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="" disabled>
                Choose an agent
              </option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={document.agent.name}
              onChange={(e) => patchAgent({ name: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Input
              value={document.agent.role_title}
              onChange={(e) => patchAgent({ role_title: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input
              value={document.agent.phone}
              onChange={(e) => patchAgent({ phone: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              value={document.agent.email}
              onChange={(e) => patchAgent({ email: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </LayerSection>

      {/* Agent photo */}
      <LayerSection
        title="Agent photo"
        description={
          layers.agent_photo.enabled
            ? document.agent.photo_url
              ? "Photo URL set"
              : "Using initials"
            : "Hidden"
        }
        open={isOpen("agent_photo")}
        onOpenChange={(o) => setOpen("agent_photo", o)}
        trailing={
          <LayerToggle
            checked={layers.agent_photo.enabled}
            onChange={(v) =>
              patchVariant({
                show_agent_photo: v,
                layers: { ...layers, agent_photo: { ...layers.agent_photo, enabled: v } },
              })
            }
          />
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Photo URL</Label>
          <Input
            value={document.agent.photo_url}
            placeholder="https://… or leave blank for initials"
            onChange={(e) => patchAgent({ photo_url: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <PositionSliders layer={layers.agent_photo} id="bc-photo" onChange={(p) => patchLayer("agent_photo", p)} />
        <LayerScaleControl
          id="bc-photo-scale"
          label="Size"
          value={layers.agent_photo.scale}
          min={0.3}
          max={3}
          step={0.05}
          onChange={(scale) => patchLayer("agent_photo", { scale })}
        />
      </LayerSection>

      {/* Contact block */}
      <LayerSection
        title="Contact block"
        description={
          layers.agent_contact.enabled
            ? (textPreview(document.agent.name) ?? "Name / phone / email")
            : "Hidden"
        }
        open={isOpen("contact")}
        onOpenChange={(o) => setOpen("contact", o)}
        trailing={
          <LayerToggle
            checked={layers.agent_contact.enabled}
            onChange={(v) =>
              patchVariant({
                layers: { ...layers, agent_contact: { ...layers.agent_contact, enabled: v } },
              })
            }
          />
        }
      >
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded accent-primary"
            checked={variant.show_contact}
            onChange={(e) => patchVariant({ show_contact: e.target.checked })}
          />
          Show phone &amp; email
        </label>
        <PositionSliders layer={layers.agent_contact} id="bc-contact" onChange={(p) => patchLayer("agent_contact", p)} />
        <LayerScaleControl
          id="bc-contact-scale"
          label="Size"
          value={layers.agent_contact.scale}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(scale) => patchLayer("agent_contact", { scale })}
        />
        <LayerScaleControl
          id="bc-contact-width"
          label="Width"
          value={layers.agent_contact.width}
          min={20}
          max={100}
          step={1}
          onChange={(width) => patchLayer("agent_contact", { width })}
          formatDisplay={positionFormat}
        />
      </LayerSection>

      {/* Agency line */}
      <LayerSection
        title="Agency line"
        description={
          layers.agency_details.enabled
            ? variant.show_agency_details
              ? "Website / phone / email"
              : "Off"
            : "Hidden"
        }
        open={isOpen("agency_line")}
        onOpenChange={(o) => setOpen("agency_line", o)}
        trailing={
          <LayerToggle
            checked={layers.agency_details.enabled}
            onChange={(v) =>
              patchVariant({
                layers: { ...layers, agency_details: { ...layers.agency_details, enabled: v } },
              })
            }
          />
        }
      >
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded accent-primary"
            checked={variant.show_agency_details}
            onChange={(e) => patchVariant({ show_agency_details: e.target.checked })}
          />
          Show agency website / contact
        </label>
        <PositionSliders layer={layers.agency_details} id="bc-agency" onChange={(p) => patchLayer("agency_details", p)} />
        <LayerScaleControl
          id="bc-agency-scale"
          label="Size"
          value={layers.agency_details.scale}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(scale) => patchLayer("agency_details", { scale })}
        />
        <LayerScaleControl
          id="bc-agency-width"
          label="Width"
          value={layers.agency_details.width}
          min={20}
          max={100}
          step={1}
          onChange={(width) => patchLayer("agency_details", { width })}
          formatDisplay={positionFormat}
        />
      </LayerSection>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export function BusinessCardLayerPanel({
  document,
  agents,
  listings,
  onChange,
}: Props) {
  const isBack = document.active_variant_id === "back";

  return isBack ? (
    <BackPanel document={document} listings={listings} onChange={onChange} />
  ) : (
    <FrontPanel
      document={document}
      agents={agents}
      listings={listings}
      onChange={onChange}
    />
  );
}
