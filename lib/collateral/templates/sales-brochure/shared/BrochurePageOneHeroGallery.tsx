"use client";

import { BrochureSlotImage } from "@/components/collateral/sales-brochure/inline/BrochureSlotImage";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";

/** Page-one hero grid for brochure templates (editable image slots in the editor). */
export function BrochurePageOneHeroGallery({
  document,
}: {
  document: BrochureDocumentJson;
}) {
  const urls = document.property.page_one_image_urls.filter(Boolean);
  const hero = urls[0] ?? document.property.hero_image_url ?? "";
  const secondary = urls.slice(1, 4);

  if (!hero && secondary.length === 0) {
    return null;
  }

  const slots = secondary.slice(0, 3);
  const secondaryGridClass =
    slots.length === 1
      ? "grid-cols-1"
      : slots.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {hero ? (
        <BrochureSlotImage
          url={hero}
          slot="hero"
          className="min-h-0 flex-[2]"
          imageWrapperClassName="min-h-0 h-full flex-1"
        />
      ) : null}

      {slots.length > 0 ? (
        <div
          className={`mt-[2px] grid min-h-0 flex-1 gap-[2px] ${secondaryGridClass}`}
        >
          {slots.map((url, index) => (
            <BrochureSlotImage
              key={`${url}-${index}`}
              url={url}
              slot={{ kind: "page_one", index: index + 1 }}
              className="min-h-0 h-full"
              imageWrapperClassName="min-h-0 h-full flex-1"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
