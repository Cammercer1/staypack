"use client";

import type { CSSProperties } from "react";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import { SocialPostCanvas } from "@/lib/collateral/templates/social/branded/SocialPostCanvas";
import {
  getSocialPostDesignSize,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  variantId: SocialPostVariantId;
  document: SocialPostsDocumentJson;
  fonts: {
    heading_font_family: string;
    body_font_family: string;
    heading_font_file_url: string | null;
    body_font_file_url: string | null;
  };
  measureFonts: {
    headingFontFamily: string;
    bodyFontFamily: string;
  };
  previewStyle: CSSProperties;
};

/** Full-resolution canvas for client-side PNG export (parent holds ref). */
export function SocialPostExportCapture({
  variantId,
  document,
  fonts,
  measureFonts,
  previewStyle,
}: Props) {
  const { width, height } = getSocialPostDesignSize(variantId);

  return (
    <div
      className="overflow-hidden bg-black"
      style={{
        width,
        height,
        ...previewStyle,
      }}
    >
      <BrandFontLoader fonts={fonts} />
      <SocialPostCanvas
        document={document}
        variantId={variantId}
        previewWidth={width}
        previewHeight={height}
        fonts={measureFonts}
      />
    </div>
  );
}
