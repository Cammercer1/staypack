import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generalRecipient, type RecipientValues } from "@/lib/str-appraisals/validation";
import type { PendingClient } from "./types";

/** Explicit report lineage only: the property's other recipients are never inferred. */
export async function loadRecipientFromSource(supabase: SupabaseClient, agencyId: string, sourceReportId: string): Promise<RecipientValues | null> {
  if (!z.uuid().safeParse(sourceReportId).success) return null;
  const { data, error } = await supabase.from("str_appraisals")
    .select("contact_id,recipient_mode,recipient_name,recipient_email,recipient_phone,client_review_required,client_pending_json")
    .eq("agency_id", agencyId).eq("report_id", sourceReportId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.client_review_required) {
    const pending = data.client_pending_json as PendingClient | null;
    return { mode: "named", name: pending?.name ?? "", email: pending?.email ?? "", phone: pending?.phone ?? "" };
  }
  if (data.recipient_mode !== "named") return { ...generalRecipient };
  let contactId = data.contact_id as string | null;
  if (contactId) {
    const { data: contact, error: contactError } = await supabase.from("agency_contacts").select("id")
      .eq("agency_id", agencyId).eq("id", contactId).is("archived_at", null).maybeSingle();
    if (contactError) throw new Error(contactError.message);
    if (!contact) contactId = null;
  }
  return {
    mode: "named", contact_id: contactId ?? "", name: data.recipient_name ?? "",
    email: data.recipient_email ?? "", phone: data.recipient_phone ?? "",
  };
}
