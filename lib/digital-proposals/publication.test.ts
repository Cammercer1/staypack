import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { hasPublishedProposal } from "./publication";

const agencyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reportId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const revokedAt = "2026-10-21T00:00:00Z";
const activeLink = { is_primary: true, revoked_at: null, version: { revoked_at: null } };

function database(data: unknown = [], error: { message: string } | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
  const from = vi.fn().mockReturnValue(query);
  return { supabase: { from } as unknown as SupabaseClient, from, query };
}

it("does not treat an appraisal without a publication as published", async () => {
  const { supabase } = database();
  expect(await hasPublishedProposal(supabase, agencyId, reportId)).toBe(false);
});

it("finds a published primary link without reading legacy report JSON or the draft revision", async () => {
  const { supabase, from, query } = database([activeLink]);
  expect(await hasPublishedProposal(supabase, agencyId, reportId)).toBe(true);
  expect(from).toHaveBeenCalledExactlyOnceWith("digital_proposal_links");
  expect(query.select).toHaveBeenCalledExactlyOnceWith("is_primary,revoked_at,version:digital_proposal_versions!digital_proposal_links_agency_id_report_id_version_id_fkey(revoked_at)");
  expect(query.eq.mock.calls).toEqual([["agency_id", agencyId], ["report_id", reportId]]);
});

it.each([
  { ...activeLink, revoked_at: revokedAt },
  { ...activeLink, version: { revoked_at: revokedAt } },
  { ...activeLink, version: null },
])("rejects revoked or unavailable publications: %j", async link => {
  const { supabase } = database([link]);
  expect(await hasPublishedProposal(supabase, agencyId, reportId)).toBe(false);
});

it("recognises a legacy publication before a primary link has been adopted", async () => {
  const { supabase } = database([{ ...activeLink, is_primary: false }]);
  expect(await hasPublishedProposal(supabase, agencyId, reportId)).toBe(true);
});

it.each([
  { ...activeLink, revoked_at: revokedAt },
  { ...activeLink, version: { revoked_at: revokedAt } },
  { ...activeLink, version: null },
])("does not fall back to an old live link when the primary publication is unavailable: %j", async primary => {
  const { supabase } = database([{ ...activeLink, is_primary: false }, primary]);
  expect(await hasPublishedProposal(supabase, agencyId, reportId)).toBe(false);
});

it("recognises a replacement primary after an older primary was revoked", async () => {
  const { supabase } = database([{ ...activeLink, revoked_at: revokedAt }, activeLink]);
  expect(await hasPublishedProposal(supabase, agencyId, reportId)).toBe(true);
});

it("surfaces read failures instead of silently treating a publication as a draft", async () => {
  const { supabase } = database(null, { message: "Publication lookup failed" });
  await expect(hasPublishedProposal(supabase, agencyId, reportId)).rejects.toThrow("Publication lookup failed");
});
