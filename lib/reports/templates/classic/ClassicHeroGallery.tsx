import { ReportEditableImage } from "@/components/reports/inline/ReportEditableImage";
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
  const hasSecondary = slots.length > 0;

  return (
    <div
      className={`grid h-full min-h-0 bg-white ${
        hasSecondary ? "grid-rows-[1.65fr_1fr]" : "grid-rows-1"
      }`}
    >
      {hero ? (
        <div className="min-h-0 overflow-hidden">
          <ReportEditableImage
            slot="hero"
            src={hero}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        </div>
      ) : null}

      {hasSecondary ? (
        <div
          className={`mt-[2px] grid min-h-[28mm] gap-[2px] overflow-hidden ${secondaryGridClass}`}
        >
          {slots.map((url, index) => (
            <div key={`gallery-secondary-${index}`} className="min-h-0 overflow-hidden">
              <ReportEditableImage
                slot={{ kind: "secondary", index }}
                src={url}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
