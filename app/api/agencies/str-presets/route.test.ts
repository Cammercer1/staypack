import { afterEach, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
vi.mock("@/lib/auth/requireUser", () => ({ requireAgencyAdmin: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it("stores validated presets only on the authenticated admin's agency", async () => {
  const f = createLintRegressionFixtures();
  const presets = f.agency.str_management_presets!;
  const query = { update: vi.fn(() => query), eq: vi.fn(() => query), select: vi.fn(() => query), single: vi.fn(async () => ({ data: { str_management_presets: presets }, error: null })) };
  vi.mocked(requireAgencyAdmin).mockResolvedValue({ agency: f.agency, supabase: { from: () => query } } as unknown as Awaited<ReturnType<typeof requireAgencyAdmin>>);
  const response = await PATCH(new Request("https://example.test/presets", { method: "PATCH", body: JSON.stringify({ presets }) }));
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith({ str_management_presets: presets });
  expect(query.eq).toHaveBeenCalledWith("id", f.agency.id);
  const forged = await PATCH(new Request("https://example.test/presets", { method: "PATCH", body: JSON.stringify({ presets, agency_id: "other-agency" }) }));
  expect(forged.status).toBe(400);
  expect(query.update).toHaveBeenCalledOnce();
});

it("does not save company presets without admin access", async () => {
  vi.mocked(requireAgencyAdmin).mockRejectedValue(new Error("Admin access required"));
  const response = await PATCH(new Request("https://example.test/presets", { method: "PATCH", body: JSON.stringify({ presets: [] }) }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Admin access required" });
});

it("sets up a first uplift without replacing other presets and uses a concurrency check", async () => {
  const f = createLintRegressionFixtures();
  f.agency.str_management_presets = f.agency.str_management_presets!.filter(p => !p.isDefault);
  let saved: unknown;
  const query = { update: vi.fn((body) => { saved = body.str_management_presets; return query; }), eq: vi.fn(() => query), select: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: { str_management_presets: saved }, error: null })) };
  vi.mocked(requireAgencyAdmin).mockResolvedValue({ agency: f.agency, supabase: { from: () => query } } as unknown as Awaited<ReturnType<typeof requireAgencyAdmin>>);
  const { POST } = await import('./route');
  const response = await POST(new Request('https://example.test/presets', { method: 'POST', body: JSON.stringify({ upliftPercent: 28, assumptions: f.agency.str_management_presets![0].assumptions }) }));
  expect(response.status).toBe(200);
  const { presets } = await response.json();
  expect(presets[0]).toEqual(f.agency.str_management_presets![0]);
  expect(presets[1]).toMatchObject({ mode: 'uplift', upliftPercent: 28, isDefault: true });
  expect(query.eq).toHaveBeenCalledWith('id', f.agency.id);
  expect(query.eq).toHaveBeenCalledWith('str_management_presets', JSON.stringify(f.agency.str_management_presets));
  query.maybeSingle.mockResolvedValueOnce({ data: null as never, error: null });
  expect((await POST(new Request('https://example.test/presets', { method: 'POST', body: JSON.stringify({ upliftPercent: 28, assumptions: presets[0].assumptions }) }))).status).toBe(409);
});

it("rejects first-use setup for members and already-configured companies", async () => {
  const { POST } = await import('./route');
  const request = () => new Request('https://example.test/presets', { method: 'POST', body: JSON.stringify({ upliftPercent: 28, assumptions: { unavailableNights: 0, listingStage: 'established', rationale: 'Company assumptions' } }) });
  vi.mocked(requireAgencyAdmin).mockRejectedValueOnce(new Error('Admin access required'));
  expect((await POST(request())).status).toBe(400);
  const from = vi.fn();
  vi.mocked(requireAgencyAdmin).mockResolvedValue({ agency: createLintRegressionFixtures().agency, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireAgencyAdmin>>);
  expect((await POST(request())).status).toBe(409);
  expect(from).not.toHaveBeenCalled();
});
