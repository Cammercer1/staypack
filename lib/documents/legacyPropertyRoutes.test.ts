import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), agency: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/agencies/resolveAgencyBySlug", () => ({ resolveAgencyBySlug: mocks.agency }));
vi.mock("@/lib/env", () => ({ hasServiceRoleKey: () => true, isDevelopment: () => false, getSiteUrl: () => "https://staypack.app", isLegacyPublicUrlHost: () => false }));
import { GET } from "@/app/(public)/go/[agencySlug]/[listingSlug]/route";
import { recordListingPageView } from "@/lib/listings/pageViews";

const params = { params: Promise.resolve({ agencySlug: "agency", listingSlug: "old-property" }) };
const request = new Request("https://staypack.app/go/agency/old-property");
const legacy = { id: "property", public_slug: "old-property", public_url: "https://staypack.app/agency/l/old-property", custom_landing_url: null, landing_qr_code_url: "old.png", landing_published_at: "2026-06-01" };
let filters: [string, unknown][];
let inserts: ReturnType<typeof vi.fn>;
let listing: object | null;
beforeEach(() => {
  vi.clearAllMocks();
  filters = [];
  inserts = vi.fn(() => { throw new Error("Analytics must not write"); });
  listing = legacy;
  mocks.agency.mockResolvedValue({ id: "agency-one", slug: "agency" });
  const query = {
    select: () => query,
    eq: (name: string, value: unknown) => { filters.push([name, value]); return query; },
    limit: () => query,
    maybeSingle: async () => ({ data: listing, error: null }),
    insert: inserts,
  };
  mocks.admin.mockReturnValue({ from: () => query });
});

describe("old printed property QR compatibility", () => {
  it("continues redirecting existing hosted-page QR codes without recording analytics", async () => {
    const result = await GET(request, params);
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("https://staypack.app/agency/l/old-property?via=qr");
    expect(filters).toContainEqual(["agency_id", "agency-one"]);
    expect(filters).toContainEqual(["status", "active"]);
    expect(inserts).not.toHaveBeenCalled();
  });
  it("keeps an existing external destination unchanged", async () => {
    listing = { ...legacy, custom_landing_url: "https://agency.example/property?campaign=printed#photos" };
    const result = await GET(request, params);
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("https://agency.example/property?campaign=printed#photos");
    expect(inserts).not.toHaveBeenCalled();
  });
  it("does not expose an unprovisioned property's slug", async () => {
    listing = { ...legacy, public_url: null, custom_landing_url: null, landing_qr_code_url: null, landing_published_at: null };
    expect((await GET(request, params)).status).toBe(404);
  });
  it("returns 404 for missing or inaccessible properties", async () => {
    listing = null;
    expect((await GET(request, params)).status).toBe(404);
  });
  it("does not create a database client for retired view tracking", async () => {
    expect(await recordListingPageView({ listingId: "property", source: "direct", userAgent: "Human browser" })).toEqual({ ok: true, skipped: true });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
