import { z } from "zod";
import type { StrAppraisal, StrAppraisalRow } from "@/lib/str-appraisals/types";
import type { FinalReportJson, Listing } from "@/lib/types";
import { appraisalQuerySchema, createStrAppraisalSchema } from "@/lib/str-appraisals/validation";

export const appraisalKindSchema = z.enum(["str", "lease", "sales"]);
export type WorkspaceAppraisalKind = z.infer<typeof appraisalKindSchema>;
export const appraisalKindLabels = { str: "Short-term rental", lease: "Rental", sales: "Sales" } as const;
export const workspaceQuerySchema = appraisalQuerySchema.extend({ kind: appraisalKindSchema.optional() });
export const createAppraisalSchema = createStrAppraisalSchema.extend({ kind: appraisalKindSchema });
export type AppraisalInputs = { version: 1; listing: Listing };
export type WorkspaceAppraisal = StrAppraisal & {
  kind: WorkspaceAppraisalKind;
  inputs_json: AppraisalInputs | null;
  input_revision: number;
  document_json: FinalReportJson | null;
  document_revision: number | null;
};
export type WorkspaceAppraisalRow = StrAppraisalRow & { kind: WorkspaceAppraisalKind };
export function appraisalPath(id: string, kind: WorkspaceAppraisalKind) {
  return kind === "str" ? `/short-term-rentals/appraisals/${id}` : `/appraisals/${id}`;
}
