import {
  applyBelleBrandKitToReport,
  BELLE_BRAND,
} from "@/lib/branding/kits/belle";
import type { FinalReportJson } from "@/lib/types";

export {
  applyBelleBrandKitToReport,
  BELLE_BRAND,
};

/** Managed Belle delivery templates only. */
export function isBellePropertyTemplateId(
  templateId: string | null | undefined,
): boolean {
  return Boolean(templateId?.startsWith("belle-property"));
}

export function applyBelleBrandToReport(report: FinalReportJson) {
  return applyBelleBrandKitToReport(report);
}
