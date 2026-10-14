import { requireAgency } from "@/lib/auth/requireUser";
import { calculatorSettingsSchema } from "@/lib/str-calculator/schema";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";

export async function PUT(request: Request) {
  try {
    const { supabase, agency, role } = await requireAgency();
    if (!["owner", "admin"].includes(role)) return privateJson({ error: "Only agency admins can change the calculator settings." }, 403);
    const settings = calculatorSettingsSchema.parse(await request.json());
    const { data, error } = await supabase.from("str_calculator_widgets")
      .upsert({ agency_id: agency.id, ...settings }, { onConflict: "agency_id" })
      .select("id,public_token,enabled,country,ask_phone").single();
    if (error) return privateJson({ error: "Couldn’t save calculator settings. Please try again." }, 503);
    return privateJson({ widget: data });
  } catch (error) { return strApiError(error); }
}
