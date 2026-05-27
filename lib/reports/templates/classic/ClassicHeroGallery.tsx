import type { FinalReportJson } from "@/lib/types";

type Props = {
  property: FinalReportJson["property"];
};

export function resolveHeroGalleryImages(property: FinalReportJson["property"]) {
  const hero = property.hero_image_url || null;
  const supporting = property.selected_image_urls.filter(
    (url) => url && url !== hero,
  );
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
    <div className="bg-white">
      {hero ? (
        <div className="w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero}
            alt=""
            className="aspect-[2.35/1] w-full object-cover"
          />
        </div>
      ) : null}

      {slots.length > 0 ? (
        <div className={`mt-[2px] grid gap-[2px] ${secondaryGridClass}`}>
          {slots.map((url) => (
            <div key={url} className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
