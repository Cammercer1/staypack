"use client";

import { useMemo } from "react";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import { getSocialPostFormat } from "@/lib/collateral/social/formats";
import {
  getAgentBlockDimensions,
  normalizeAgentLayout,
  normalizeAvatarShape,
} from "@/lib/collateral/social/agentLayer";
import { resolveAgentBlockStyle } from "@/lib/collateral/social/agentStyle";
import {
  normalizeAgentPlacement,
  normalizeCorner,
} from "@/lib/collateral/social/presetPlacement";
import {
  normalizeAgentScale,
  normalizeLogoScale,
  normalizeTextAlign,
} from "@/lib/collateral/social/layerScale";
import { computePresetLayout } from "@/lib/collateral/social/presetPlacement";
import type { SocialPostLayerLayoutFonts } from "@/lib/collateral/social/socialPostLayerLayout";
import { resolveSocialPostLogoPresentation } from "@/lib/collateral/social/logoColour";
import {
  formatListingFeaturesLine,
  getSocialPostFeaturesFontSize,
} from "@/lib/collateral/social/listingFeatures";
import { getSocialPostTextFontSize } from "@/lib/collateral/social/socialPostTextLayerBox";
import { getLayersForVariant } from "@/lib/collateral/social/variantLayers";
import { SocialPostBackground } from "@/components/collateral/social/SocialPostBackground";
import { SocialPostAgentBlock } from "@/components/collateral/social/SocialPostAgentBlock";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  document: SocialPostsDocumentJson;
  variantId: SocialPostVariantId;
  previewWidth: number;
  previewHeight: number;
  fonts?: SocialPostLayerLayoutFonts;
};

export function SocialPostCanvas({
  document,
  variantId,
  previewWidth,
  previewHeight,
  fonts,
}: Props) {
  const format = getSocialPostFormat(variantId);
  const variant = document.variants[variantId];
  const { agency, agent } = document;
  const layers = useMemo(
    () => getLayersForVariant(document, variantId),
    [document, variantId],
  );
  const agentLayer = layers.agent;

  const featuresLine = useMemo(
    () =>
      layers.features.enabled
        ? formatListingFeaturesLine(document.listing, layers.features)
        : "",
    [document.listing, layers.features],
  );

  const textCorner = normalizeCorner(layers.title.block_placement, "bottom_left");
  const hasText =
    layers.title.enabled ||
    (layers.subcopy.enabled && layers.subcopy.text.trim()) ||
    Boolean(featuresLine);
  const textAtTop = hasText && textCorner.startsWith("top");
  const textAtBottom = hasText && textCorner.startsWith("bottom");
  const showTopScrim = textAtTop;
  const showBottomScrim = Boolean(agentLayer?.enabled) || textAtBottom;

  const layout = useMemo(
    () =>
      computePresetLayout({
        layers,
        listing: document.listing,
        variantId,
        canvasWidth: previewWidth,
        canvasHeight: previewHeight,
        logoUrl: agency.logo_url,
        agent,
        fonts,
      }),
    [
      agent,
      agency.logo_url,
      document.listing,
      fonts,
      layers,
      previewHeight,
      previewWidth,
      variantId,
    ],
  );

  const titleFontSize = useMemo(() => {
    if (!layers.title.enabled) return 10;
    return getSocialPostTextFontSize({
      kind: "title",
      layer: layers.title,
      variantId,
    });
  }, [layers.title, variantId]);

  const subcopyFontSize = useMemo(() => {
    if (!layers.subcopy.enabled) return 8;
    return getSocialPostTextFontSize({
      kind: "subcopy",
      layer: layers.subcopy,
      variantId,
    });
  }, [layers.subcopy, variantId]);

  const featuresFontSize = useMemo(() => {
    if (!layers.features.enabled || !featuresLine) return 8;
    return getSocialPostFeaturesFontSize({
      layer: layers.features,
      variantId,
    });
  }, [featuresLine, layers.features, variantId]);

  const agentBlockMetrics = useMemo(() => {
    if (!agentLayer?.enabled) {
      return { avatarSize: 0, innerGapPx: 0 };
    }
    return getAgentBlockDimensions(
      normalizeAgentLayout(agentLayer.layout),
      normalizeAgentScale(agentLayer.scale),
      previewWidth,
      agent,
      variantId,
      agentLayer.inner_gap_scale,
    );
  }, [agent, agentLayer, previewWidth, variantId]);

  const logoPresentation = useMemo(() => {
    const placementEndsRight = normalizeCorner(layers.logo.placement).endsWith(
      "_right",
    );
    return resolveSocialPostLogoPresentation({
      colour: layers.logo.colour,
      primaryColour: agency.primary_colour,
      placementEndsRight,
    });
  }, [agency.primary_colour, layers.logo.colour, layers.logo.placement]);

  return (
    <div
      data-social-canvas
      className="relative overflow-hidden bg-black"
      style={{ width: previewWidth, height: previewHeight }}
    >
      <SocialPostBackground
        layout={variant?.background_layout}
        imageUrls={variant?.background_image_urls}
        imageUrl={variant?.background_image_url}
      />

      {showTopScrim ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[45%]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)",
          }}
        />
      ) : null}

      {showBottomScrim ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[45%]"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)",
          }}
        />
      ) : null}

      {layout.copyBlock?.title && layers.title.enabled ? (
        <p
          className="pointer-events-none absolute z-10 break-words font-bold leading-tight text-white drop-shadow-md"
          style={{
            left: layout.copyBlock.title.left,
            top: layout.copyBlock.title.top,
            width: layout.copyBlock.title.width,
            fontSize: titleFontSize,
            fontFamily: "var(--collateral-heading-font)",
            textAlign: normalizeTextAlign(layers.title.align),
          }}
        >
          {layers.title.text}
        </p>
      ) : null}

      {layout.copyBlock?.subcopy && layers.subcopy.enabled ? (
        <p
          className="pointer-events-none absolute z-10 break-words leading-snug text-white/95 drop-shadow-md"
          style={{
            left: layout.copyBlock.subcopy.left,
            top: layout.copyBlock.subcopy.top,
            width: layout.copyBlock.subcopy.width,
            fontSize: subcopyFontSize,
            fontFamily: "var(--collateral-body-font)",
            textAlign: normalizeTextAlign(layers.subcopy.align),
          }}
        >
          {layers.subcopy.text}
        </p>
      ) : null}

      {layout.copyBlock?.features && featuresLine ? (
        <p
          className="pointer-events-none absolute z-10 break-words font-medium leading-snug text-white/90 drop-shadow-md"
          style={{
            left: layout.copyBlock.features.left,
            top: layout.copyBlock.features.top,
            width: layout.copyBlock.features.width,
            fontSize: featuresFontSize,
            fontFamily: "var(--collateral-body-font)",
            textAlign: normalizeTextAlign(layers.title.align),
          }}
        >
          {featuresLine}
        </p>
      ) : null}

      {layout.agent && agentLayer?.enabled ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: layout.agent.left,
            top: layout.agent.top,
            width: layout.agent.width,
            height: layout.agent.height,
          }}
        >
              <SocialPostAgentBlock
                agent={agent}
                placement={normalizeAgentPlacement(
                  agentLayer.placement,
                  "bottom_left",
                )}
                layout={normalizeAgentLayout(agentLayer.layout)}
                avatarShape={normalizeAvatarShape(agentLayer.avatar_shape)}
                avatarSize={agentBlockMetrics.avatarSize}
                innerGapPx={agentBlockMetrics.innerGapPx}
                variantId={variantId}
                primaryColour={agency.primary_colour}
                blockStyle={resolveAgentBlockStyle(agency, agentLayer)}
              />
        </div>
      ) : null}

      {layout.logo && layers.logo.enabled && agency.logo_url ? (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: layout.logo.left,
            top: layout.logo.top,
            width: layout.logo.width,
            height: layout.logo.height,
          }}
        >
          {logoPresentation.mode === "mask" ? (
            <div
              className="h-full w-full drop-shadow-md"
              role="img"
              aria-label={agency.name}
              style={{
                backgroundColor: logoPresentation.backgroundColour,
                WebkitMaskImage: `url(${agency.logo_url})`,
                maskImage: `url(${agency.logo_url})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: logoPresentation.maskPosition,
                maskPosition: logoPresentation.maskPosition,
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agency.logo_url}
              alt={agency.name}
              className={`h-full w-full object-contain drop-shadow-md ${
                normalizeCorner(layers.logo.placement).endsWith("_right")
                  ? "object-right-top"
                  : "object-left-top"
              }`}
              style={logoPresentation.imageStyle}
              draggable={false}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
