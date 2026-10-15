import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";
import { CalculatorReportError, createReportFromCalculatorLead } from "@/lib/str-calculator/leadReport";

// A new draft reuses its calculator result and fetches property evidence and market history.
export const maxDuration = 90;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { agency, user } = await requireAgency();
    const leadId = z.uuid().parse((await params).id);
    return privateJson(await createReportFromCalculatorLead({ leadId, agency, userId: user.id }));
  } catch (error) {
    if (error instanceof CalculatorReportError) return privateJson({ error: error.message }, error.status);
    return strApiError(error);
  }
}
