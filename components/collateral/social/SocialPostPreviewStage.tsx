"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import { SocialPostDeviceFrame } from "@/components/collateral/social/SocialPostDeviceFrame";
import { SocialPostFormatPicker } from "@/components/collateral/social/SocialPostFormatPicker";
import { SocialPostCanvas } from "@/lib/collateral/templates/social/branded/SocialPostCanvas";
import {
  getSocialPostDesignSize,
  getSocialPostPreviewFrameSize,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  document: SocialPostsDocumentJson;
  activeVariantId: SocialPostVariantId;
  previewStyle: CSSProperties;
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
  onVariantChange: (variantId: SocialPostVariantId) => void;
};

export function SocialPostPreviewStage({
  document,
  activeVariantId,
  previewStyle,
  fonts,
  measureFonts,
  onVariantChange,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 400, height: 600 });

  const designSize = useMemo(
    () => getSocialPostDesignSize(activeVariantId),
    [activeVariantId],
  );

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const update = () => {
      setViewportSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const frameSize = useMemo(
    () =>
      getSocialPostPreviewFrameSize(
        activeVariantId,
        designSize.width,
        designSize.height,
      ),
    [activeVariantId, designSize.height, designSize.width],
  );

  const fitScale = useMemo(() => {
    const pad = 32;
    const availableWidth = Math.max(1, viewportSize.width - pad);
    const availableHeight = Math.max(1, viewportSize.height - pad);
    return Math.min(
      1,
      availableWidth / frameSize.width,
      availableHeight / frameSize.height,
    );
  }, [frameSize.height, frameSize.width, viewportSize]);

  const layoutWidth = Math.round(frameSize.width * fitScale);
  const layoutHeight = Math.round(frameSize.height * fitScale);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/50 px-4 py-3">
        <SocialPostFormatPicker
          activeVariantId={activeVariantId}
          onVariantChange={onVariantChange}
        />
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/25 p-4 sm:p-6"
        style={previewStyle}
      >
        <BrandFontLoader fonts={fonts} />

        <div
          className="relative shrink-0"
          style={{ width: layoutWidth, height: layoutHeight }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left transition-transform duration-200 ease-out"
            style={{
              width: frameSize.width,
              height: frameSize.height,
              transform: `scale(${fitScale})`,
            }}
          >
            <SocialPostDeviceFrame
              variantId={activeVariantId}
              previewWidth={designSize.width}
              previewHeight={designSize.height}
              showDimensions={false}
              editor
            >
              <SocialPostCanvas
                document={document}
                variantId={activeVariantId}
                previewWidth={designSize.width}
                previewHeight={designSize.height}
                fonts={measureFonts}
              />
            </SocialPostDeviceFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
