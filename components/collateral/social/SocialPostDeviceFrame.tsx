"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  getSocialPostFormat,
  getSocialPostPreviewDevice,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";

type Props = {
  variantId: SocialPostVariantId;
  previewWidth: number;
  previewHeight: number;
  children: ReactNode;
  animate?: boolean;
  showDimensions?: boolean;
  /** Editor uses full design pixels; skip width caps that clip the canvas. */
  editor?: boolean;
};

export function SocialPostDeviceFrame({
  variantId,
  previewWidth,
  previewHeight,
  children,
  animate = false,
  showDimensions = true,
  editor = false,
}: Props) {
  const format = getSocialPostFormat(variantId);
  const device = getSocialPostPreviewDevice(variantId);
  const transition = animate
    ? "transition-[width,height] duration-300 ease-out"
    : "";

  if (device === "canvas") {
    return (
      <div className={cn("mx-auto", transition)}>
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-border/50 bg-black shadow-lg ring-1 ring-black/10",
            transition,
          )}
          style={{ width: previewWidth, height: previewHeight }}
        >
          {children}
        </div>
        {showDimensions ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {format.widthPx}×{format.heightPx}px
          </p>
        ) : null}
      </div>
    );
  }

  if (device === "feed-card") {
    return (
      <div
        className={cn("mx-auto w-full", !editor && "max-w-md", transition)}
      >
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-muted" />
            <div className="h-2 w-20 rounded bg-muted" />
          </div>
          <div
            className={cn("relative overflow-hidden bg-black", transition)}
            style={{ width: previewWidth, height: previewHeight }}
          >
            {children}
          </div>
        </div>
        {showDimensions ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {format.widthPx}×{format.heightPx}px
          </p>
        ) : null}
      </div>
    );
  }

  const bezel = 10;
  const frameWidth = previewWidth + bezel * 2;
  const frameHeight = previewHeight + bezel * 2 + 20;

  return (
    <div className={cn("mx-auto flex flex-col items-center", transition)}>
      <div
        className={cn(
          "relative rounded-[1.75rem] bg-zinc-900/95 p-1.5 shadow-xl ring-1 ring-white/10",
          transition,
        )}
        style={{ width: frameWidth, height: frameHeight }}
      >
        <div className="absolute left-1/2 top-2 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-700" />
        <div
          className={cn(
            "relative overflow-hidden rounded-[1.35rem] bg-black",
            transition,
          )}
          style={{
            width: previewWidth,
            height: previewHeight,
            margin: `${bezel}px auto 0`,
          }}
        >
          {children}
        </div>
      </div>
      {showDimensions ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {format.widthPx}×{format.heightPx}px
        </p>
      ) : null}
    </div>
  );
}
