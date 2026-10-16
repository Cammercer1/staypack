import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generalRecipient, type RecipientValues } from "@/lib/str-appraisals/validation";
import type { ClientDetail, PendingClient } from "./types";

/** An explicit directory selection starts a new report with the saved contact. */
export async function loadRecipientFromContact(supabase: SupabaseClient, agencyId: string, contactId: string): Promise<RecipientValues | null> {
  if (!z.uuid().safeParse(contactId).success) return null;
  const { data, error } = await supabase.rpc("get_agency_client", { p_agency_id: agencyId, p_client_id: contactId });
  if (error && error.code !== "PT404") throw new Error(error.message);
  const contact = (data as ClientDetail | null)?.client;
  if (!contact || contact.archived_at) return null;
  return { mode: "named", contact_id: contact.id, name: contact.name, email: contact.email || "", phone: contact.phone || "" };
}

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
    const { data: detail, error: contactError } = await supabase.rpc("get_agency_client", { p_agency_id: agencyId, p_client_id: contactId });
    if (contactError && contactError.code !== "PT404") throw new Error(contactError.message);
    const contact = (detail as ClientDetail | null)?.client;
    // Merged directory IDs resolve to the canonical client; saved report details stay intact.
    contactId = contact && !contact.archived_at ? contact.id : null;
  }
  return {
    mode: "named", contact_id: contactId ?? "", name: data.recipient_name ?? "",
    email: data.recipient_email ?? "", phone: data.recipient_phone ?? "",
  };
}
