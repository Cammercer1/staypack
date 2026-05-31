import { isBrochureFloorPlanUrl } from "@/lib/collateral/sales-brochure/brochureImageFit";
import type { FinalReportJson } from "@/lib/types";
import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { BrochureClosingBand } from "@/lib/collateral/templates/sales-brochure/shared/BrochureClosingBand";
import { BrochurePhotoCollage } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePhotoCollage";

const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

/**
 * Gallery photo pool — page-two images first, then any unused page-one /
 * selected photos, with floor-plans and the page-one hero excluded, deduped.
 */
export function getBrochureGalleryPhotos(
  document: SalesBrochureDocumentJson,
): string[] {
  const hero = document.property.page_one_image_urls[0];
  return [
    ...document.property.page_two_image_urls,
    ...document.property.page_one_image_urls.slice(1),
    ...document.property.selected_image_urls,
  ]
    .filter(Boolean)
    .filter((url) => !isBrochureFloorPlanUrl(url) && url !== hero)
    .filter((url, i, arr) => arr.indexOf(url) === i);
}

function GalleryNote({ text }: { text: string }) {
  return (
    <div className="shrink-0 px-10 pt-5">
      <Editable
        as="p"
        path="copy.page_two_note"
        className="text-[0.8rem] leading-relaxed text-neutral-700"
        style={{ fontFamily: bodyFont }}
      >
        {text}
      </Editable>
    </div>
  );
}

/**
 * Standardised "visual feasting" page two — a dynamic photo collage that fills
 * the page, an optional user-authored note, and an agent contact + QR close.
 * Render inside a page shell / fixed-height flex column.
 */
export function BrochureGalleryPage({
  document,
  report,
  photos,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
  photos?: string[];
}) {
  const gallery = photos ?? getBrochureGalleryPhotos(document);
  const note = document.copy.page_two_note?.trim();

  return (
    <>
      <BrochurePhotoCollage photos={gallery} className="min-h-0 flex-1" />
      {note ? <GalleryNote text={note} /> : null}
      <BrochureClosingBand document={document} report={report} />
    </>
  );
}
