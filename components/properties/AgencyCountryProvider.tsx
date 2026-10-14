"use client";
import { createContext, useContext } from "react";
import type { AgencyCountry } from "@/lib/property-market/agencyCountry";
const Context = createContext<AgencyCountry>("AU");
export function AgencyCountryProvider({ country, children }: { country: AgencyCountry; children: React.ReactNode }) {
  return <Context.Provider value={country}>{children}</Context.Provider>;
}
export function useAgencyCountry() { return useContext(Context); }
