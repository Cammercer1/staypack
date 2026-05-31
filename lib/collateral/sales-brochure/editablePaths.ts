import { SALES_BROCHURE_COPY_LIMITS } from "@/lib/collateral/sales-brochure/copyLimits";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";

/** Dot path for copy fields, e.g. `copy.heading` or `copy.property_highlights.2`. */
export type BrochureCopyFieldPath = `copy.${string}`;

export function getMaxLengthForCopyPath(path: BrochureCopyFieldPath): number | undefined {
  const parts = path.split(".");
  if (parts[0] !== "copy" || parts.length < 2) {
    return undefined;
  }

  const field = parts[1];
  const index = parts[2];

  if (field === "property_highlights") {
    if (index != null) {
      const limit = SALES_BROCHURE_COPY_LIMITS[field];
      return "itemMax" in limit ? limit.itemMax : undefined;
    }
    return undefined;
  }

  const limit = SALES_BROCHURE_COPY_LIMITS[field as keyof typeof SALES_BROCHURE_COPY_LIMITS];
  if (limit && "max" in limit) {
    return limit.max;
  }

  return undefined;
}

export function getCopyValueAtPath(
  copy: SalesBrochureCopyJson,
  path: BrochureCopyFieldPath,
): string {
  const parts = path.split(".");
  if (parts[0] !== "copy" || parts.length < 2) {
    return "";
  }

  const field = parts[1] as keyof SalesBrochureCopyJson;
  const index = parts[2];

  if (field === "property_highlights" && index != null) {
    const i = Number(index);
    return Number.isFinite(i) ? (copy.property_highlights[i] ?? "") : "";
  }

  const value = copy[field];
  return typeof value === "string" ? value : "";
}

export function setCopyValueAtPath(
  copy: SalesBrochureCopyJson,
  path: BrochureCopyFieldPath,
  nextValue: string,
): SalesBrochureCopyJson {
  const parts = path.split(".");
  if (parts[0] !== "copy" || parts.length < 2) {
    return copy;
  }

  const field = parts[1] as keyof SalesBrochureCopyJson;
  const index = parts[2];

  if (field === "property_highlights" && index != null) {
    const i = Number(index);
    if (!Number.isFinite(i)) {
      return copy;
    }
    const arr = [...copy.property_highlights];
    arr[i] = nextValue;
    return { ...copy, property_highlights: arr };
  }

  if (field === "heading" || field === "blurb" || field === "inspection_cta" || field === "disclaimer") {
    return { ...copy, [field]: nextValue };
  }

  if (field === "page_two_note") {
    return { ...copy, page_two_note: nextValue };
  }
  if (field === "price_label") {
    return { ...copy, price_label: nextValue };
  }
  if (field === "price_value") {
    return { ...copy, price_value: nextValue };
  }
  if (field === "bond_label") {
    return { ...copy, bond_label: nextValue };
  }
  if (field === "bond_value") {
    return { ...copy, bond_value: nextValue };
  }

  return copy;
}
