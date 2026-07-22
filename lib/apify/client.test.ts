import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrapeApifyReaRentSearchUrls } from "@/lib/apify/client";

function mockSuccessfulRun() {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: "run-1",
            defaultDatasetId: "dataset-1",
          },
        }),
        { status: 201 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            status: "SUCCEEDED",
            defaultDatasetId: "dataset-1",
          },
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(new Response("[]", { status: 200 }));

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Apify REA search options", () => {
  beforeEach(() => {
    vi.stubEnv("APIFY_API_KEY", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("widens rental searches while capping the dataset at 100 records", async () => {
    const fetchMock = mockSuccessfulRun();
    const searchUrls = Array.from(
      { length: 6 },
      (_, index) => `https://www.realestate.com.au/rent/search-${index}`,
    );

    await scrapeApifyReaRentSearchUrls({
      searchUrls,
      maxItems: 50,
      includeSurroundingSuburbs: true,
      datasetItemLimit: 100,
    });

    const startRequest = fetchMock.mock.calls[0]!;
    const startBody = JSON.parse(
      (startRequest[1] as RequestInit).body as string,
    );
    expect(startBody).toMatchObject({
      startUrls: searchUrls,
      includeSurroundingSuburbs: true,
      maxItems: 16,
    });

    const datasetUrl = String(fetchMock.mock.calls[2]![0]);
    expect(datasetUrl).toContain("limit=100");
  });

  it("preserves the existing 50-record non-surrounding default", async () => {
    const fetchMock = mockSuccessfulRun();

    await scrapeApifyReaRentSearchUrls({
      searchUrls: ["https://www.realestate.com.au/sold/search"],
      maxItems: 50,
    });

    const startRequest = fetchMock.mock.calls[0]!;
    const startBody = JSON.parse(
      (startRequest[1] as RequestInit).body as string,
    );
    expect(startBody).toMatchObject({
      includeSurroundingSuburbs: false,
      maxItems: 50,
    });

    const datasetUrl = String(fetchMock.mock.calls[2]![0]);
    expect(datasetUrl).toContain("limit=50");
  });
});
