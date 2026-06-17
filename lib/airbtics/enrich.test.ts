import { describe, expect, it } from "vitest";
import { buildStrEnrichment } from "@/lib/airbtics/enrich";

describe("buildStrEnrichment", () => {
  it("excludes room comps from displayed STR evidence", () => {
    const enrichment = buildStrEnrichment({
      report_type: "all",
      radius: 500,
      bedrooms: 1,
      kpis: {
        "25": { ltm_revenue: 28_000 },
        "50": { ltm_revenue: 37_000 },
        "75": { ltm_revenue: 56_000 },
        "90": { ltm_revenue: 74_000 },
      },
      comps: [
        {
          listingID: "private-room",
          name: "Deluxe Queen Room",
          room_type: "private_room",
          bedrooms: 1,
          annual_revenue_ltm: 18_000,
          similarity_score: 0.9,
        },
        {
          listingID: "entire-home",
          name: "Whole Apartment",
          room_type: "entire_home",
          bedrooms: 1,
          annual_revenue_ltm: 35_000,
          similarity_score: 0.8,
        },
      ],
    });

    expect(enrichment?.comp_count).toBe(1);
    expect(enrichment?.comps).toHaveLength(1);
    expect(enrichment?.comps[0].listing_id).toBe("entire-home");
  });
});
