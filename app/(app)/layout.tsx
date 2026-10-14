import { AppShell } from "@/components/app-shell/AppShell";

import { requireUser, getAgencyMembership } from "@/lib/auth/requireUser";
import { AgencyCountryProvider } from "@/components/properties/AgencyCountryProvider";
import { agencyCountry } from "@/lib/property-market/agencyCountry";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  const membership = await getAgencyMembership(user.id);
  return <AgencyCountryProvider country={agencyCountry(membership?.agency ?? {})}><AppShell>{children}</AppShell></AgencyCountryProvider>;
}
