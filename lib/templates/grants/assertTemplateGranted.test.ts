import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateAccessConfiguration } from "@/lib/templates/grants/repository";
import type { Agency } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  loadTemplateAccessForAgency: vi.fn(),
}));

vi.mock("@/lib/templates/grants/repository", () => ({
  loadTemplateAccessForAgency: mocks.loadTemplateAccessForAgency,
}));

import {
  assertTemplateGranted,
  TemplateNotGrantedError,
} from "@/lib/templates/grants/assertTemplateGranted";

const agency = {
  id: "00000000-0000-4000-8000-000000000099",
  agency_group_id: null,
  report_template_id: "minimalist-detailed",
  collateral_template_defaults: {},
} as Agency;

const standardAccess: TemplateAccessConfiguration = {
  agencyGrants: [],
  groupGrants: [],
  agencyCatalogMode: null,
  groupCatalogMode: null,
};

describe("assertTemplateGranted", () => {
  beforeEach(() => {
    mocks.loadTemplateAccessForAgency.mockReset();
    mocks.loadTemplateAccessForAgency.mockResolvedValue(standardAccess);
  });

  it("allows platform templates without a grant row", async () => {
    await expect(
      assertTemplateGranted(agency, "classic-detailed"),
    ).resolves.toBeUndefined();
  });

  it("rejects unknown template ids", async () => {
    await expect(
      assertTemplateGranted(agency, "not-a-real-template"),
    ).rejects.toBeInstanceOf(TemplateNotGrantedError);
  });

  it("rejects platform templates hidden by a grants-only group", async () => {
    mocks.loadTemplateAccessForAgency.mockResolvedValue({
      agencyGrants: [],
      groupGrants: [
        {
          template_id: "haven-properties-str",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: "grants_only",
    } satisfies TemplateAccessConfiguration);

    await expect(
      assertTemplateGranted(agency, "classic-detailed"),
    ).rejects.toBeInstanceOf(TemplateNotGrantedError);
  });

  it("allows templates inherited from the group", async () => {
    mocks.loadTemplateAccessForAgency.mockResolvedValue({
      agencyGrants: [],
      groupGrants: [
        {
          template_id: "haven-properties-str",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: "grants_only",
    } satisfies TemplateAccessConfiguration);

    await expect(
      assertTemplateGranted(agency, "haven-properties-str"),
    ).resolves.toBeUndefined();
  });
});
