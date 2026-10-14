import { requireListingAccess } from "@/lib/auth/requireUser";
import { createSocialSchema, openOrCreateSocialPosts } from "@/lib/social/workspace";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";
import { requestOriginAllowed } from "@/lib/digital-proposals/requestOrigin";
export async function POST(request: Request) {
  if (!requestOriginAllowed(request)) return privateJson({ error: "Request origin not allowed." }, 403);
  try {
    const body = createSocialSchema.parse(await request.json());
    const { supabase, agency, listing } = await requireListingAccess(body.listing_id);
    const result = await openOrCreateSocialPosts(supabase, agency, listing, body.restore_archived);
    if (result.archived) return privateJson({ error: "This property has an archived social design.", code: "social_archived" }, 409);
    return privateJson({ id: result.id, path: `/social/${result.id}` });
  } catch (error) { return strApiError(error); }
}
