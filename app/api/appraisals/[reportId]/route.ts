import { proposalRequest, proposalApiError, sameOrigin } from "@/lib/digital-proposals/http";
import { requireAppraisalAccess } from "@/lib/appraisals/workspace";
import { recipientPayload, updateRecipientSchema } from "@/lib/str-appraisals/validation";
import { privateJson } from "@/lib/str-appraisals/api";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { appraisal, report, workingListing: listing } = await requireAppraisalAccess((await params).reportId);
    return privateJson({ appraisal, report, workingListing: listing });
  } catch (error) { return proposalApiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { supabase, agency, appraisal } = await requireAppraisalAccess((await params).reportId);
    const body = updateRecipientSchema.parse(await proposalRequest(request));
    const { data, error } = await supabase.rpc("save_str_appraisal_recipient", {
      p_agency_id: agency.id, p_report_id: appraisal.report_id,
      p_recipient: recipientPayload(body.recipient), p_expected_updated_at: body.expected_updated_at,
    });
    if (error) return privateJson({ error: error.message }, error.code === "PT409" ? 409 : 400);
    return privateJson({ appraisal: data });
  } catch (error) { return proposalApiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    sameOrigin(request);
    const { supabase, agency, report } = await requireAppraisalAccess((await params).reportId);
    const { error } = await supabase.from("reports").update({ status: "archived" }).eq("id", report.id).eq("agency_id", agency.id);
    if (error) throw new Error(error.message);
    return privateJson({ archived: true });
  } catch (error) { return proposalApiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    sameOrigin(request);
    const { supabase, agency, report } = await requireAppraisalAccess((await params).reportId);
    if (report.status !== "archived") return privateJson({ error: "This appraisal is already active." }, 409);
    // Restoration never silently republishes a previously shared link.
    const status = report.final_report_json ? "generated" : "draft";
    const { error } = await supabase.from("reports").update({ status }).eq("id", report.id).eq("agency_id", agency.id).eq("status", "archived");
    if (error) throw new Error(error.message);
    return privateJson({ restored: true });
  } catch (error) { return proposalApiError(error); }
}
