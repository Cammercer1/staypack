import { syncBlurbFieldWithVariants } from "@/lib/copy/blurbVariantsQuality";
import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";
import type { FinalReportJson } from "@/lib/types";

export type ReportCopyFieldPath = `copy.${string}`;

type ReportCopy = FinalReportJson["copy"];

export function getReportCopyValueAtPath(
  copy: ReportCopy,
  path: ReportCopyFieldPath,
): string {
  const parts = path.split(".");
  if (parts[0] !== "copy" || parts.length < 2) {
    return "";
  }

  const field = parts[1];
  const index = parts[2];

  if (field === "appeal_points" || field === "property_appeal_points") {
    const key = field === "property_appeal_points" ? "property_appeal_points" : "appeal_points";
    const arr = copy[key as keyof ReportCopy];
    if (!Array.isArray(arr) || index == null) {
      return "";
    }
    const i = Number(index);
    return Number.isFinite(i) ? String(arr[i] ?? "") : "";
  }

  if (field === "supporting_factors" || field === "buyer_checks") {
    const arr = copy[field as keyof ReportCopy];
    if (!Array.isArray(arr) || index == null) {
      return "";
    }
    const i = Number(index);
    return Number.isFinite(i) ? String(arr[i] ?? "") : "";
  }

  const strFields = [
    "heading",
    "sales_pack_heading",
    "blurb",
    "sales_pack_blurb",
    "key_metrics_line",
    "methodology_note",
    "disclaimer",
    "comparable_evidence",
    "comparable_disclaimer",
    "cta",
  ] as const;

  if (strFields.includes(field as (typeof strFields)[number])) {
    const value = copy[field as keyof ReportCopy];
    return typeof value === "string" ? value : "";
  }

  return "";
}

export function setReportCopyValueAtPath(
  copy: ReportCopy,
  path: ReportCopyFieldPath,
  nextValue: string,
  options?: { activeBlurbLength?: BlurbLength },
): ReportCopy {
  const parts = path.split(".");
  if (parts[0] !== "copy" || parts.length < 2) {
    return copy;
  }

  const field = parts[1];
  const index = parts[2];

  if (field === "appeal_points" || field === "property_appeal_points") {
    const key = field === "property_appeal_points" ? "property_appeal_points" : "appeal_points";
    const existing = copy[key as keyof ReportCopy];
    const arr = Array.isArray(existing) ? [...existing] : [];
    if (index == null) {
      return copy;
    }
    const i = Number(index);
    if (!Number.isFinite(i)) {
      return copy;
    }
    arr[i] = nextValue;
    return { ...copy, [key]: arr };
  }

  if (field === "supporting_factors" || field === "buyer_checks") {
    const existing = copy[field as keyof ReportCopy];
    const arr = Array.isArray(existing) ? [...existing] : [];
    if (index == null) {
      return copy;
    }
    const i = Number(index);
    if (!Number.isFinite(i)) {
      return copy;
    }
    arr[i] = nextValue;
    return { ...copy, [field]: arr };
  }

  if (field === "blurb" || field === "sales_pack_blurb") {
    const syncedVariants = syncBlurbFieldWithVariants(
      nextValue,
      copy.blurb_variants,
    );
    const blurb_variants = options?.activeBlurbLength
      ? {
          ...syncedVariants,
          [options.activeBlurbLength]: nextValue,
        }
      : syncedVariants;
    return {
      ...copy,
      [field]: nextValue,
      blurb_variants,
    };
  }

  if (
    field === "heading" ||
    field === "sales_pack_heading" ||
    field === "key_metrics_line" ||
    field === "methodology_note" ||
    field === "disclaimer" ||
    field === "comparable_evidence" ||
    field === "comparable_disclaimer" ||
    field === "cta"
  ) {
    return { ...copy, [field]: nextValue };
  }

  return copy;
}
