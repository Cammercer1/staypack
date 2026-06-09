import { z } from "zod";
import { isSelectableStrTemplateId } from "@/lib/reports/templates/ids";

/** Zod schema for outreach/API STR template overrides (detailed variants only). */
export const selectableStrTemplateIdSchema = z.string().refine(
  isSelectableStrTemplateId,
  {
    message:
      "STR template must be a detailed variant (e.g. refined-detailed, haven-properties-str)",
  },
);
