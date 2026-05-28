import type { CSSProperties } from "react";
import type {
  SocialPostBackgroundLayout,
  SocialPostVariantState,
} from "@/lib/collateral/templates/types";

export type BackgroundLayoutSpec = {
  id: SocialPostBackgroundLayout;
  label: string;
  description: string;
  cellCount: number;
  gridStyle: Pick<
    CSSProperties,
    "gridTemplateColumns" | "gridTemplateRows" | "gridTemplateAreas"
  >;
};

export const SOCIAL_POST_BACKGROUND_LAYOUTS: BackgroundLayoutSpec[] = [
  {
    id: "single",
    label: "Full",
    description: "One photo fills the frame",
    cellCount: 1,
    gridStyle: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
  },
  {
    id: "split_vertical",
    label: "Top & bottom",
    description: "Two photos stacked",
    cellCount: 2,
    gridStyle: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr" },
  },
  {
    id: "split_horizontal",
    label: "Left & right",
    description: "Two photos side by side",
    cellCount: 2,
    gridStyle: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" },
  },
  {
    id: "grid_2x2",
    label: "2×2",
    description: "Four-photo grid",
    cellCount: 4,
    gridStyle: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" },
  },
  {
    id: "row_3",
    label: "3 across",
    description: "Three columns",
    cellCount: 3,
    gridStyle: { gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr" },
  },
  {
    id: "col_3",
    label: "3 stacked",
    description: "Three rows",
    cellCount: 3,
    gridStyle: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr 1fr" },
  },
];

const LAYOUT_BY_ID = Object.fromEntries(
  SOCIAL_POST_BACKGROUND_LAYOUTS.map((spec) => [spec.id, spec]),
) as Record<SocialPostBackgroundLayout, BackgroundLayoutSpec>;

export function normalizeBackgroundLayout(
  value: string | undefined,
): SocialPostBackgroundLayout {
  if (value && value in LAYOUT_BY_ID) {
    return value as SocialPostBackgroundLayout;
  }
  return "single";
}

export function getBackgroundLayoutSpec(layout: SocialPostBackgroundLayout) {
  return LAYOUT_BY_ID[layout];
}

export function resolveBackgroundImageUrls(options: {
  layout: SocialPostBackgroundLayout;
  urls?: string[];
  pool: string[];
  fallback?: string;
}): string[] {
  const spec = getBackgroundLayoutSpec(options.layout);
  const pool = options.pool.filter(Boolean);
  const fallback = options.fallback ?? pool[0] ?? "";
  const source = (options.urls ?? []).filter(Boolean);
  const cycle = pool.length ? pool : source.length ? source : fallback ? [fallback] : [];

  return Array.from({ length: spec.cellCount }, (_, index) => {
    return (
      source[index] ??
      (cycle.length ? cycle[index % cycle.length] : "") ??
      fallback
    );
  });
}

export function migrateVariantBackground(
  variant: SocialPostVariantState,
  imagePool: string[],
): SocialPostVariantState {
  const layout = normalizeBackgroundLayout(variant.background_layout);
  const pool = imagePool.filter(Boolean);
  const fallback =
    variant.background_image_url ||
    variant.background_image_urls?.[0] ||
    pool[0] ||
    "";
  const existing =
    variant.background_image_urls?.filter(Boolean) ??
    (variant.background_image_url ? [variant.background_image_url] : []);

  const urls = resolveBackgroundImageUrls({
    layout,
    urls: existing,
    pool: pool.length ? pool : existing,
    fallback,
  });

  return {
    ...variant,
    background_layout: layout,
    background_image_urls: urls,
    background_image_url: urls[0] ?? "",
  };
}

export function imagePoolFromDocument(options: {
  listingHeroUrl?: string;
  variants: SocialPostVariantState[];
  galleryUrls?: string[];
}): string[] {
  const fromGallery = options.galleryUrls ?? [];
  const fromVariants = options.variants.flatMap((variant) =>
    variant.background_image_urls?.length
      ? variant.background_image_urls
      : variant.background_image_url
        ? [variant.background_image_url]
        : [],
  );
  const hero = options.listingHeroUrl ? [options.listingHeroUrl] : [];

  return [...new Set([...fromGallery, ...hero, ...fromVariants].filter(Boolean))];
}

export function patchVariantBackground(
  variant: SocialPostVariantState,
  patch: {
    layout?: SocialPostBackgroundLayout;
    urls?: string[];
    slotIndex?: number;
    slotUrl?: string;
  },
  imagePool: string[],
): SocialPostVariantState {
  const layout = normalizeBackgroundLayout(
    patch.layout ?? variant.background_layout,
  );
  let urls =
    patch.urls ??
    variant.background_image_urls ??
    (variant.background_image_url ? [variant.background_image_url] : []);

  if (patch.slotIndex != null && patch.slotUrl != null) {
    const next = resolveBackgroundImageUrls({
      layout,
      urls,
      pool: imagePool,
      fallback: patch.slotUrl,
    });
    next[patch.slotIndex] = patch.slotUrl;
    urls = resolveBackgroundImageUrls({
      layout,
      urls: next,
      pool: imagePool,
      fallback: patch.slotUrl,
    });
  } else if (patch.layout) {
    urls = resolveBackgroundImageUrls({
      layout,
      urls,
      pool: imagePool,
      fallback: urls[0] ?? imagePool[0] ?? "",
    });
  }

  return migrateVariantBackground(
    {
      ...variant,
      background_layout: layout,
      background_image_urls: urls,
    },
    imagePool,
  );
}
