import { rentForPeriod, weeklyToMonthly } from "@/lib/property-market";
import { formatCurrency } from "@/lib/reports/formatters";
import type { ProposalData } from "./data";

type TokenDefinition = { label: string; type: "text" | "currency" | "number"; read: (data: ProposalData) => string | number | null };
export const DATA_TOKENS = {
  "property.address": { label: "Property address", type: "text", read: d => d.property.address },
  "property.suburb": { label: "Suburb", type: "text", read: d => d.property.suburb },
  "property.bedrooms": { label: "Bedrooms", type: "number", read: d => d.property.bedrooms },
  "property.bathrooms": { label: "Bathrooms", type: "number", read: d => d.property.bathrooms },
  "property.carSpaces": { label: "Car spaces", type: "number", read: d => d.property.carSpaces },
  "property.estimatedValue": { label: "Estimated property value", type: "currency", read: d => d.property.estimatedValue },
  "recipient.displayName": { label: "Customer name", type: "text", read: d => d.recipient?.displayName ?? null },
  "agency.name": { label: "Agency name", type: "text", read: d => d.agency.name },
  "agent.name": { label: "Agent name", type: "text", read: d => d.agent.name },
  "ltr.rent": { label: "Estimated local-period LTR", type: "currency", read: d => d.ltr.weeklyRent == null ? null : rentForPeriod(d.ltr.weeklyRent, d.market) },
  "ltr.monthlyRent": { label: "Estimated monthly LTR", type: "currency", read: d => d.ltr.weeklyRent == null ? null : weeklyToMonthly(d.ltr.weeklyRent) },
  "ltr.weeklyRent": { label: "Estimated weekly LTR", type: "currency", read: d => d.ltr.weeklyRent },
  "ltr.annualRent": { label: "Estimated annual LTR", type: "currency", read: d => d.ltr.annualRent },
  "str.market.annualRevenue": { label: "Market estimated gross STR revenue", type: "currency", read: d => d.str.market.annualRevenue },
  "str.managed.annualRevenue": { label: "Managed estimated gross STR revenue", type: "currency", read: d => d.str.managed.annualRevenue },
} satisfies Record<string, TokenDefinition>;
export type DataToken = keyof typeof DATA_TOKENS;
export function isDataToken(key: string): key is DataToken { return Object.hasOwn(DATA_TOKENS, key); }
export function readToken(key: DataToken, data: ProposalData) { return DATA_TOKENS[key].read(data); }
export function formatToken(key: DataToken, data: ProposalData) {
  const value = readToken(key, data);
  if (value === null || value === "") return null;
  return DATA_TOKENS[key].type === "currency" ? formatCurrency(Number(value), data.market?.currency) : String(value);
}

/** Plain text only: no HTML, eval, nested object access or recursive token expansion. */
export function resolveTokenText(template: string, data: ProposalData) {
  const unknown = new Set<string>();
  const missing = new Set<DataToken>();
  const text = template.split("\n").map(line => {
    let hideLine = false;
    const result = line.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, raw: string) => {
      const key = raw.trim();
      if (!isDataToken(key)) { unknown.add(key); hideLine = true; return ""; }
      const value = formatToken(key, data);
      if (value === null) { missing.add(key); hideLine = true; return ""; }
      return value;
    });
    // Catch incomplete tokens too, while permitting ordinary punctuation/braces.
    if (result.includes("{{") || result.includes("}}")) { unknown.add("Incomplete data token"); hideLine = true; }
    return hideLine ? "" : result;
  }).filter(Boolean).join("\n");
  return { text, unknown: [...unknown], missing: [...missing] };
}
