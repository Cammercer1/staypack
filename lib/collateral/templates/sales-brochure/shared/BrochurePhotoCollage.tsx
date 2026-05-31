"use client";

import { BrochureSlotImage } from "@/components/collateral/sales-brochure/inline/BrochureSlotImage";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import type { ListingImageMetaMap } from "@/lib/types";
import { cn } from "@/lib/utils";

const GAP = "gap-[3px]";

/** Single image frame that fills its grid/flex cell. */
function Frame({
  src,
  className = "",
  galleryIndex,
  listingImageMeta,
}: {
  src: string;
  className?: string;
  galleryIndex: number;
  listingImageMeta?: ListingImageMetaMap;
}) {
  return (
    <BrochureSlotImage
      url={src}
      slot={{ kind: "gallery", index: galleryIndex }}
      listingImageMeta={listingImageMeta}
      className={cn("min-h-0 h-full", className)}
      imageWrapperClassName="min-h-0 h-full flex-1"
    />
  );
}

/**
 * Full-height photo collage that adapts its layout to the number of images
 * supplied (1–6). Designed to fill a `flex-1` / `h-full` region edge-to-edge.
 */
export function BrochurePhotoCollage({
  photos,
  className = "",
  listingImageMeta,
}: {
  photos: string[];
  className?: string;
  listingImageMeta?: ListingImageMetaMap;
}) {
  const imgs = dedupeImageUrls(photos).slice(0, 6);
  if (!imgs.length) return null;

  if (imgs.length === 1) {
    return (
      <div className={`h-full ${className}`}>
        <Frame src={imgs[0]} galleryIndex={0} listingImageMeta={listingImageMeta} />
      </div>
    );
  }

  if (imgs.length === 2) {
    return (
      <div className={`grid h-full grid-rows-2 ${GAP} ${className}`}>
        <Frame src={imgs[0]} galleryIndex={0} listingImageMeta={listingImageMeta} />
        <Frame src={imgs[1]} galleryIndex={1} listingImageMeta={listingImageMeta} />
      </div>
    );
  }

  if (imgs.length === 3) {
    return (
      <div className={`flex h-full flex-col ${GAP} ${className}`}>
        <div className="min-h-0 flex-[1.5]">
          <Frame src={imgs[0]} galleryIndex={0} listingImageMeta={listingImageMeta} />
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-2 ${GAP}`}>
          <Frame src={imgs[1]} galleryIndex={1} listingImageMeta={listingImageMeta} />
          <Frame src={imgs[2]} galleryIndex={2} listingImageMeta={listingImageMeta} />
        </div>
      </div>
    );
  }

  if (imgs.length === 4) {
    return (
      <div className={`flex h-full flex-col ${GAP} ${className}`}>
        <div className="min-h-0 flex-[1.45]">
          <Frame src={imgs[0]} galleryIndex={0} listingImageMeta={listingImageMeta} />
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-3 ${GAP}`}>
          <Frame src={imgs[1]} galleryIndex={1} listingImageMeta={listingImageMeta} />
          <Frame src={imgs[2]} galleryIndex={2} listingImageMeta={listingImageMeta} />
          <Frame src={imgs[3]} galleryIndex={3} listingImageMeta={listingImageMeta} />
        </div>
      </div>
    );
  }

  if (imgs.length === 5) {
    return (
      <div className={`flex h-full flex-col ${GAP} ${className}`}>
        <div className={`grid min-h-0 flex-[1.3] grid-cols-2 ${GAP}`}>
          <Frame src={imgs[0]} galleryIndex={0} listingImageMeta={listingImageMeta} />
          <Frame src={imgs[1]} galleryIndex={1} listingImageMeta={listingImageMeta} />
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-3 ${GAP}`}>
          <Frame src={imgs[2]} galleryIndex={2} listingImageMeta={listingImageMeta} />
          <Frame src={imgs[3]} galleryIndex={3} listingImageMeta={listingImageMeta} />
          <Frame src={imgs[4]} galleryIndex={4} listingImageMeta={listingImageMeta} />
        </div>
      </div>
    );
  }

  // 6 — gallery wall: 2×2 feature with two stacked frames, then a row of three.
  const [feature, b, c, d, e, f] = imgs;
  return (
    <div className={`flex h-full flex-col ${GAP} ${className}`}>
      <div className={`grid min-h-0 flex-[1.6] grid-cols-3 grid-rows-2 ${GAP}`}>
        <Frame
          src={feature}
          className="col-span-2 row-span-2"
          galleryIndex={0}
          listingImageMeta={listingImageMeta}
        />
        <Frame src={b} galleryIndex={1} listingImageMeta={listingImageMeta} />
        <Frame src={c} galleryIndex={2} listingImageMeta={listingImageMeta} />
      </div>
      <div className={`grid min-h-0 flex-1 grid-cols-3 ${GAP}`}>
        <Frame src={d} galleryIndex={3} listingImageMeta={listingImageMeta} />
        <Frame src={e} galleryIndex={4} listingImageMeta={listingImageMeta} />
        <Frame src={f} galleryIndex={5} listingImageMeta={listingImageMeta} />
      </div>
    </div>
  );
}
