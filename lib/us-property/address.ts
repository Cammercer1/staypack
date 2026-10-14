const unitPattern = /(?:\b(?:apartment|apt|unit|suite|ste)(?=\.|\s|#|\d)\.?\s*#?\s*|#\s*)((?:penthouse|ph)\s+\d+[a-z]?|[a-z0-9]+(?:-[a-z0-9]+)?)(?=\s|,|$)/i;
const normaliseUnit = (unit: string) => unit.toLowerCase().replace(/^penthouse\s+/, "ph").replace(/\s+/g, "");

export function usUnit(value: string) {
  const unit = value.match(unitPattern)?.[1];
  return unit ? normaliseUnit(unit) : undefined;
}

/** Keep a unit written after a comma, as well as one on the street line. */
export function usStreetAddress(value: string) {
  const [street, next = ""] = value.trim().split(/[,\n]/);
  return /^\s*(?:apartment\b|apt\b|unit\b|suite\b|ste\b|#)/i.test(next)
    ? `${street.trim()} ${next.trim()}`
    : street.trim();
}

export function normaliseUsStreet(value: string) {
  const words: Record<string, string> = {
    street: "st", drive: "dr", avenue: "ave", boulevard: "blvd", road: "rd",
    lane: "ln", court: "ct", place: "pl", terrace: "ter", circle: "cir",
    parkway: "pkwy", highway: "hwy", north: "n", south: "s", east: "e", west: "w",
    northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
    apartment: "unit", apt: "unit", suite: "unit", ste: "unit",
  };
  return usStreetAddress(value).replace(unitPattern, (_match, unit: string) => ` unit ${normaliseUnit(unit)}`)
    .toLowerCase().replace(/#/g, " unit ").replace(/\./g, "")
    .replace(/\b\w+\b/g, (word) => words[word] ?? word)
    .replace(/\s+/g, " ").replace(/\bunit(?: unit)+\b/g, "unit").trim();
}

const direction = /^(\d+[a-z-]*\s+)(n|s|e|w|ne|nw|se|sw)\s+/;
const withoutDirection = (street: string) => street.replace(direction, "$1");
const baseStreet = (value: string) => normaliseUsStreet(value).split(" unit ")[0];

/** Restore an explicitly typed unit/direction only on the same suggested street. */
export function preserveUsStreet(input: string, suggested: string): string | null {
  const typedBase = baseStreet(input);
  const suggestedBase = baseStreet(suggested);
  const typedUnit = usUnit(input);
  const suggestedUnit = usUnit(suggested);
  const typedDirection = typedBase.match(direction)?.[2];
  const suggestedDirection = suggestedBase.match(direction)?.[2];
  const sameBase = withoutDirection(typedBase) === withoutDirection(suggestedBase) ||
    withoutDirection(typedBase).startsWith(`${withoutDirection(suggestedBase)} `);
  if (typedDirection && suggestedDirection && typedDirection !== suggestedDirection) return null;
  if (typedUnit && (!sameBase || (suggestedUnit && typedUnit !== suggestedUnit))) return null;
  let street = usStreetAddress(suggested);
  if (sameBase && typedDirection && !suggestedDirection) {
    street = street.replace(/^(\d+[a-z-]*\s+)/i, `$1${typedDirection.toUpperCase()} `);
  }
  if (typedUnit && !suggestedUnit) street += ` Apt ${typedUnit.toUpperCase()}`;
  return street;
}

/** A search result is a choice to review; never suggest a different apartment. */
export function matchesUsSearch(input: string, street: string, state: string, zip: string) {
  if (usUnit(input) !== usUnit(street)) return false;
  const preserved = preserveUsStreet(input, street);
  if (!preserved) return false;
  const typed = withoutDirection(baseStreet(input));
  const found = withoutDirection(baseStreet(preserved));
  if (typed !== found && !typed.startsWith(`${found} `)) return false;
  const region = input.match(/\b([a-z]{2})[\s,]+(\d{5})(?:-\d{4})?\b/i);
  return !region || (region[1].toUpperCase() === state && region[2] === zip.slice(0, 5));
}
