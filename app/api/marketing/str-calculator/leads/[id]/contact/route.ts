import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson } from "@/lib/str-appraisals/api";
import { recipientPayload, recipientSchema } from "@/lib/str-appraisals/validation";
import { clientApiError } from "@/lib/clients/api";
import { ClientError } from "@/lib/clients/service";

const schema = recipientSchema.refine(value => value.mode === "named", "Choose or add a contact.");

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { agency, user } = await requireAgency();
    const leadId = z.uuid().parse((await params).id);
    const recipient = schema.parse(await request.json());
    const { data, error } = await createAdminClient().rpc("save_calculator_enquiry_contact", {
      p_agency_id: agency.id, p_user_id: user.id, p_lead_id: leadId, p_recipient: recipientPayload(recipient),
    });
    if (error) throw new ClientError(error.message, error.code === "PT409" || error.code === "23505" ? 409 : error.code === "PT404" ? 404 : error.code === "42501" ? 403 : 400);
    return privateJson(data);
  } catch (error) { return clientApiError(error); }
}
