import { EditableImage } from "@/components/collateral/sales-brochure/inline/EditableImage";
import {
  brochurePropertyPhotoClassName,
  brochurePropertyPhotoFrameClassName,
} from "@/lib/collateral/sales-brochure/brochureImageFit";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";

/** Page-one hero grid for brochure templates (editable image slots in the editor). */
export function BrochurePageOneHeroGallery({
  document,
}: {
  document: SalesBrochureDocumentJson;
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
        <div
          className={`min-h-0 flex-[2] overflow-hidden ${brochurePropertyPhotoFrameClassName(hero)}`}
        >
          <EditableImage
            slot="hero"
            src={hero}
            className="h-full w-full"
            imgClassName={brochurePropertyPhotoClassName(hero)}
          />
        </div>
      ) : null}

      {slots.length > 0 ? (
        <div
          className={`mt-[2px] grid min-h-0 flex-1 gap-[2px] overflow-hidden ${secondaryGridClass}`}
        >
          {slots.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className={`min-h-0 overflow-hidden ${brochurePropertyPhotoFrameClassName(url)}`}
            >
              <EditableImage
                slot={{ kind: "page_one", index: index + 1 }}
                src={url}
                className="h-full w-full"
                imgClassName={brochurePropertyPhotoClassName(url)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
