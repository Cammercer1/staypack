import { propertyTypeFamily } from "@/lib/rental/computeRentBand";

type ReportableAreaInput = {
  propertyType?: string | null;
  landAreaSqm?: number | null;
  floorAreaSqm?: number | null;
};

/** Land/lot size is misleading for strata and attached housing. */
export function suppressSaleLandArea(propertyType?: string | null) {
  const family = propertyTypeFamily(propertyType ?? undefined);
  return family === "unit" || family === "townhouse";
}

export function reportableSaleLandArea(
  propertyType: string | null | undefined,
  landAreaSqm: number | null | undefined,
) {
  return suppressSaleLandArea(propertyType) ? null : landAreaSqm ?? null;
}

export function reportableSaleArea(input: ReportableAreaInput) {
  if (suppressSaleLandArea(input.propertyType)) {
    return input.floorAreaSqm != null && input.floorAreaSqm > 0
      ? { kind: "floor" as const, value: input.floorAreaSqm }
      : null;
  }

  if (input.landAreaSqm != null && input.landAreaSqm > 0) {
    return { kind: "land" as const, value: input.landAreaSqm };
  }
  if (input.floorAreaSqm != null && input.floorAreaSqm > 0) {
    return { kind: "floor" as const, value: input.floorAreaSqm };
  }
  return null;
}
