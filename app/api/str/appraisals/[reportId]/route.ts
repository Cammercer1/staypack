import { requireStrAppraisalAccess } from "@/lib/str-appraisals/service";
import { recipientPayload, updateRecipientSchema } from "@/lib/str-appraisals/validation";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { appraisal, report, listing } = await requireStrAppraisalAccess((await params).reportId);
    return privateJson({ appraisal, report, listing });
  } catch (error) { return strApiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { supabase, agency, appraisal } = await requireStrAppraisalAccess((await params).reportId);
    const body = updateRecipientSchema.parse(await request.json());
    const { data, error } = await supabase.rpc("save_str_appraisal_recipient", {
      p_agency_id: agency.id, p_report_id: appraisal.report_id,
      p_recipient: recipientPayload(body.recipient), p_expected_updated_at: body.expected_updated_at,
    });
    if (error) return privateJson({ error: error.message }, error.code === "PT409" ? 409 : 400);
    return privateJson({ appraisal: data });
  } catch (error) { return strApiError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { supabase, agency, report } = await requireStrAppraisalAccess((await params).reportId);
    const { error } = await supabase.from("reports").update({ status: "archived" }).eq("id", report.id).eq("agency_id", agency.id);
    if (error) throw new Error(error.message);
    return privateJson({ archived: true });
  } catch (error) { return strApiError(error); }
}

export async function POST(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { supabase, agency, report } = await requireStrAppraisalAccess((await params).reportId);
    if (report.status !== "archived") return privateJson({ error: "This appraisal is already active." }, 409);
    // Restoration never silently republishes a previously shared link.
    const status = report.final_report_json ? "generated" : "draft";
    const { error } = await supabase.from("reports").update({ status }).eq("id", report.id).eq("agency_id", agency.id).eq("status", "archived");
    if (error) throw new Error(error.message);
    return privateJson({ restored: true });
  } catch (error) { return strApiError(error); }
}
