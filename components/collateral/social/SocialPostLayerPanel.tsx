"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SocialPostAgentPickerDialog } from "@/components/collateral/social/SocialPostAgentPickerDialog";
import { LayerSection } from "@/components/collateral/social/LayerSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayerChoiceControl } from "@/components/collateral/social/LayerChoiceControl";
import { SocialPostBackgroundLayoutPicker } from "@/components/collateral/social/SocialPostBackgroundLayoutPicker";
import {
  getBackgroundLayoutSpec,
  imagePoolFromDocument,
  migrateVariantBackground,
  normalizeBackgroundLayout,
  patchVariantBackground,
} from "@/lib/collateral/social/backgroundLayout";
import {
  SOCIAL_POST_LOGO_COLOUR_OPTIONS,
  normalizeLogoColour,
} from "@/lib/collateral/social/logoColour";
import { LayerScaleControl } from "@/components/collateral/social/LayerScaleControl";
import {
  LayerBottomCornerPicker,
  LayerCornerPicker,
  LayerTopCornerPicker,
} from "@/components/collateral/social/LayerCornerPicker";
import { normalizeLogoPlacement } from "@/lib/collateral/social/presetPlacement";
import { LayerTextAlignControl } from "@/components/collateral/social/LayerTextAlignControl";
import { LayerColourInput } from "@/components/collateral/social/LayerColourInput";
import {
  normalizeAgentBackgroundStyle,
  normalizeAgentBrandColour,
  resolveBrandColourKey,
} from "@/lib/collateral/social/agentStyle";
import {
  normalizeAgentLayout,
  normalizeAvatarShape,
} from "@/lib/collateral/social/agentLayer";
import {
  AGENT_INNER_GAP_SCALE_MAX,
  AGENT_INNER_GAP_SCALE_MIN,
  AGENT_SCALE_MAX,
  AGENT_SCALE_MIN,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  normalizeAgentInnerGapScale,
  normalizeAgentScale,
  TEXT_BOX_WIDTH_SCALE_MAX,
  TEXT_BOX_WIDTH_SCALE_MIN,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_LINE_GAP_SCALE_MAX,
  TEXT_LINE_GAP_SCALE_MIN,
  TEXT_ZONE_INSET_MAX,
  TEXT_ZONE_INSET_MIN,
  normalizeLogoScale,
  normalizeTextLineGapScale,
  normalizeTextAlign,
  normalizeTextBoxWidthScale,
  normalizeTextScale,
  normalizeTextZoneInset,
  textBoxWidthScaleToPercent,
} from "@/lib/collateral/social/layerScale";
import type { CollateralAgentSlice } from "@/lib/collateral/templates/types";
import { formatTextScaleHint } from "@/lib/collateral/social/formatTypography";
import {
  formatListingFeaturesLine,
  listingHasFeatureStats,
  mergeListingSliceStats,
} from "@/lib/collateral/social/listingFeatures";
import {
  applyDocumentLayerUpdate,
  getLayersForVariant,
  patchDocumentAgent,
  patchDocumentListing,
} from "@/lib/collateral/social/variantLayers";
import {
  alignForTextCorner,
  normalizeAgentPlacement,
  normalizeCorner,
} from "@/lib/collateral/social/presetPlacement";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";
import type { AgentProfile, Listing } from "@/lib/types";

type DocumentUpdater =
  | SocialPostsDocumentJson
  | ((prev: SocialPostsDocumentJson) => SocialPostsDocumentJson);

type Props = {
  document: SocialPostsDocumentJson;
  listing: Listing;
  backgroundOptions: string[];
  onChange: (next: DocumentUpdater) => void;
  section?: "photos" | "wording" | "branding";
};

type LayerSectionId =
  | "background"
  | "logo"
  | "headline"
  | "subcopy"
  | "features"
  | "textLayout"
  | "agent";

function layerPreview(text: string, max = 36) {
  const trimmed = text.trim();
  if (!trimmed) return "Off";
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function LayerToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-base-content/65">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function LayerVisibilityToggle({
  enabled,
  disabled,
  disabledHint,
  onToggle,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onToggle: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${label}: ${enabled ? "visible" : "hidden"}`}
      title={disabled ? disabledHint : undefined}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!enabled);
      }}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        disabled
          ? "cursor-not-allowed border-base-300 text-base-content/50"
          : enabled
            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-base-300 text-base-content/65 hover:bg-base-200",
      )}
    >
      {enabled ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      <span>{enabled ? "Shown" : "Hidden"}</span>
    </button>
  );
}

export function SocialPostLayerPanel({
  document,
  listing,
  backgroundOptions,
  onChange,
  section,
}: Props) {
  const variant = document.variants[document.active_variant_id];
  const { agency, agent } = document;
  const layers = getLayersForVariant(document, document.active_variant_id);
  const agentLayer = layers.agent;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<LayerSectionId>>(
    () => new Set<LayerSectionId>(["background"]),
  );
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [activeBackgroundSlot, setActiveBackgroundSlot] = useState(0);

  const imagePool = useMemo(
    () =>
      imagePoolFromDocument({
        listingHeroUrl: document.listing.hero_image_url,
        variants: Object.values(document.variants),
        galleryUrls: backgroundOptions,
      }),
    [backgroundOptions, document.listing.hero_image_url, document.variants],
  );

  const backgroundLayout = normalizeBackgroundLayout(
    variant?.background_layout,
  );
  const backgroundSpec = getBackgroundLayoutSpec(backgroundLayout);
  const backgroundUrls =
    variant?.background_image_urls ??
    (variant?.background_image_url ? [variant.background_image_url] : []);
  const resolvedBackground = variant
    ? migrateVariantBackground(variant, imagePool)
    : null;

  function setSectionOpen(id: LayerSectionId, open: boolean) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function isSectionOpen(id: LayerSectionId) {
    return openSections.has(id);
  }

  useEffect(() => {
    if (!pickerOpen) return;

    fetch("/api/agents")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.agents) {
          setAgencyAgents(payload.agents as AgentProfile[]);
        }
      })
      .catch(() => {
        setAgencyAgents([]);
      })
      .finally(() => setAgentsLoading(false));
  }, [pickerOpen]);

  function updateLayers(patch: Partial<SocialPostsDocumentJson["layers"]>) {
    onChange((prev) => applyDocumentLayerUpdate(prev, patch));
  }

  function updateAgent(patch: Partial<SocialPostsDocumentJson["agent"]>) {
    onChange((prev) => patchDocumentAgent(prev, patch));
  }

  function updateListing(patch: Partial<SocialPostsDocumentJson["listing"]>) {
    onChange((prev) => patchDocumentListing(prev, patch));
  }

  function refreshListingStats() {
    onChange((prev) =>
      patchDocumentListing(prev, mergeListingSliceStats(prev.listing, listing)),
    );
  }

  const featuresPreview = formatListingFeaturesLine(
    document.listing,
    layers.features,
  );
  const listingHasStats = listingHasFeatureStats(document.listing);
  const hasTextLayout =
    layers.title.enabled || layers.subcopy.enabled || layers.features.enabled;

  function loadAgentFromOrg(nextAgent: CollateralAgentSlice) {
    onChange((prev) => {
      const withAgent = patchDocumentAgent(prev, nextAgent);
      const currentAgentLayer = getLayersForVariant(
        withAgent,
        withAgent.active_variant_id,
      ).agent;
      return applyDocumentLayerUpdate(withAgent, {
        agent: { ...currentAgentLayer, enabled: true },
      });
    });
  }

  function updateVariantBackground(
    patch: Parameters<typeof patchVariantBackground>[1],
  ) {
    onChange((prev) => {
      const activeId = prev.active_variant_id;
      const current = prev.variants[activeId];
      if (!current) return prev;

      const nextVariant = patchVariantBackground(current, patch, imagePool);
      return {
        ...prev,
        variants: {
          ...prev.variants,
          [activeId]: nextVariant,
        },
      };
    });
  }

  function assignBackgroundPhoto(url: string) {
    const slot =
      backgroundSpec.cellCount > 1
        ? Math.min(activeBackgroundSlot, backgroundSpec.cellCount - 1)
        : 0;
    updateVariantBackground({ slotIndex: slot, slotUrl: url });
  }

  return (
    <div data-theme="staypack-workspace" className="space-y-5">
      <LayerSection
        hidden={!!section && section !== "photos"}
        collapsible={!section}
        title="Property photos"
        description={section ? undefined : "Choose a photo or create a collage"}
        open={isSectionOpen("background")}
        onOpenChange={(open) => setSectionOpen("background", open)}
      >
        <SocialPostBackgroundLayoutPicker
          value={backgroundLayout}
          onChange={(layout) => {
            setActiveBackgroundSlot(0);
            updateVariantBackground({ layout });
          }}
        />

        {backgroundSpec.cellCount > 1 ? (
          <div className="space-y-2">
            <Label className="text-xs text-base-content/65">
              Choose which photo to replace, then pick one below
            </Label>
            <div
              className={cn(
                "grid gap-2",
                backgroundSpec.cellCount === 2
                  ? "grid-cols-2"
                  : backgroundSpec.cellCount === 3
                    ? "grid-cols-3"
                    : "grid-cols-4",
              )}
            >
              {Array.from({ length: backgroundSpec.cellCount }).map(
                (_, index) => {
                  const url =
                    resolvedBackground?.background_image_urls?.[index];
                  const isActive =
                    Math.min(
                      activeBackgroundSlot,
                      backgroundSpec.cellCount - 1,
                    ) === index;
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Replace photo ${index + 1}`}
                      aria-pressed={isActive}
                      onClick={() => setActiveBackgroundSlot(index)}
                      className={cn("relative aspect-square overflow-hidden rounded-md ring-2 transition-colors",
                        isActive
                          ? "ring-primary"
                          : "ring-base-300 hover:ring-base-content/40",
                      )}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-base-content/65">
                          {index + 1}
                        </div>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-neutral px-1.5 py-0.5 text-xs font-medium text-neutral-content">
                        {index + 1}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            {backgroundSpec.cellCount > 1
              ? `Choose photo ${Math.min(activeBackgroundSlot, backgroundSpec.cellCount - 1) + 1}`
              : "Choose a photo"}
          </p>
          {!imagePool.length ? (
            <div className="rounded-xl border border-dashed border-base-300 p-5 text-sm text-base-content/65">
              <ImagePlus className="mb-2 size-5" aria-hidden="true" />
              <p>
                No property photos yet. Add photos to your listing, then return
                here to choose one.
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            {imagePool.map((url, index) => {
              const usedInCollage = (
                resolvedBackground?.background_image_urls ?? backgroundUrls
              ).includes(url);
              const selected =
                resolvedBackground?.background_image_urls?.[
                  Math.min(activeBackgroundSlot, backgroundSpec.cellCount - 1)
                ] === url;
              return (
                <button
                  key={url}
                  type="button"
                  aria-label={`Use listing photo ${index + 1}`}
                  aria-pressed={selected}
                  className={cn("relative aspect-square overflow-hidden rounded-md ring-2 transition-colors",
                    usedInCollage
                      ? "ring-primary/70"
                      : "ring-transparent hover:ring-base-content/40",
                  )}
                  onClick={() => assignBackgroundPhoto(url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {usedInCollage ? (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-content">
                      <Check className="size-3" aria-hidden="true" />
                      <span className="sr-only">Used in this post</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </LayerSection>

      <LayerSection
        hidden={!!section && section !== "branding"}
        collapsible={!section}
        title="Agency logo"
        description={
          agency.logo_url
            ? "Always at the top of the post"
            : "Add a logo in brand settings"
        }
        open={isSectionOpen("logo")}
        onOpenChange={(open) => setSectionOpen("logo", open)}
        trailing={
          <LayerVisibilityToggle
            label="Logo"
            enabled={layers.logo.enabled}
            disabled={!agency.logo_url}
            disabledHint="Add a logo in brand settings first"
            onToggle={(enabled) =>
              updateLayers({ logo: { ...layers.logo, enabled } })
            }
          />
        }
      >
        {layers.logo.enabled && agency.logo_url ? (
          <>
            <FineTune label="Logo appearance">
              <LayerTopCornerPicker
                label="Top position"
                value={normalizeLogoPlacement(layers.logo.placement)}
                onChange={(placement) =>
                  updateLayers({ logo: { ...layers.logo, placement } })
                }
              />
              <LayerScaleControl
                id="social-logo-scale"
                label="Logo size"
                value={normalizeLogoScale(layers.logo.scale)}
                min={LOGO_SCALE_MIN}
                max={LOGO_SCALE_MAX}
                onChange={(scale) =>
                  updateLayers({ logo: { ...layers.logo, scale } })
                }
              />
              <LayerChoiceControl
                id="social-logo-colour"
                label="Logo colour"
                value={normalizeLogoColour(layers.logo.colour)}
                options={SOCIAL_POST_LOGO_COLOUR_OPTIONS}
                onChange={(colour) =>
                  updateLayers({ logo: { ...layers.logo, colour } })
                }
              />
            </FineTune>
          </>
        ) : null}
      </LayerSection>

      <LayerSection
        hidden={!!section && section !== "wording"}
        collapsible={!section}
        title="Headline"
        description={
          section
            ? undefined
            : layerPreview(layers.title.enabled ? layers.title.text : "")
        }
        open={isSectionOpen("headline")}
        onOpenChange={(open) => setSectionOpen("headline", open)}
        trailing={
          <LayerVisibilityToggle
            label="Headline"
            enabled={layers.title.enabled}
            onToggle={(enabled) =>
              updateLayers({ title: { ...layers.title, enabled } })
            }
          />
        }
      >
        {layers.title.enabled ? (
          <>
            <div className="space-y-1.5">
              <Label
                htmlFor="social-headline"
                className="text-xs text-base-content/65"
              >
                Headline text
              </Label>
              <Input
                className="min-h-11 text-base md:text-sm"
                id="social-headline"
                value={layers.title.text}
                onChange={(e) =>
                  updateLayers({
                    title: { ...layers.title, text: e.target.value },
                  })
                }
              />
              {layers.title.text.trim() ? null : (
                <p className="text-xs text-error-content">
                  Add text — the headline won&apos;t appear on the post while
                  it&apos;s empty.
                </p>
              )}
            </div>
            <FineTune label="Text size">
              <LayerScaleControl
                id="social-title-scale"
                label="Size"
                value={normalizeTextScale(layers.title.scale)}
                min={TEXT_SCALE_MIN}
                max={TEXT_SCALE_MAX}
                onChange={(scale) =>
                  updateLayers({ title: { ...layers.title, scale } })
                }
              />
              <p className="text-xs text-base-content/65">
                {formatTextScaleHint(
                  document.active_variant_id,
                  "title",
                  layers.title.scale,
                )}{" "}
                for this format
              </p>
            </FineTune>
          </>
        ) : (
          <p className="text-xs text-base-content/65">
            Turn on the headline to add it to your post.
          </p>
        )}
      </LayerSection>

      <LayerSection
        hidden={!!section && section !== "wording"}
        collapsible={!section}
        title="Supporting line"
        description={
          section
            ? undefined
            : layerPreview(layers.subcopy.enabled ? layers.subcopy.text : "")
        }
        open={isSectionOpen("subcopy")}
        onOpenChange={(open) => setSectionOpen("subcopy", open)}
        trailing={
          <LayerVisibilityToggle
            label="Supporting line"
            enabled={layers.subcopy.enabled}
            onToggle={(enabled) =>
              updateLayers({
                subcopy: {
                  ...layers.subcopy,
                  enabled,
                  ...(enabled
                    ? {
                        block_placement: layers.title.block_placement,
                        align: layers.title.align,
                      }
                    : {}),
                },
              })
            }
          />
        }
      >
        {layers.subcopy.enabled ? (
          <>
            <div className="space-y-1.5">
              <Label
                htmlFor="social-subcopy"
                className="text-xs text-base-content/65"
              >
                Supporting text
              </Label>
              <Input
                className="min-h-11 text-base md:text-sm"
                id="social-subcopy"
                value={layers.subcopy.text}
                placeholder="Supporting line under headline"
                onChange={(e) =>
                  updateLayers({
                    subcopy: { ...layers.subcopy, text: e.target.value },
                  })
                }
              />
              {layers.subcopy.text.trim() ? null : (
                <p className="text-xs text-error-content">
                  Add text — the supporting line won&apos;t appear on the post
                  while it&apos;s empty.
                </p>
              )}
            </div>
            <FineTune label="Text size">
              <LayerScaleControl
                id="social-subcopy-scale"
                label="Size"
                value={normalizeTextScale(layers.subcopy.scale)}
                min={TEXT_SCALE_MIN}
                max={TEXT_SCALE_MAX}
                onChange={(scale) =>
                  updateLayers({ subcopy: { ...layers.subcopy, scale } })
                }
              />
              <p className="text-xs text-base-content/65">
                {formatTextScaleHint(
                  document.active_variant_id,
                  "subcopy",
                  layers.subcopy.scale,
                )}{" "}
                for this format
              </p>
            </FineTune>
          </>
        ) : (
          <p className="text-xs text-base-content/65">
            Optional line between the headline and property details.
          </p>
        )}
      </LayerSection>

      <LayerSection
        hidden={!!section && section !== "wording"}
        title="Property details"
        description={
          layers.features.enabled && featuresPreview ? featuresPreview : "Off"
        }
        open={isSectionOpen("features")}
        onOpenChange={(open) => setSectionOpen("features", open)}
        trailing={
          <LayerVisibilityToggle
            label="Property details"
            enabled={layers.features.enabled}
            disabled={!listingHasStats && !document.listing.land_area_sqm}
            disabledHint="Add beds, baths, parking or land area first"
            onToggle={(enabled) =>
              updateLayers({ features: { ...layers.features, enabled } })
            }
          />
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 w-full text-sm"
          onClick={refreshListingStats}
        >
          Refresh from listing
        </Button>
        {layers.features.enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <LayerToggle
                label="Beds"
                checked={layers.features.show_bedrooms}
                disabled={document.listing.bedrooms == null}
                onChange={(show_bedrooms) =>
                  updateLayers({
                    features: { ...layers.features, show_bedrooms },
                  })
                }
              />
              <LayerToggle
                label="Baths"
                checked={layers.features.show_bathrooms}
                disabled={document.listing.bathrooms == null}
                onChange={(show_bathrooms) =>
                  updateLayers({
                    features: { ...layers.features, show_bathrooms },
                  })
                }
              />
              <LayerToggle
                label="Cars"
                checked={layers.features.show_car_spaces}
                disabled={document.listing.car_spaces == null}
                onChange={(show_car_spaces) =>
                  updateLayers({
                    features: { ...layers.features, show_car_spaces },
                  })
                }
              />
              <LayerToggle
                label="Land (m²)"
                checked={layers.features.show_land_area}
                disabled={
                  document.listing.land_area_sqm == null ||
                  document.listing.land_area_sqm <= 0
                }
                onChange={(show_land_area) =>
                  updateLayers({
                    features: { ...layers.features, show_land_area },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="social-land-area"
                className="text-xs text-base-content/65"
              >
                Land area (m²)
              </Label>
              <Input
                className="min-h-11 text-base md:text-sm"
                id="social-land-area"
                type="number"
                min={0}
                placeholder="e.g. 400"
                value={
                  document.listing.land_area_sqm != null
                    ? String(document.listing.land_area_sqm)
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  updateListing({
                    land_area_sqm: raw === "" ? null : Number(raw),
                  });
                }}
              />
            </div>
            <FineTune label="Text size">
              <LayerScaleControl
                id="social-features-scale"
                label="Size"
                value={normalizeTextScale(layers.features.scale)}
                min={TEXT_SCALE_MIN}
                max={TEXT_SCALE_MAX}
                onChange={(scale) =>
                  updateLayers({ features: { ...layers.features, scale } })
                }
              />
              <p className="text-xs text-base-content/65">
                {formatTextScaleHint(
                  document.active_variant_id,
                  "features",
                  layers.features.scale,
                )}{" "}
                for this format
              </p>
            </FineTune>
            {featuresPreview ? (
              <p className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-base-content/65">
                Preview: {featuresPreview}
              </p>
            ) : (
              <p className="text-xs text-base-content/65">
                No stats to show. Refresh from listing or add land area.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-base-content/65">
            Beds, baths, parking and land size appear below the supporting line
            when enabled.
          </p>
        )}
      </LayerSection>

      <LayerSection
        hidden={!!section && section !== "wording"}
        title="Fine-tune text layout"
        description="Position, spacing and alignment"
        open={isSectionOpen("textLayout")}
        onOpenChange={(open) => setSectionOpen("textLayout", open)}
      >
        {hasTextLayout ? (
          <>
            <LayerCornerPicker
              label="Position"
              value={normalizeCorner(
                layers.title.block_placement,
                "bottom_left",
              )}
              onChange={(block_placement) => {
                const align = alignForTextCorner(block_placement);
                updateLayers({
                  title: { ...layers.title, block_placement, align },
                  subcopy: { ...layers.subcopy, block_placement, align },
                });
              }}
            />
            <p className="text-xs text-base-content/65">
              Middle band between logo and agent. Corner sets where the text
              block sits.
            </p>
            <LayerScaleControl
              id="social-title-width"
              label="Text width"
              value={normalizeTextBoxWidthScale(layers.title.box_width_scale)}
              min={TEXT_BOX_WIDTH_SCALE_MIN}
              max={TEXT_BOX_WIDTH_SCALE_MAX}
              step={0.05}
              formatDisplay={textBoxWidthScaleToPercent}
              onChange={(box_width_scale) =>
                updateLayers({
                  title: { ...layers.title, box_width_scale },
                  subcopy: { ...layers.subcopy, box_width_scale },
                })
              }
            />
            <LayerTextAlignControl
              id="social-title-align"
              label="Alignment"
              value={normalizeTextAlign(layers.title.align)}
              onChange={(align) =>
                updateLayers({
                  title: { ...layers.title, align },
                  subcopy: { ...layers.subcopy, align },
                })
              }
            />
            <LayerScaleControl
              id="social-title-line-gap"
              label="Space between lines"
              value={normalizeTextLineGapScale(layers.title.line_gap_scale)}
              min={TEXT_LINE_GAP_SCALE_MIN}
              max={TEXT_LINE_GAP_SCALE_MAX}
              step={0.05}
              onChange={(line_gap_scale) =>
                updateLayers({
                  title: { ...layers.title, line_gap_scale },
                  subcopy: { ...layers.subcopy, line_gap_scale },
                })
              }
            />
            <p className="text-xs text-base-content/65">
              Gap between headline, supporting line, and property details. 100%
              is the default spacing.
            </p>
            <LayerScaleControl
              id="social-title-inset-top"
              label="Top space (below logo)"
              value={normalizeTextZoneInset(layers.title.zone_inset_top)}
              min={TEXT_ZONE_INSET_MIN}
              max={TEXT_ZONE_INSET_MAX}
              onChange={(zone_inset_top) =>
                updateLayers({
                  title: { ...layers.title, zone_inset_top },
                  subcopy: { ...layers.subcopy, zone_inset_top },
                })
              }
            />
            <LayerScaleControl
              id="social-title-inset-bottom"
              label="Bottom space (above agent)"
              value={normalizeTextZoneInset(layers.title.zone_inset_bottom)}
              min={TEXT_ZONE_INSET_MIN}
              max={TEXT_ZONE_INSET_MAX}
              onChange={(zone_inset_bottom) =>
                updateLayers({
                  title: { ...layers.title, zone_inset_bottom },
                  subcopy: { ...layers.subcopy, zone_inset_bottom },
                })
              }
            />
          </>
        ) : (
          <p className="text-xs text-base-content/65">
            Turn on headline, supporting line, or property details to adjust
            layout.
          </p>
        )}
      </LayerSection>

      <LayerSection
        hidden={!!section && section !== "branding"}
        collapsible={!section}
        title="Agent"
        description="Avatar, phone and email"
        open={isSectionOpen("agent")}
        onOpenChange={(open) => setSectionOpen("agent", open)}
        trailing={
          agentLayer?.enabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 px-2 text-xs text-base-content/65"
              onClick={() =>
                updateLayers({
                  agent: { ...agentLayer, enabled: false },
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 px-2 text-xs"
              onClick={() =>
                updateLayers({
                  agent: { ...agentLayer, enabled: true },
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )
        }
      >
        {agentLayer?.enabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setAgentsLoading(true);
                setPickerOpen(true);
              }}
            >
              <Users className="h-4 w-4" />
              Load from team
            </Button>

            <div className="space-y-1.5">
              <Label
                htmlFor="social-agent-name"
                className="text-xs text-base-content/65"
              >
                Name
              </Label>
              <Input
                className="min-h-11 text-base md:text-sm"
                id="social-agent-name"
                value={agent.name}
                onChange={(e) => updateAgent({ name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="social-agent-phone"
                className="text-xs text-base-content/65"
              >
                Phone
              </Label>
              <Input
                className="min-h-11 text-base md:text-sm"
                id="social-agent-phone"
                type="tel"
                value={agent.phone}
                onChange={(e) => updateAgent({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="social-agent-email"
                className="text-xs text-base-content/65"
              >
                Email
              </Label>
              <Input
                className="min-h-11 text-base md:text-sm"
                id="social-agent-email"
                type="email"
                value={agent.email}
                onChange={(e) => updateAgent({ email: e.target.value })}
              />
            </div>
            <FineTune label="Agent appearance">
              <LayerBottomCornerPicker
                label="Position"
                value={normalizeAgentPlacement(agentLayer.placement)}
                onChange={(placement) =>
                  updateLayers({ agent: { ...agentLayer, placement } })
                }
              />
              <p className="text-xs text-base-content/65">
                Bottom of the post. With vertical layout, left / center / right
                also aligns the photo and text.
              </p>
              <LayerScaleControl
                id="social-agent-scale"
                label="Agent block size"
                value={normalizeAgentScale(agentLayer.scale)}
                min={AGENT_SCALE_MIN}
                max={AGENT_SCALE_MAX}
                onChange={(scale) =>
                  updateLayers({ agent: { ...agentLayer, scale } })
                }
              />
              <LayerChoiceControl
                id="social-agent-layout"
                label="Layout"
                value={normalizeAgentLayout(agentLayer.layout)}
                options={[
                  { value: "vertical", label: "Vertical" },
                  { value: "horizontal", label: "Horizontal" },
                ]}
                onChange={(layout) =>
                  updateLayers({ agent: { ...agentLayer, layout } })
                }
              />
              <LayerScaleControl
                id="social-agent-inner-gap"
                label="Space between photo & text"
                value={normalizeAgentInnerGapScale(agentLayer.inner_gap_scale)}
                min={AGENT_INNER_GAP_SCALE_MIN}
                max={AGENT_INNER_GAP_SCALE_MAX}
                step={0.05}
                onChange={(inner_gap_scale) =>
                  updateLayers({ agent: { ...agentLayer, inner_gap_scale } })
                }
              />
              <LayerChoiceControl
                id="social-agent-avatar"
                label="Avatar shape"
                value={normalizeAvatarShape(agentLayer.avatar_shape)}
                options={[
                  { value: "circle", label: "Circle" },
                  { value: "square", label: "Square" },
                ]}
                onChange={(avatar_shape) =>
                  updateLayers({ agent: { ...agentLayer, avatar_shape } })
                }
              />

              <LayerChoiceControl
                id="social-agent-background"
                label="Background"
                value={normalizeAgentBackgroundStyle(
                  agentLayer.background_style,
                )}
                options={[
                  { value: "none", label: "None" },
                  { value: "glass", label: "Frosted" },
                  { value: "brand", label: "Brand" },
                  { value: "custom", label: "Custom" },
                ]}
                onChange={(background_style) =>
                  updateLayers({ agent: { ...agentLayer, background_style } })
                }
              />

              {normalizeAgentBackgroundStyle(agentLayer.background_style) ===
              "brand" ? (
                <LayerChoiceControl
                  id="social-agent-brand-colour"
                  label="Brand colour"
                  value={normalizeAgentBrandColour(agentLayer.brand_colour)}
                  options={[
                    { value: "primary", label: "Primary" },
                    { value: "secondary", label: "Secondary" },
                    { value: "accent", label: "Accent" },
                  ]}
                  onChange={(brand_colour) =>
                    updateLayers({ agent: { ...agentLayer, brand_colour } })
                  }
                />
              ) : null}

              {normalizeAgentBackgroundStyle(agentLayer.background_style) ===
              "custom" ? (
                <LayerColourInput
                  id="social-agent-bg-colour"
                  label="Background colour"
                  value={agentLayer.background_colour}
                  fallback={agency.primary_colour}
                  onChange={(background_colour) =>
                    updateLayers({
                      agent: { ...agentLayer, background_colour },
                    })
                  }
                />
              ) : null}

              <LayerColourInput
                id="social-agent-text-colour"
                label="Text colour"
                value={agentLayer.text_colour}
                fallback={
                  agency.text_colour?.trim() ? agency.text_colour : "#ffffff"
                }
                onChange={(text_colour) =>
                  updateLayers({ agent: { ...agentLayer, text_colour } })
                }
              />

              {normalizeAgentBackgroundStyle(agentLayer.background_style) ===
              "brand" ? (
                <p className="text-xs text-base-content/65">
                  Background uses{" "}
                  <span
                    className="inline-block h-3 w-3 align-middle rounded-sm ring-1 ring-border"
                    style={{
                      backgroundColor: resolveBrandColourKey(
                        agency,
                        normalizeAgentBrandColour(agentLayer.brand_colour),
                      ),
                    }}
                  />{" "}
                  {normalizeAgentBrandColour(agentLayer.brand_colour)} brand
                  colour.
                </p>
              ) : null}
            </FineTune>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setAgentsLoading(true);
              setPickerOpen(true);
            }}
          >
            <Users className="h-4 w-4" />
            Load from team
          </Button>
        )}
      </LayerSection>

      <SocialPostAgentPickerDialog
        open={pickerOpen}
        loading={agentsLoading}
        agencyAgents={agencyAgents}
        selectedAgent={agent}
        onClose={() => setPickerOpen(false)}
        onSelect={loadAgentFromOrg}
      />
    </div>
  );
}

function FineTune({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group/fine border-t border-base-300 pt-1">
      <summary className="flex min-h-11 cursor-pointer [list-style:none] items-center justify-between gap-2 rounded text-sm font-medium text-base-content/70 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          className="size-4 transition-transform group-open/fine:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 pb-2 pt-2">{children}</div>
    </details>
  );
}
