import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRecipientFromSource } from "./sourceRecipient";

const id = "10000000-0000-4000-8000-000000000001";
function fixture(data: unknown, contact: unknown = { id: "client" }) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) };
  const contactQuery = { ...query, maybeSingle: vi.fn().mockResolvedValue({ data: contact, error: null }) };
  const from = vi.fn((table: string) => table === "str_appraisals" ? query : contactQuery);
  return { supabase: { from } as unknown as SupabaseClient, query, contactQuery, from };
}

it("carries the source report snapshot instead of inferring a client from a property", async () => {
  const mock = fixture({ recipient_mode: "named", contact_id: "client", recipient_name: "Report name", recipient_email: "private@example.test", recipient_phone: "0400000001" });
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toEqual({ mode: "named", contact_id: "client", name: "Report name", email: "private@example.test", phone: "0400000001" });
  expect(mock.query.eq).toHaveBeenCalledWith("agency_id", "agency");
  expect(mock.query.eq).toHaveBeenCalledWith("report_id", id);
  expect(mock.from.mock.calls.flat()).not.toContain("listings");
});

it("preserves pending legacy lead details so the new report asks for its missing name", async () => {
  const mock = fixture({ recipient_mode: "general", client_review_required: true, client_pending_json: { name: null, email: "lead@example.test", phone: "+61400000001" } });
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toEqual({ mode: "named", name: "", email: "lead@example.test", phone: "+61400000001" });
});

it("keeps archived client snapshot details without selecting an archived directory record", async () => {
  const mock = fixture({ recipient_mode: "named", contact_id: "archived", recipient_name: "Saved name" }, null);
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toEqual({ mode: "named", contact_id: "", name: "Saved name", email: "", phone: "" });
});

it("does not expose inaccessible report recipients and ignores malformed ids", async () => {
  const mock = fixture(null);
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toBeNull();
  mock.from.mockClear();
  expect(await loadRecipientFromSource(mock.supabase, "agency", "invalid")).toBeNull();
  expect(mock.from).not.toHaveBeenCalled();
});
