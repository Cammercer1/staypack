import { loadAgencyContacts, requireStrWorkspaceAccess } from "@/lib/str-appraisals/service";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireStrWorkspaceAccess();
    const search = new URL(request.url).searchParams.get("q")?.slice(0,160) ?? "";
    return privateJson({ contacts: await loadAgencyContacts(supabase, agency.id, search) });
  } catch (error) { return strApiError(error); }
}
