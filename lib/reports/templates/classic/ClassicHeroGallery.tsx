import { normalizeReaImageUrl } from "@/lib/scraping/rea/normalizeReaImageUrl";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  property: FinalReportJson["property"];
};

export function resolveHeroGalleryImages(property: FinalReportJson["property"]) {
  const hero = property.hero_image_url
    ? normalizeReaImageUrl(property.hero_image_url)
    : null;
  const supporting = property.selected_image_urls
    .filter((url) => url && url !== property.hero_image_url)
    .map(normalizeReaImageUrl);
  const unique = [...new Set([...(hero ? [hero] : []), ...supporting])];

  return {
    hero: unique[0] ?? null,
    secondary: unique.slice(1, 4),
  };
}

export function ClassicHeroGallery({ property }: Props) {
  const { hero, secondary } = resolveHeroGalleryImages(property);

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
        <div className="min-h-0 flex-[2] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      {slots.length > 0 ? (
        <div
          className={`mt-[2px] grid min-h-0 flex-1 gap-[2px] overflow-hidden ${secondaryGridClass}`}
        >
          {slots.map((url) => (
            <div key={url} className="min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
