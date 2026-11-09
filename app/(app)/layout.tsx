import { AppShell } from "@/components/app-shell/AppShell";

import { requireUser, getAgencyMembership } from "@/lib/auth/requireUser";
import { AgencyCountryProvider } from "@/components/properties/AgencyCountryProvider";
import { agencyCountry } from "@/lib/property-market/agencyCountry";
import { Suspense } from "react";
import Loading from "./loading";

async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const membership = await getAgencyMembership(user.id);
  return <AgencyCountryProvider country={agencyCountry(membership?.agency ?? {})}>{children}</AgencyCountryProvider>;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The shared navigation can paint while authentication and private data load.
  // All account data remains inside the authenticated server boundary.
  return <AppShell><Suspense fallback={<Loading />}><AuthenticatedWorkspace>{children}</AuthenticatedWorkspace></Suspense></AppShell>;
}
