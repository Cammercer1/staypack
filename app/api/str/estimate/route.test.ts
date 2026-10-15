import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { geocodeReportAddress } from "@/lib/geocoding";
import { fetchStrEstimate } from "@/lib/str/estimate";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";

vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ geocodeReportAddress: vi.fn() }));
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function setup(coordinates?: { latitude: number; longitude: number }) {
  const f = createLintRegressionFixtures();
  const listing = { ...f.listing, latitude: null, longitude: null, ...coordinates };
  const from = vi.fn();
  vi.mocked(requireReportWithListing).mockResolvedValue({
    report: f.report, listing, agency: f.agency, supabase: { from },
  } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  vi.mocked(geocodeReportAddress).mockResolvedValue({
    latitude: -28.0167, longitude: 153.4, formattedAddress: "Development property", placeId: "mock-place-id",
  });
  return { from, listing };
}
function request(coordinates?: { latitude: number; longitude: number }) {
  return new Request("https://example.test/api/str/estimate", {
    method: "POST", body: JSON.stringify({ report_id: "b7067c85-6745-48c7-a9f8-e48cdb91d854", ...coordinates }),
  });
}

it("rejects mock geocoding before accessing the shared estimate cache or modifying a report", async () => {
  const { from } = setup();
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("real property location") });
  expect(fetchStrEstimate).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it.each(["listing", "request"] as const)("keeps explicit real %s coordinates usable without geocoding", async (source) => {
  const coordinates = { latitude: -33.8, longitude: 151.2 };
  const { listing } = setup(source === "listing" ? coordinates : undefined);
  // Stop at the estimator: reaching it proves real coordinates remain usable.
  vi.mocked(fetchStrEstimate).mockRejectedValueOnce(new Error("Reached estimator"));
  const response = await POST(request(source === "request" ? coordinates : undefined));
  expect(await response.json()).toEqual({ error: "Reached estimator" });
  expect(geocodeReportAddress).not.toHaveBeenCalled();
  expect(fetchStrEstimate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(coordinates), listing, expect.anything());
});
