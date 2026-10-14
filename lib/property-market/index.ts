import { formatCurrency } from "@/lib/reports/formatters";
/** Legacy records without a country/market retain Australia's existing conventions. */
export type PropertyMarket = { country: "AU" | "US"; currency: "AUD" | "USD"; rentPeriod: "week" | "month" };
export function marketForCountry(country?: string | null): PropertyMarket {
  return /^(us|usa|united states(?: of america)?)$/i.test(country?.trim() ?? "")
    ? { country: "US", currency: "USD", rentPeriod: "month" }
    : { country: "AU", currency: "AUD", rentPeriod: "week" };
}
export const countryName = (country?: string | null) => marketForCountry(country).country === "US" ? "United States" : "Australia";
// Existing database columns and appraisal arithmetic remain weekly. Never round conversions.
export const monthlyToWeekly = (monthly: number) => monthly * 12 / 52;
export const weeklyToMonthly = (weekly: number) => weekly * 52 / 12;
export const rentForPeriod = (weekly: number, market?: PropertyMarket) => market?.rentPeriod === "month" ? weeklyToMonthly(weekly) : weekly;
export const rentFromPeriod = (amount: number, market?: PropertyMarket) => market?.rentPeriod === "month" ? monthlyToWeekly(amount) : amount;
export function money(value: number | null | undefined, market?: PropertyMarket) {
  return formatCurrency(value, market?.currency);
}
export function rentRange(min: number, max: number, market?: PropertyMarket) {
  const low = money(rentForPeriod(min, market), market);
  const high = money(rentForPeriod(max, market), market);
  return `${low === high ? low : `${low} – ${high}`} per ${market?.rentPeriod ?? "week"}`;
}
