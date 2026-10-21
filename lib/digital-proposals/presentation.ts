import type { ProposalData } from "./data";

export type ComparisonMode = "annual" | "monthly" | "yield";
export type ScenarioId = "ltr" | "market" | "managed";

export function managedScenarioLabel(data: ProposalData): string {
  return data.agency.name.trim() || "Professionally managed";
}

/** Presentation order only: keep the saved selection intact and preserve ties. */
export function comparablesByEstimate(data: ProposalData): ProposalData["comparables"] {
  const estimate = data.str.managed.annualRevenue ?? data.str.market.annualRevenue;
  const comparables = [...data.comparables];
  if (estimate === null) return comparables;
  return comparables.sort((a, b) => {
    if (a.annualRevenue === null) return b.annualRevenue === null ? 0 : 1;
    if (b.annualRevenue === null) return -1;
    return Math.abs(a.annualRevenue - estimate) - Math.abs(b.annualRevenue - estimate);
  });
}

export function comparisonRows(data: ProposalData, mode: ComparisonMode) {
  const value = data.property.estimatedValue;
  return ([
    { id: "ltr", label: "Long-term rental", annual: data.ltr.annualRent },
    { id: "market", label: "Market short-term rental", annual: data.str.market.annualRevenue },
    { id: "managed", label: managedScenarioLabel(data), annual: data.str.managed.annualRevenue },
  ] as const).filter(row => row.id !== "ltr" || row.annual !== null).map(row => ({ ...row, value: row.annual === null ? null
    : mode === "yield" ? value !== null && value > 0 ? row.annual / value * 100 : null
    : mode === "monthly" ? row.annual / 12 : row.annual }));
}
