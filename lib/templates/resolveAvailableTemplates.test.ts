import { describe, expect, it } from "vitest";
import { getTemplateCatalogEntry } from "@/lib/templates/catalog";
import { resolveAvailableTemplatesFromGrants } from "@/lib/templates/resolveAvailableTemplates";
import type { Agency } from "@/lib/types";

const agency = {
  id: "00000000-0000-4000-8000-000000000001",
  report_template_id: "minimalist-light",
  collateral_template_defaults: {},
} as Agency;

describe("resolveAvailableTemplatesFromGrants", () => {
  it("includes platform STR templates without grants", () => {
    const result = resolveAvailableTemplatesFromGrants(agency, "str", []);
    expect(result.templates.some((t) => t.id === "classic-light")).toBe(true);
    expect(result.templates.some((t) => t.id === "haven-properties-str")).toBe(
      false,
    );
  });

  it("includes account templates when granted", () => {
    const result = resolveAvailableTemplatesFromGrants(agency, "str", [
      {
        template_id: "haven-properties-str",
        product: "str",
        is_default: true,
      },
    ]);
    expect(result.templates.some((t) => t.id === "haven-properties-str")).toBe(
      true,
    );
    expect(result.defaultTemplateId).toBe("haven-properties-str");
  });
});

describe("template catalog metadata", () => {
  it("marks haven STR as account-scoped with fixed brand", () => {
    const entry = getTemplateCatalogEntry("haven-properties-str");
    expect(entry?.scope).toBe("account");
    expect(entry?.brandMode).toBe("fixed");
    expect(entry?.defaultBlurbLength).toBe("long");
  });

  it("marks classic-light as platform with agency brand", () => {
    const entry = getTemplateCatalogEntry("classic-light");
    expect(entry?.scope).toBe("platform");
    expect(entry?.brandMode).toBe("agency");
  });
});
