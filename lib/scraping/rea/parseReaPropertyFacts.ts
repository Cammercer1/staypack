type UnknownRecord = Record<string, unknown>;

type LocatedField = {
  value: unknown;
  unit?: unknown;
};

const SOLD_DATE_KEYS = new Set([
  "soldat",
  "solddate",
  "datesold",
  "salesdate",
]);

const LAND_AREA_KEYS = new Set([
  "landarea",
  "landareasqm",
  "landsize",
  "landspacesqm",
  "lotsize",
  "lotsizesqm",
  "propertysize",
  "propertysizesqm",
]);

const FLOOR_AREA_KEYS = new Set([
  "buildingarea",
  "buildingareasqm",
  "buildingsize",
  "floorarea",
  "floorareasqm",
  "floorsize",
  "internalarea",
  "internalareasqm",
  "internalfloorsize",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function siblingUnit(record: UnknownRecord, fieldKey: string) {
  const normalizedField = normalizeKey(fieldKey).replace(/sqm$/, "");
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (
      normalized === `${normalizedField}unit` ||
      normalized === `${normalizedField}units` ||
      normalized === `${normalizedField}measurement`
    ) {
      return value;
    }
  }
  return undefined;
}

function findField(
  value: unknown,
  keys: Set<string>,
  depth = 0,
): LocatedField | undefined {
  if (depth > 4 || value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) {
      const found = findField(item, keys, depth + 1);
      if (found) return found;
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    if (keys.has(normalizeKey(key)) && fieldValue != null) {
      return {
        value: fieldValue,
        unit: siblingUnit(value, key),
      };
    }
  }

  for (const fieldValue of Object.values(value)) {
    const found = findField(fieldValue, keys, depth + 1);
    if (found) return found;
  }

  return undefined;
}

function dateString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  if (isRecord(value)) {
    for (const key of ["value", "date", "display", "formatted"]) {
      const nested = dateString(value[key]);
      if (nested) return nested;
    }
  }

  return undefined;
}

function areaUnitFromValue(value: UnknownRecord) {
  for (const key of ["unit", "units", "measurement", "areaUnit", "sizeUnit"]) {
    const unit = value[key];
    if (typeof unit === "string" && unit.trim()) {
      return unit;
    }
  }
  return undefined;
}

function areaScalar(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!match) return undefined;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (isRecord(value)) {
    for (const key of ["value", "size", "area", "amount", "display"]) {
      const scalar = areaScalar(value[key]);
      if (scalar != null) return scalar;
    }
  }
  return undefined;
}

function normalizeAreaSqm(value: unknown, unitHint?: unknown): number | undefined {
  const scalar = areaScalar(value);
  if (scalar == null || scalar <= 0) {
    return undefined;
  }

  const embeddedUnit =
    typeof value === "string"
      ? value
      : isRecord(value)
        ? areaUnitFromValue(value)
        : undefined;
  const unit = String(embeddedUnit ?? unitHint ?? "sqm")
    .trim()
    .toLowerCase()
    .replace(/²/g, "2");

  let sqm = scalar;
  if (/\b(?:ha|hectare|hectares)\b/.test(unit)) {
    sqm *= 10_000;
  } else if (/\b(?:acre|acres)\b/.test(unit)) {
    sqm *= 4046.8564224;
  } else if (/\b(?:sq\s*ft|sqft|ft2|square\s+feet|square\s+foot)\b/.test(unit)) {
    sqm *= 0.09290304;
  }

  if (!Number.isFinite(sqm) || sqm <= 0 || sqm > 100_000_000) {
    return undefined;
  }

  return Math.round(sqm * 100) / 100;
}

function resolveArea(value: unknown, keys: Set<string>): number | undefined {
  const found = findField(value, keys);
  return found ? normalizeAreaSqm(found.value, found.unit) : undefined;
}

/** Sold date as supplied by the REA provider, including nested result shapes. */
export function resolveReaSoldDate(value: unknown): string | undefined {
  const found = findField(value, SOLD_DATE_KEYS);
  return found ? dateString(found.value) : undefined;
}

/** Land/lot area normalized to square metres. */
export function resolveReaLandAreaSqm(value: unknown): number | undefined {
  return resolveArea(value, LAND_AREA_KEYS);
}

/** Internal/floor/building area normalized to square metres. */
export function resolveReaFloorAreaSqm(value: unknown): number | undefined {
  return resolveArea(value, FLOOR_AREA_KEYS);
}
