import type { ComponentType } from "react";
import type { FinalReportJson } from "@/lib/types";

export type ReportTemplateProps = {
  report: FinalReportJson;
};

export type ReportTemplateDefinition = {
  id: string;
  label: string;
  description: string;
  pages: number;
  Component: ComponentType<ReportTemplateProps>;
};
