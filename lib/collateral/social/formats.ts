import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

export const SOCIAL_POST_VARIANT_IDS = ["square", "wide", "story"] as const;

export type SocialPostVariantId = (typeof SOCIAL_POST_VARIANT_IDS)[number];

export type SocialPostFormat = {
  id: SocialPostVariantId;
  label: string;
  description: string;
  widthPx: number;
  heightPx: number;
};

export const SOCIAL_POST_FORMATS: Record<SocialPostVariantId, SocialPostFormat> = {
  square: {
    id: "square",
    label: "Square",
    description: "Instagram, Facebook & LinkedIn feed posts",
    widthPx: 1080,
    heightPx: 1080,
  },
  wide: {
    id: "wide",
    label: "Wide",
    description: "Facebook & LinkedIn link posts",
    widthPx: 1200,
    heightPx: 630,
  },
  story: {
    id: "story",
    label: "Story",
    description: "Instagram, Facebook & LinkedIn stories",
    widthPx: 1080,
    heightPx: 1920,
  },
};

/** Legacy 6-variant ids → canonical format. */
const LEGACY_VARIANT_MAP: Record<string, SocialPostVariantId> = {
  instagram_post: "square",
  instagram_story: "story",
  facebook_post: "wide",
  facebook_story: "story",
  linkedin_post: "wide",
  linkedin_story: "story",
};

/** Prefer earlier sources when merging saved layouts. */
const VARIANT_MIGRATION_SOURCES: Record<
  SocialPostVariantId,
  readonly string[]
> = {
  square: ["square", "instagram_post"],
  wide: ["wide", "facebook_post", "linkedin_post"],
  story: ["story", "instagram_story", "facebook_story", "linkedin_story"],
};

export function isSocialPostVariantId(
  value: string,
): value is SocialPostVariantId {
  return (SOCIAL_POST_VARIANT_IDS as readonly string[]).includes(value);
}

export function normalizeSocialPostVariantId(
  value: string | undefined,
): SocialPostVariantId {
  if (value && isSocialPostVariantId(value)) {
    return value;
  }
  if (value && value in LEGACY_VARIANT_MAP) {
    return LEGACY_VARIANT_MAP[value];
  }
  return "square";
}

export function migrateSocialPostVariants(
  document: SocialPostsDocumentJson,
): SocialPostsDocumentJson {
  const activeVariantId = normalizeSocialPostVariantId(
    document.active_variant_id,
  );
  const oldVariants = document.variants as Record<
    string,
    SocialPostsDocumentJson["variants"][SocialPostVariantId]
  >;

  const variants = SOCIAL_POST_VARIANT_IDS.reduce(
    (acc, variantId) => {
      for (const key of VARIANT_MIGRATION_SOURCES[variantId]) {
        const state = oldVariants[key];
        if (state) {
          acc[variantId] = state;
          return acc;
        }
      }
      acc[variantId] = oldVariants[variantId] ?? {
        background_image_url: "",
      };
      return acc;
    },
    {} as SocialPostsDocumentJson["variants"],
  );

  const exports = document.exports
    ? SOCIAL_POST_VARIANT_IDS.reduce(
        (acc, variantId) => {
          for (const key of VARIANT_MIGRATION_SOURCES[variantId]) {
            const entry = document.exports?.[key as keyof typeof document.exports];
            if (entry) {
              acc[variantId] = entry;
              return acc;
            }
          }
          const direct = document.exports?.[variantId];
          if (direct) acc[variantId] = direct;
          return acc;
        },
        {} as NonNullable<SocialPostsDocumentJson["exports"]>,
      )
    : undefined;

  return {
    ...document,
    active_variant_id: activeVariantId,
    variants,
    exports,
  };
}

export function getSocialPostFormat(variantId: SocialPostVariantId) {
  return SOCIAL_POST_FORMATS[variantId];
}

/** Native export pixel size — editor layout always uses these dimensions. */
export function getSocialPostDesignSize(variantId: SocialPostVariantId) {
  const format = getSocialPostFormat(variantId);
  return { width: format.widthPx, height: format.heightPx };
}

export function getDefaultSocialPostVariantId(): SocialPostVariantId {
  return "square";
}

export type SocialPostPreviewDevice = "phone" | "feed-card" | "canvas";

export function getSocialPostPreviewDevice(
  variantId: SocialPostVariantId,
): SocialPostPreviewDevice {
  if (variantId === "story") return "phone";
  if (variantId === "wide") return "feed-card";
  return "canvas";
}

/** Total mockup size used to fit the editor preview in the viewport. */
export function getSocialPostPreviewFrameSize(
  variantId: SocialPostVariantId,
  canvasWidth: number,
  canvasHeight: number,
) {
  const device = getSocialPostPreviewDevice(variantId);

  if (device === "feed-card") {
    return { width: canvasWidth, height: canvasHeight + 48 };
  }

  if (device === "canvas") {
    return { width: canvasWidth, height: canvasHeight };
  }

  const bezel = 10;
  return {
    width: canvasWidth + bezel * 2,
    height: canvasHeight + bezel * 2 + 20,
  };
}

/** Scaled editor preview size that respects each format's aspect ratio. */
export function getSocialPostPreviewSize(
  variantId: SocialPostVariantId,
  options?: { maxHeight?: number; maxWidth?: number },
) {
  const format = getSocialPostFormat(variantId);
  const maxHeight = options?.maxHeight ?? 580;
  const maxWidth = options?.maxWidth ?? 380;

  const scale = Math.min(
    maxWidth / format.widthPx,
    maxHeight / format.heightPx,
  );

  return {
    width: Math.round(format.widthPx * scale),
    height: Math.round(format.heightPx * scale),
    scale,
  };
}

/** Extra space around the canvas inside the editor device mockup. */
export function getSocialPostPreviewChrome(
  variantId: SocialPostVariantId,
  canvasWidth: number,
  canvasHeight: number,
) {
  const frame = getSocialPostPreviewFrameSize(
    variantId,
    canvasWidth,
    canvasHeight,
  );
  return {
    width: Math.max(0, frame.width - canvasWidth),
    height: Math.max(0, frame.height - canvasHeight),
  };
}
