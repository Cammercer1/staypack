import { expect, it } from "vitest";
import {
  normalizeAgencyBrandPayload,
  agencyToFormInput,
  DEFAULT_BRAND_VALUES,
} from "./normalize";
import type { AgencyInput } from "@/lib/validation/schemas";
import type { Agency } from "@/lib/types";
const input = {
  ...DEFAULT_BRAND_VALUES,
  name: "Agency",
  slug: "agency",
  logo_url: "old-logo",
  font_file_url: "old-font",
} as AgencyInput;
it("respects explicit removal of a primary logo and custom fonts despite legacy aliases", () => {
  const result = normalizeAgencyBrandPayload({
    ...input,
    logo_dark_url: "",
    logo_light_url: "",
    heading_font_file_url: "",
    body_font_file_url: "",
  });
  expect(result.logo_url).toBeNull();
  expect(result.heading_font_file_url).toBeNull();
  expect(result.body_font_file_url).toBeNull();
  expect(result.font_file_url).toBeNull();
});
it("retains legacy assets only when newer fields are omitted", () => {
  const legacy = { ...input };
  delete legacy.heading_font_file_url;
  delete legacy.body_font_file_url;
  const result = normalizeAgencyBrandPayload(legacy);
  expect(result.logo_url).toBe("old-logo");
  expect(result.heading_font_file_url).toBe("old-font");
  expect(result.body_font_file_url).toBe("old-font");
});
it("normalizes a saved brand into a stable new form baseline", () => {
  const form = agencyToFormInput({
    ...input,
    logo_dark_url: "",
    logo_light_url: "",
    body_font_file_url: "",
    font_file_url: "",
    website_url: null,
    email: null,
    phone: null,
  } as unknown as Agency);
  expect(form.website_url).toBe("");
  expect(form.email).toBe("");
  expect(form.body_font_file_url).toBe("");
  expect(form.logo_dark_url).toBe("");
});
