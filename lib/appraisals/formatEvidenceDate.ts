const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Evidence dates describe a calendar day, not an instant in the viewer's timezone. */
export function formatEvidenceDate(value: string, includeDay = true): string {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?=$|[Tt ]\d{2}:)/.exec(text);
  const dayFirst = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(text);
  const monthFirst = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  const monthName = (dayFirst?.[2] ?? monthFirst?.[1] ?? "").toLowerCase();
  const month = iso ? Number(iso[2]) - 1 : months.findIndex(name => name === monthName || name.slice(0, 3) === monthName || (name === "september" && monthName === "sept"));
  const year = Number(iso?.[1] ?? dayFirst?.[3] ?? monthFirst?.[3]);
  const day = Number(iso?.[3] ?? dayFirst?.[1] ?? monthFirst?.[2]);
  if (!Number.isInteger(year) || month < 0 || month > 11 || !Number.isInteger(day)) return value;
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return value;
  return new Intl.DateTimeFormat("en-AU", { ...(includeDay ? { day: "numeric" as const } : {}), month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
