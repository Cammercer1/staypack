import type { ReportCopyFieldPath } from "@/lib/reports/editable/reportCopyPaths";

export function resolveFeatureCopyPath(
  item: string,
  appealPoints: string[],
  supportingFactors: string[],
): ReportCopyFieldPath | null {
  const appealIndex = appealPoints.indexOf(item);
  if (appealIndex >= 0) {
    return `copy.appeal_points.${appealIndex}`;
  }
  const supportingIndex = supportingFactors.indexOf(item);
  if (supportingIndex >= 0) {
    return `copy.supporting_factors.${supportingIndex}`;
  }
  return null;
}
