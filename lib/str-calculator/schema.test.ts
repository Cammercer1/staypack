import { describe, expect, it } from "vitest";
import { calculatorAssumptions, calculatorSettingsSchema, calculatorSubmissionSchema } from "./schema";
import { calculateAccommodates } from "@/lib/reports/formatters";

const input = { address: "12 Test Street, Sydney NSW 2000", bedrooms: 3, bathrooms: 1.5, email: "OWNER@example.com", consent: true, requestId: "6500bfd0-04d8-4919-b458-84e9ec0ce331" };
describe("calculator submissions", () => {
  it("normalizes lead input and requires explicit consent", () => {
    expect(calculatorSubmissionSchema.parse({ ...input, email: " OWNER@example.com " })).toMatchObject({ bathrooms: 1.5, email: "owner@example.com", website: "" });
    expect(calculatorSubmissionSchema.safeParse({ ...input, consent: false }).success).toBe(false);
  });
  it("rejects invalid input, bots and client attempts to select another agency", () => {
    for (const patch of [{ bedrooms: 1.5 }, { bedrooms: -1 }, { bedrooms: 11 }, { bathrooms: undefined }, { bathrooms: 0 }, { bathrooms: 1.25 }, { bathrooms: 20.5 }, { email: "invalid" }, { address: "Sydney" }, { website: "spam" }, { agency_id: "other" }, { requestId: "no" }]) {
      expect(calculatorSubmissionSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });
  it("matches report guest defaults for studios through large properties", () => {
    expect(calculatorAssumptions(0)).toEqual({ guests: 2, radiusM: 2000 });
    expect(calculatorAssumptions(3)).toEqual({ guests: 6, radiusM: 2000 });
    expect(calculatorAssumptions(10)).toEqual({ guests: 10, radiusM: 2000 });
    for (let bedrooms = 0; bedrooms <= 10; bedrooms += 1) {
      expect(calculatorAssumptions(bedrooms).guests).toBe(calculateAccommodates(bedrooms));
    }
  });
  it("accepts an omitted or blank phone and common AU/US phone formats", () => {
    for (const phone of [undefined, "", "  ", "0412 345 678", "+61 412 345 678", "+1 (415) 555-0123"]) {
      expect(calculatorSubmissionSchema.safeParse({ ...input, phone }).success).toBe(true);
    }
    for (const phone of ["123", "not a phone", "+1<script>", "1".repeat(16)]) {
      expect(calculatorSubmissionSchema.safeParse({ ...input, phone }).success).toBe(false);
    }
  });
  it("only accepts a boolean phone setting and supports older settings requests", () => {
    expect(calculatorSettingsSchema.parse({ enabled: false, country: "AU", ask_phone: true }).ask_phone).toBe(true);
    expect(calculatorSettingsSchema.parse({ enabled: true, country: "AU" })).not.toHaveProperty("ask_phone");
    expect(calculatorSettingsSchema.safeParse({ enabled: true, country: "AU", ask_phone: "true" }).success).toBe(false);
  });
});
