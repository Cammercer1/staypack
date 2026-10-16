import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRecipientFromContact, loadRecipientFromSource } from "./sourceRecipient";

const id = "10000000-0000-4000-8000-000000000001";
function fixture(data: unknown, contact: unknown = { id: "client" }) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) };
  const from = vi.fn().mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: contact ? { client: contact } : null, error: null });
  return { supabase: { from, rpc } as unknown as SupabaseClient, query, from, rpc };
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
  const mock = fixture({ recipient_mode: "named", contact_id: "archived", recipient_name: "Saved name" }, { id: "archived", archived_at: "2026-10-16T00:00:00Z" });
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toEqual({ mode: "named", contact_id: "", name: "Saved name", email: "", phone: "" });
});

it("uses a merged client's canonical identity while retaining the source report snapshot", async () => {
  const source = { recipient_mode: "named", contact_id: "merged-client", recipient_name: "Report name", recipient_email: "saved@example.test", recipient_phone: "0400000001" };
  const mock = fixture(source, { id: "canonical-client", name: "Directory name", email: "current@example.test", phone: "0411111111", archived_at: null });
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toEqual({ mode: "named", contact_id: "canonical-client", name: "Report name", email: "saved@example.test", phone: "0400000001" });
  expect(mock.rpc).toHaveBeenCalledWith("get_agency_client", { p_agency_id: "agency", p_client_id: "merged-client" });
  expect(source.contact_id).toBe("merged-client");
  expect(mock.from.mock.calls.flat()).toEqual(["str_appraisals"]);
});

it("retains saved details if the linked client no longer exists, but surfaces lookup failures", async () => {
  const mock = fixture({ recipient_mode: "named", contact_id: "missing", recipient_name: "Saved name" });
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "PT404", message: "Client not found" } });
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toEqual({ mode: "named", contact_id: "", name: "Saved name", email: "", phone: "" });
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Agency access required" } });
  await expect(loadRecipientFromSource(mock.supabase, "agency", id)).rejects.toThrow("Agency access required");
});

it("does not expose inaccessible report recipients and ignores malformed ids", async () => {
  const mock = fixture(null);
  expect(await loadRecipientFromSource(mock.supabase, "agency", id)).toBeNull();
  mock.from.mockClear();
  expect(await loadRecipientFromSource(mock.supabase, "agency", "invalid")).toBeNull();
  expect(mock.from).not.toHaveBeenCalled();
});


it("starts a report from an explicit contact selection without touching a report", async () => {
  const mock = fixture(null, { id: "canonical", name: "Saved Person", email: "person@example.test", phone: null });
  expect(await loadRecipientFromContact(mock.supabase, "agency", id)).toEqual({ mode: "named", contact_id: "canonical", name: "Saved Person", email: "person@example.test", phone: "" });
  expect(mock.rpc).toHaveBeenCalledWith("get_agency_client", { p_agency_id: "agency", p_client_id: id });
  expect(mock.from).not.toHaveBeenCalled();
});

it("rejects archived, inaccessible and invalid contact selections", async () => {
  const archived = fixture(null, { id, archived_at: "2026-10-16" });
  expect(await loadRecipientFromContact(archived.supabase, "agency", id)).toBeNull();
  const missing = fixture(null, null);
  expect(await loadRecipientFromContact(missing.supabase, "agency", id)).toBeNull();
  missing.rpc.mockClear();
  expect(await loadRecipientFromContact(missing.supabase, "agency", "invalid")).toBeNull();
  expect(missing.rpc).not.toHaveBeenCalled();
});
