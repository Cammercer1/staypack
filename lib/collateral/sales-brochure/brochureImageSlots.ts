import { splitBrochureImages } from "@/lib/collateral/buildSalesBrochureDocument";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import { getBrochureGalleryPhotos } from "@/lib/collateral/templates/sales-brochure/shared/BrochureGalleryPage";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { BrochureImageSlot } from "@/components/collateral/sales-brochure/inline/EditableContext";

function replaceInList(urls: string[], oldUrl: string, newUrl: string) {
  const index = urls.indexOf(oldUrl);
  if (index === -1) {
    return urls;
  }
  const next = [...urls];
  next[index] = newUrl;
  return next;
}

function replaceUrlInProperty(
  property: SalesBrochureDocumentJson["property"],
  oldUrl: string,
  newUrl: string,
) {
  const pageOne = replaceInList(property.page_one_image_urls, oldUrl, newUrl);
  const pageTwo = replaceInList(property.page_two_image_urls, oldUrl, newUrl);
  const selected = replaceInList(property.selected_image_urls, oldUrl, newUrl);
  const hero =
    property.hero_image_url === oldUrl ? newUrl : property.hero_image_url;

  return {
    ...property,
    hero_image_url: hero,
    page_one_image_urls: pageOne,
    page_two_image_urls: pageTwo,
    selected_image_urls: selected,
  };
}

/** Replaces the image at a brochure layout slot with a new URL from the listing pool. */
export function replaceBrochureImageAtSlot(
  document: SalesBrochureDocumentJson,
  slot: BrochureImageSlot,
  newUrl: string,
): SalesBrochureDocumentJson {
  const prop = document.property;

  if (slot === "hero") {
    const pageOne = [...prop.page_one_image_urls];
    if (pageOne.length) {
      pageOne[0] = newUrl;
    } else {
      pageOne.push(newUrl);
    }
    const split = splitBrochureImages([
      newUrl,
      ...pageOne.slice(1),
      ...prop.page_two_image_urls,
      ...prop.selected_image_urls.filter((u) => u !== newUrl),
    ]);
    return {
      ...document,
      property: {
        ...prop,
        ...split,
        hero_image_url: split.hero_image_url,
      },
    };
  }

  if (typeof slot === "object" && slot.kind === "page_one") {
    const pageOne = [...prop.page_one_image_urls];
    while (pageOne.length <= slot.index) {
      pageOne.push("");
    }
    const oldUrl = pageOne[slot.index];
    pageOne[slot.index] = newUrl;
    const merged = [
      ...(slot.index === 0 ? [newUrl] : [pageOne[0] ?? newUrl]),
      ...pageOne.slice(1),
      ...prop.page_two_image_urls,
      ...prop.selected_image_urls,
    ].filter(Boolean);
    const unique = [...new Set(merged)];
    const split = splitBrochureImages(unique);
    return {
      ...document,
      property: {
        ...prop,
        ...split,
        hero_image_url: slot.index === 0 ? newUrl : split.hero_image_url,
      },
    };
  }

  if (typeof slot === "object" && slot.kind === "page_two") {
    const pageTwo = [...prop.page_two_image_urls];
    while (pageTwo.length <= slot.index) {
      pageTwo.push("");
    }
    const oldUrl = pageTwo[slot.index];
    pageTwo[slot.index] = newUrl;
    if (oldUrl) {
      return {
        ...document,
        property: replaceUrlInProperty(
          { ...prop, page_two_image_urls: pageTwo },
          oldUrl,
          newUrl,
        ),
      };
    }
    const split = splitBrochureImages([
      ...prop.page_one_image_urls,
      ...dedupeImageUrls(pageTwo),
      ...prop.selected_image_urls,
    ]);
    return {
      ...document,
      property: { ...prop, ...split },
    };
  }

  if (typeof slot === "object" && slot.kind === "gallery") {
    const gallery = getBrochureGalleryPhotos(document);
    const oldUrl = gallery[slot.index];
    if (!oldUrl) {
      return document;
    }
    return {
      ...document,
      property: replaceUrlInProperty(prop, oldUrl, newUrl),
    };
  }

  return document;
}

export function getBrochureImageUrlAtSlot(
  document: SalesBrochureDocumentJson,
  slot: BrochureImageSlot,
): string {
  const prop = document.property;

  if (slot === "hero") {
    return prop.page_one_image_urls[0] ?? prop.hero_image_url ?? "";
  }

  if (typeof slot === "object" && slot.kind === "page_one") {
    return prop.page_one_image_urls[slot.index] ?? "";
  }

  if (typeof slot === "object" && slot.kind === "page_two") {
    return prop.page_two_image_urls[slot.index] ?? "";
  }

  if (typeof slot === "object" && slot.kind === "gallery") {
    return getBrochureGalleryPhotos(document)[slot.index] ?? "";
  }

  return "";
}
