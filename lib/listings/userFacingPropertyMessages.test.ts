import { expect, it } from "vitest";
import { isPropertyProviderDiagnostic, userFacingPropertyMessage } from "./userFacingPropertyMessages";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";
import { stripInternalSalesAppraisalWarnings } from "@/lib/sales/userFacingSalesWarnings";

it("keeps source diagnostics out of user-facing errors and saved warning lists", () => {
  const diagnostics = [
    "Domain’s lookup allowance has been reached.",
    "Imported from Domain.com.au",
    "Domain AVM request failed (429): quota exceeded",
    "Fetched from https://domain-au.p.rapidapi.com/properties",
  ];
  for (const message of diagnostics) {
    expect(isPropertyProviderDiagnostic(message)).toBe(true);
    expect(userFacingPropertyMessage(message)).not.toMatch(/domain/i);
    expect(userFacingPropertyMessage(message)).toContain("enter the details manually");
  }
  const actionable = "Check the unit number before continuing.";
  const saved = [...diagnostics, actionable];
  expect(stripInternalRentalAppraisalWarnings(saved)).toEqual([actionable]);
  expect(stripInternalSalesAppraisalWarnings(saved)).toEqual([actionable]);
  expect(userFacingPropertyMessage(actionable)).toBe(actionable);
  expect(saved).toEqual([...diagnostics, actionable]);
});
