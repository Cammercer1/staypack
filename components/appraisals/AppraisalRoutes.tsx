"use client";
import { createContext, useContext, type ReactNode } from "react";
const SharedAppraisalRoutes = createContext(false);
export function AppraisalRoutes({ children }: { children: ReactNode }) { return <SharedAppraisalRoutes.Provider value={true}>{children}</SharedAppraisalRoutes.Provider>; }
export function useAppraisalRoutes(reportId: string = "") {
  const shared = useContext(SharedAppraisalRoutes);
  return { api: `${shared ? "/api/appraisals" : "/api/str/appraisals"}/${reportId}`, editor: `${shared ? "/appraisals" : "/short-term-rentals/appraisals"}/${reportId}`, dashboard: shared ? "/appraisals" : "/short-term-rentals" };
}
