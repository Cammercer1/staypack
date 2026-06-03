import type { RentBandResult } from "@/lib/rental/computeRentBand";
import type { SuburbRentFloor } from "@/lib/rental/resolveSuburbRentFloor";

/** Lift band so weeklyMin is not below suburb benchmark; widen max slightly when adjusted. */
export function applyRentBandSuburbFloor(
  band: RentBandResult,
  floor: SuburbRentFloor | null,
): RentBandResult {
  if (!floor || floor.weeklyRent <= 0) {
    return band;
  }

  const targetMin = Math.round(floor.weeklyRent);
  if (band.weeklyMin >= targetMin * 0.98) {
    return band;
  }

  const weeklyMin = targetMin;
  const weeklyMax = Math.max(
    band.weeklyMax,
    Math.round(targetMin * 1.08),
    band.weeklyMidpoint,
  );
  const weeklyMidpoint = Math.round((weeklyMin + weeklyMax) / 2);

  return {
    ...band,
    weeklyMin,
    weeklyMax,
    weeklyMidpoint,
  };
}
