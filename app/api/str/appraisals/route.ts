import { requireListingAccess } from "@/lib/auth/requireUser";
import { createStrAppraisal, listStrAppraisals, requireStrWorkspaceAccess } from "@/lib/str-appraisals/service";
import { appraisalQuerySchema, createStrAppraisalSchema } from "@/lib/str-appraisals/validation";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireStrWorkspaceAccess();
    const filters = appraisalQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return privateJson(await listStrAppraisals(supabase, agency.id, filters));
  } catch (error) { return strApiError(error); }
}

export async function POST(request: Request) {
  try {
    const body = createStrAppraisalSchema.parse(await request.json());
    const { supabase, agency } = await requireStrWorkspaceAccess();
    const { listing } = await requireListingAccess(body.listing_id);
    const report = await createStrAppraisal({ supabase, agency, listing, requestId: body.request_id, recipient: body.recipient });
    return privateJson({ report });
  } catch (error) { return strApiError(error); }
}
