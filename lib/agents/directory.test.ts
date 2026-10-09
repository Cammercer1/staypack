import { describe, expect, it } from "vitest";
import {
  agentListingUsage,
  duplicateReasons,
  filterAgentDirectory,
  findDuplicateAgents,
  findBlockingDuplicateAgents,
  type AgentDirectoryEntry,
} from "./directory";
import { cropSource, validateAgentPhoto } from "./photo";
import { resolveAgencyAccountReportAgents } from "@/lib/reports/resolveReportAgents";
const agent = (id: string, name: string, extra = {}): AgentDirectoryEntry => ({
  id,
  name,
  agency_id: "agency",
  role_title: "Sales",
  email: null,
  phone: null,
  photo_url: null,
  is_default: false,
  archived_at: null,
  created_at: id,
  updated_at: "now",
  listings: [],
  ...extra,
});
const agents = [
  agent("1", "Zoe"),
  agent("2", "Amy"),
  agent("3", "Former", { archived_at: "yesterday" }),
];
describe("agent directory", () => {
  it("filters active/archive and sorts without mutating input", () => {
    expect(
      filterAgentDirectory(agents, "", "active", "az").map((a) => a.name),
    ).toEqual(["Amy", "Zoe"]);
    expect(filterAgentDirectory(agents, "", "archived", "az")).toHaveLength(1);
    expect(agents[0].name).toBe("Zoe");
  });
  it("searches case-insensitively and handles empty results", () => {
    expect(
      filterAgentDirectory(agents, " SALES ", "active", "za").map(
        (a) => a.name,
      ),
    ).toEqual(["Zoe", "Amy"]);
    expect(filterAgentDirectory(agents, "missing", "all", "newest")).toEqual(
      [],
    );
  });
  it("compares independent email, name and international phone signals", () => {
    expect(
      duplicateReasons(
        {
          name: " AMY  Smith ",
          email: "ONE@EXAMPLE.COM",
          phone: "+61 412 345 678",
        },
        { name: "Amy Smith", email: "one@example.com", phone: "0412345678" },
      ),
    ).toEqual(["name", "email", "phone"]);
  });
  it("does not match empty or masked phone numbers", () => {
    expect(
      duplicateReasons({ phone: "0412***" }, { phone: "0412***" }),
    ).toEqual([]);
    expect(duplicateReasons({}, {})).toEqual([]);
  });
  it("excludes self but includes archived duplicate candidates", () => {
    expect(findDuplicateAgents({ name: "Former" }, agents, "3")).toEqual([]);
    expect(findDuplicateAgents({ name: "Former" }, agents)).toHaveLength(1);
  });
  it("shows possible duplicates without auto-merging", () => {
    const matches = [...agents, agent("4", "Amy")];
    expect(filterAgentDirectory(matches, "", "duplicates", "az")).toHaveLength(
      2,
    );
  });
  it("distinguishes direct assignments from snapshot contact matches", () => {
    const listings = [
      {
        id: "one",
        property_address: "1 Road",
        listing_title: null,
        agent_profile_id: "2",
        scraped_listing_json: null,
      },
      {
        id: "two",
        property_address: null,
        listing_title: "House",
        agent_profile_id: null,
        scraped_listing_json: { agents: [{ name: "Amy" }] },
      },
    ];
    expect(
      agentListingUsage(
        agents[1],
        listings as Parameters<typeof agentListingUsage>[1],
      ).map((l) => l.match),
    ).toEqual(["assigned", "contact match"]);
  });
  it("does not use archived agents as a report fallback but preserves explicit assignments", () => {
    const archived = { ...agents[2], is_default: true };
    expect(
      resolveAgencyAccountReportAgents({
        agencyAgents: [archived, agents[0]],
      })[0].name,
    ).toBe("Zoe");
    expect(
      resolveAgencyAccountReportAgents({
        agentProfile: archived,
        agencyAgents: agents,
      })[0].name,
    ).toBe("Former");
    expect(
      resolveAgencyAccountReportAgents({ agencyAgents: [archived] }),
    ).toEqual([]);
  });
});
describe("photo validation and crop", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "image/avif"])(
    "accepts %s",
    (type) => expect(validateAgentPhoto({ type, size: 100 })).toBeNull(),
  );
  it("rejects empty, oversize and unsupported photos", () => {
    expect(validateAgentPhoto({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(
      validateAgentPhoto({ type: "image/png", size: 6 * 1024 * 1024 }),
    ).toMatch(/5 MB/);
    expect(validateAgentPhoto({ type: "image/svg+xml", size: 100 })).toMatch(
      /Choose/,
    );
  });
  it("crops portrait and landscape inside image bounds", () => {
    expect(cropSource(1200, 800, 1, 50, 50)).toEqual({
      size: 800,
      x: 200,
      y: 0,
    });
    expect(cropSource(800, 1200, 2, 100, 100)).toEqual({
      size: 400,
      x: 400,
      y: 800,
    });
    expect(cropSource(800, 800, 0, -20, 150)).toEqual({
      size: 800,
      x: 0,
      y: 0,
    });
  });
});

describe("blocking duplicate contacts", () => {
  const original = agent("first", "Alex", {
    email: "Alex@example.com",
    phone: "0412345678",
  });
  it("blocks normalized email and phone even for different names or archived records", () => {
    expect(
      findBlockingDuplicateAgents(
        { name: "Other", email: " alex@EXAMPLE.com " },
        [original],
      ),
    ).toEqual([original]);
    expect(
      findBlockingDuplicateAgents({ phone: "0061 412 345 678" }, [
        { ...original, archived_at: "yesterday" },
      ]),
    ).toHaveLength(1);
  });
  it("does not treat names, empty contacts, or masked phones as unique identifiers", () => {
    expect(findBlockingDuplicateAgents({ name: "Alex" }, [original])).toEqual(
      [],
    );
    expect(
      findBlockingDuplicateAgents({ phone: "0412******" }, [original]),
    ).toEqual([]);
    expect(
      findBlockingDuplicateAgents({ phone: "not a phone 0412345678" }, [
        original,
      ]),
    ).toEqual([]);
  });
  it("excludes self and permits maintenance of existing shared contacts", () => {
    const legacy = { ...original, id: "legacy" };
    expect(
      findBlockingDuplicateAgents(original, [original, legacy], original),
    ).toEqual([]);
    expect(
      findBlockingDuplicateAgents(
        { ...original, email: "new@example.com" },
        [original, legacy, agent("new", "New", { email: "NEW@example.com" })],
        original,
      ).map((a) => a.id),
    ).toEqual(["new"]);
  });
});
