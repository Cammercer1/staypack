import { requireListingAccess } from "@/lib/auth/requireUser";
import { createBrochureSchema, openOrCreateBrochure } from "@/lib/brochures/workspace";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";
import { requestOriginAllowed } from "@/lib/digital-proposals/requestOrigin";
export async function POST(request: Request) {
  if (!requestOriginAllowed(request)) return privateJson({ error: "Request origin not allowed." }, 403);
  try {
    const body = createBrochureSchema.parse(await request.json());
    const { supabase, listing } = await requireListingAccess(body.listing_id);
    const result = await openOrCreateBrochure(supabase, listing, body.type, body.restore_archived);
    if (result.archived) return privateJson({ error: "This property already has an archived brochure of this type.", code: "brochure_archived" }, 409);
    return privateJson({ id: result.id, path: `/brochures/${result.id}` });
  } catch (error) { return strApiError(error); }
}
