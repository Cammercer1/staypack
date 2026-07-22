import { describe, expect, it } from "vitest";
import { getTemplateCatalogEntry } from "@/lib/templates/catalog";
import {
  resolveAvailableTemplatesFromAccess,
  resolveAvailableTemplatesFromGrants,
  TemplateAccessConfigurationError,
} from "@/lib/templates/resolveAvailableTemplates";
import type { Agency } from "@/lib/types";

const agency = {
  id: "00000000-0000-4000-8000-000000000001",
  report_template_id: "minimalist-detailed",
  collateral_template_defaults: {},
} as Agency;

describe("resolveAvailableTemplatesFromGrants", () => {
  it("includes platform STR templates without grants", () => {
    const result = resolveAvailableTemplatesFromGrants(agency, "str", []);
    expect(result.templates.some((t) => t.id === "classic-detailed")).toBe(true);
    expect(result.templates.some((t) => t.id === "classic-light")).toBe(false);
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
    expect(result.templates[0]?.id).toBe("haven-properties-str");
  });
});

describe("resolveAvailableTemplatesFromAccess", () => {
  it("inherits group templates and the group default", () => {
    const result = resolveAvailableTemplatesFromAccess(agency, "str", {
      agencyGrants: [],
      groupGrants: [
        {
          template_id: "haven-properties-str",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: null,
    });

    expect(result.templates.some((t) => t.id === "haven-properties-str")).toBe(
      true,
    );
    expect(result.defaultTemplateId).toBe("haven-properties-str");
  });

  it("shows only inherited and office grants in grants-only mode", () => {
    const result = resolveAvailableTemplatesFromAccess(agency, "str", {
      agencyGrants: [
        {
          template_id: "belle-property-str",
          product: "str",
          is_default: false,
        },
      ],
      groupGrants: [
        {
          template_id: "haven-properties-str",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: "grants_only",
    });

    expect(result.templates.map((template) => template.id)).toEqual([
      "haven-properties-str",
      "belle-property-str",
    ]);
    expect(result.templates.some((t) => t.scope === "platform")).toBe(false);
  });

  it("lets an office default override the group default", () => {
    const result = resolveAvailableTemplatesFromAccess(agency, "str", {
      agencyGrants: [
        {
          template_id: "belle-property-str",
          product: "str",
          is_default: true,
        },
      ],
      groupGrants: [
        {
          template_id: "haven-properties-str",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: "grants_only",
    });

    expect(result.defaultTemplateId).toBe("belle-property-str");
    expect(result.templates[0]?.id).toBe("belle-property-str");
  });

  it("lets an office catalogue policy override the group policy", () => {
    const result = resolveAvailableTemplatesFromAccess(agency, "str", {
      agencyGrants: [],
      groupGrants: [
        {
          template_id: "haven-properties-str",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: "platform_plus_grants",
      groupCatalogMode: "grants_only",
    });

    expect(result.templates.some((t) => t.id === "classic-detailed")).toBe(true);
    expect(result.templates.some((t) => t.id === "haven-properties-str")).toBe(
      true,
    );
  });

  it("allows explicitly granted platform templates in grants-only mode", () => {
    const result = resolveAvailableTemplatesFromAccess(agency, "str", {
      agencyGrants: [],
      groupGrants: [
        {
          template_id: "classic-detailed",
          product: "str",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: "grants_only",
    });

    expect(result.templates.map((template) => template.id)).toEqual([
      "classic-detailed",
    ]);
  });

  it("resolves the OC lease appraisal as the sole account template", () => {
    const result = resolveAvailableTemplatesFromAccess(agency, "lease", {
      agencyGrants: [],
      groupGrants: [
        {
          template_id: "oc-real-estate-lease-appraisal",
          product: "lease",
          is_default: true,
        },
      ],
      agencyCatalogMode: null,
      groupCatalogMode: "grants_only",
    });

    expect(result.defaultTemplateId).toBe("oc-real-estate-lease-appraisal");
    expect(result.templates.map((template) => template.id)).toEqual([
      "oc-real-estate-lease-appraisal",
    ]);
  });

  it("fails closed when grants-only mode has no grants", () => {
    expect(() =>
      resolveAvailableTemplatesFromAccess(agency, "str", {
        agencyGrants: [],
        groupGrants: [],
        agencyCatalogMode: null,
        groupCatalogMode: "grants_only",
      }),
    ).toThrow(TemplateAccessConfigurationError);
  });
});

describe("template catalog metadata", () => {
  it("marks haven STR as account-scoped with fixed brand", () => {
    const entry = getTemplateCatalogEntry("haven-properties-str");
    expect(entry?.scope).toBe("account");
    expect(entry?.brandMode).toBe("fixed");
    expect(entry?.defaultBlurbLength).toBe("long");
  });

  it("marks belle templates as long blurb account layouts", () => {
    for (const templateId of [
      "belle-property-str",
      "belle-property-lease-appraisal",
      "sales-brochure-belle-2pg",
    ]) {
      const entry = getTemplateCatalogEntry(templateId);
      expect(entry?.defaultBlurbLength).toBe("long");
    }
  });

  it("marks classic-detailed as platform with agency brand", () => {
    const entry = getTemplateCatalogEntry("classic-detailed");
    expect(entry?.scope).toBe("platform");
    expect(entry?.brandMode).toBe("agency");
  });

  it("marks the OC lease appraisal as account-scoped with fixed brand", () => {
    const entry = getTemplateCatalogEntry("oc-real-estate-lease-appraisal");
    expect(entry?.product).toBe("lease");
    expect(entry?.scope).toBe("account");
    expect(entry?.brandMode).toBe("fixed");
  });
});
