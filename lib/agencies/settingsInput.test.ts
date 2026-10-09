import { expect, it } from "vitest";
import {
  agencyToFormInput,
  DEFAULT_BRAND_VALUES,
} from "@/lib/branding/normalize";
import { parseAgencySettingsUpdate } from "./settingsInput";
import type { Agency } from "@/lib/types";
const agency = {
  ...DEFAULT_BRAND_VALUES,
  name: "Current Agency",
  slug: "current-agency",
  website_url: "https://example.com",
  email: "hello@example.com",
  phone: "123",
  default_report_title: "Report",
  default_cta: "Contact us",
} as Agency;
const values = agencyToFormInput(agency);
it("updates only contact details, rejecting stale brand fields from the page", () => {
  const result = parseAgencySettingsUpdate(
    {
      ...values,
      name: "New name",
      website_url: "new.example.com",
      email: "",
      primary_colour: "#000000",
      settings_section: "details",
    },
    agency,
  );
  expect(result).toEqual({
    name: "New name",
    slug: "current-agency",
    website_url: "https://new.example.com",
    email: null,
    phone: "123",
  });
});
it("updates branding without writing stale identity fields", () => {
  const result = parseAgencySettingsUpdate(
    {
      ...values,
      name: "Stale name",
      slug: "stale-slug",
      primary_colour: "#123456",
      settings_section: "brand",
    },
    agency,
  );
  expect(result.primary_colour).toBe("#123456");
  for (const key of ["name", "slug", "email", "phone", "website_url"])
    expect(result).not.toHaveProperty(key);
});
it("validates only the settings owned by each page", () => {
  expect(() =>
    parseAgencySettingsUpdate(
      {
        name: "Agency",
        slug: "agency",
        website_url: "",
        email: "",
        settings_section: "details",
      },
      agency,
    ),
  ).not.toThrow();
  expect(() =>
    parseAgencySettingsUpdate(
      { ...values, name: "", settings_section: "brand" },
      agency,
    ),
  ).not.toThrow();
  expect(() =>
    parseAgencySettingsUpdate(
      { ...values, email: "invalid", settings_section: "details" },
      agency,
    ),
  ).toThrow();
});
it("keeps legacy full updates working and rejects an unknown section", () => {
  expect(parseAgencySettingsUpdate(values, agency).name).toBe(agency.name);
  expect(() =>
    parseAgencySettingsUpdate(
      { ...values, settings_section: "unknown" },
      agency,
    ),
  ).toThrow("Invalid settings section");
});
