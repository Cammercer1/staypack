import type { ComponentType } from "react";
import type { FinalReportJson } from "@/lib/types";

export type ReportTemplateProps = {
  report: FinalReportJson;
};

export type ReportTemplateTier = "light" | "detailed";

export type ReportTemplateDefinition = {
  id: string;
  family: string;
  tier: ReportTemplateTier;
  label: string;
  description: string;
  pages: number;
  sourcePath: string;
  Component: ComponentType<ReportTemplateProps>;
};
