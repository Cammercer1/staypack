import type { RentalComp } from "@/lib/rental/types";

/** Strata-style address e.g. 2/121 Alison Road, 401/2 Roscrea Avenue. */
const UNIT_ADDRESS_PATTERN = /\d+\s*\/\s*\d+/;

/**
 * REA often labels apartments as duplex/semi-detached. Infer unit from address when needed.
 */
export function resolveRentalCompPropertyType(comp: RentalComp): string | undefined {
  const address = comp.address?.trim() ?? "";
  if (UNIT_ADDRESS_PATTERN.test(address)) {
    return "Unit";
  }
  return comp.propertyType?.trim() || undefined;
}
