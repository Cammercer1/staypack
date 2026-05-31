"use client";

import { cn } from "@/lib/utils";
import { resolveBrochureImagePresentation } from "@/lib/collateral/sales-brochure/brochureImageFit";
import { getListingImageMeta } from "@/lib/listings/listingImageMeta";
import { EditableImage } from "@/components/collateral/sales-brochure/inline/EditableImage";
import { useBrochureListingImageMeta } from "@/components/collateral/sales-brochure/inline/BrochureImageMetaContext";
import type { BrochureImageSlot } from "@/components/collateral/sales-brochure/inline/EditableContext";
import type { ListingImageMetaMap } from "@/lib/types";

const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

type Props = {
  url: string;
  slot?: BrochureImageSlot;
  className?: string;
  frameClassName?: string;
  imageWrapperClassName?: string;
  showCaption?: boolean;
  /** Overrides context (e.g. document snapshot) when provided. */
  listingImageMeta?: ListingImageMetaMap | null;
};

export function BrochureSlotImage({
  url,
  slot,
  className,
  frameClassName,
  imageWrapperClassName = "min-h-0 flex-1",
  showCaption = true,
  listingImageMeta: metaOverride,
}: Props) {
  const contextMeta = useBrochureListingImageMeta();
  const listingImageMeta = metaOverride ?? contextMeta;
  const presentation = resolveBrochureImagePresentation(
    url,
    getListingImageMeta(listingImageMeta, url),
    listingImageMeta,
  );
  const isFloorPlan = presentation.role === "floor_plan";

  const imageNode = slot ? (
    <EditableImage
      slot={slot}
      src={url}
      className={cn(
        isFloorPlan ? "flex h-full w-full items-center justify-center" : "h-full w-full",
      )}
      imgClassName={presentation.imgClassName}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={presentation.imgClassName} />
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        presentation.frameClassName,
        frameClassName,
        className,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 w-full",
          isFloorPlan && "items-center justify-center",
          imageWrapperClassName,
        )}
      >
        {imageNode}
      </div>
      {showCaption && presentation.caption ? (
        <p
          className="shrink-0 px-2 py-1 text-center text-[0.6rem] font-medium uppercase tracking-wide text-neutral-600"
          style={{ fontFamily: bodyFont }}
        >
          {presentation.caption}
        </p>
      ) : null}
    </div>
  );
}
