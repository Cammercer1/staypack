"use client";

import type { CSSProperties } from "react";
import { ReportCopyTextField } from "@/components/reports/inline/ReportCopyFields";
import { resolveFeatureCopyPath } from "@/lib/reports/templates/shared/reportFeatureCopyPath";

type Props = {
  item: string;
  appealPoints: string[];
  supportingFactors: string[];
  className?: string;
  style?: CSSProperties;
};

export function ReportCopyFeatureBullet({
  item,
  appealPoints,
  supportingFactors,
  className,
  style,
}: Props) {
  const path = resolveFeatureCopyPath(item, appealPoints, supportingFactors);
  if (!path) {
    return <span className={className} style={style}>{item}</span>;
  }

  return (
    <ReportCopyTextField
      text={item}
      path={path}
      className={className}
      style={style}
    />
  );
}
