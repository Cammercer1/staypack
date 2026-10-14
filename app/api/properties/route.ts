import { requireAgency } from "@/lib/auth/requireUser";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const search = new URL(request.url).searchParams.get("q")?.trim().slice(0,160) ?? "";
    let query = supabase.from("listings").select("id,property_address,suburb,hero_image_url")
      .eq("agency_id",agency.id).neq("status","archived").order("updated_at",{ascending:false}).limit(20);
    if (search) query = query.ilike("property_address",`%${search.replace(/[%_\\]/g,"\\$&")}%`);
    const { data,error } = await query;
    if (error) throw new Error(error.message);
    return privateJson({ properties:data ?? [] });
  } catch (error) { return strApiError(error); }
}
