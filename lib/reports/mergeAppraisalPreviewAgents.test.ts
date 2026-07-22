import { describe, expect, it } from "vitest";
import { mergeAppraisalPreviewAgents } from "@/lib/reports/mergeAppraisalPreviewAgents";
import type { AgentProfile, FinalReportJson, Listing } from "@/lib/types";

const placeholder = {
  name: "Agent",
  role_title: "Property Expert",
  phone: "0400 000 000",
  email: "agent@example.com",
  photo_url: "",
};

function agent(
  id: string,
  name: string,
  isDefault = false,
): AgentProfile {
  return {
    id,
    agency_id: "agency-1",
    name,
    email: `${id}@example.com`,
    phone: "0412 345 678",
    role_title: "Sales Agent",
    photo_url: `https://example.com/${id}.jpg`,
    is_default: isDefault,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("mergeAppraisalPreviewAgents", () => {
  it("replaces cached placeholders with the listing's matched agency agents", () => {
    const report = {
      agent: placeholder,
      agents: [placeholder],
    } as FinalReportJson;
    const listing = {
      agent_profile_id: null,
      scraped_listing_json: {
        agents: [{ name: "Donna Burke" }, { name: "James Giltinan" }],
      },
    } as unknown as Listing;

    const merged = mergeAppraisalPreviewAgents(report, listing, [
      agent("unrelated", "Unrelated Agent"),
      agent("donna", "Donna Burke"),
      agent("james", "James Giltinan"),
    ]);

    expect(merged.agent.name).toBe("Donna Burke");
    expect(merged.agents?.map((entry) => entry.name)).toEqual([
      "Donna Burke",
      "James Giltinan",
    ]);
    expect(merged.agent.photo_url).toBe("https://example.com/donna.jpg");
  });

  it("falls back to the explicitly assigned agent when no agents were scraped", () => {
    const report = {
      agent: placeholder,
      agents: [placeholder],
    } as FinalReportJson;
    const listing = {
      agent_profile_id: "assigned",
      scraped_listing_json: { agents: [] },
    } as unknown as Listing;

    const merged = mergeAppraisalPreviewAgents(report, listing, [
      agent("other", "Other Agent", true),
      agent("assigned", "Assigned Agent"),
    ]);

    expect(merged.agents?.map((entry) => entry.name)).toEqual([
      "Assigned Agent",
    ]);
  });

  it("preserves cached agents when no agency roster is available", () => {
    const report = {
      agent: placeholder,
      agents: [placeholder],
    } as FinalReportJson;

    expect(
      mergeAppraisalPreviewAgents(
        report,
        { agent_profile_id: null } as Listing,
        [],
      ),
    ).toBe(report);
  });
});
