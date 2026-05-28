"use client";

import {
  getBackgroundLayoutSpec,
  normalizeBackgroundLayout,
  resolveBackgroundImageUrls,
} from "@/lib/collateral/social/backgroundLayout";
import type { SocialPostBackgroundLayout } from "@/lib/collateral/templates/types";

type Props = {
  layout: SocialPostBackgroundLayout | string | undefined;
  imageUrls?: string[];
  /** @deprecated Use imageUrls */
  imageUrl?: string;
  gapPx?: number;
};

function BackgroundCell({ url }: { url: string }) {
  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

export function SocialPostBackground({
  layout: layoutInput,
  imageUrls,
  imageUrl,
  gapPx = 3,
}: Props) {
  const layout = normalizeBackgroundLayout(layoutInput);
  const spec = getBackgroundLayoutSpec(layout);
  const pool = imageUrls?.length
    ? imageUrls
    : imageUrl
      ? [imageUrl]
      : [];
  const urls = resolveBackgroundImageUrls({
    layout,
    urls: imageUrls,
    pool,
    fallback: imageUrl ?? "",
  });

  if (!urls.some(Boolean)) {
    return <div className="absolute inset-0 bg-muted" />;
  }

  if (layout === "single" && urls[0]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls[0]}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 grid h-full w-full bg-black"
      style={{
        gap: gapPx,
        gridTemplateColumns: spec.gridStyle.gridTemplateColumns,
        gridTemplateRows: spec.gridStyle.gridTemplateRows,
      }}
    >
      {urls.map((url, index) =>
        url ? (
          <BackgroundCell key={`${index}-${url}`} url={url} />
        ) : (
          <div key={index} className="min-h-0 bg-muted" />
        ),
      )}
    </div>
  );
}
