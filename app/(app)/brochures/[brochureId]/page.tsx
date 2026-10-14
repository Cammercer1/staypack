import { PropertyContext } from "@/components/properties/PropertyContext";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { brochureLabels, brochureTypeSchema } from "@/lib/brochures/workspace";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import { SalesBrochureWizard } from "@/components/collateral/sales-brochure/SalesBrochureWizard";
export default async function BrochurePage({ params }: { params: Promise<{ brochureId: string }> }) {
  const { brochureId } = await params;
  const { supabase, agency, listing, collateral } = await requireCollateralAccess(brochureId).catch(() => notFound());
  const type = brochureTypeSchema.safeParse(collateral.type);
  if (!listing || !type.success) notFound();
  const [templates, agents] = await Promise.all([resolveAvailableTemplates(agency, type.data), loadAgencyAgentProfiles(supabase, agency.id)]);
  return <div data-theme="staypack-workspace" className="space-y-6 text-base-content">
    <Link href="/brochures" className="inline-flex min-h-10 items-center text-sm">← Brochures</Link>
    <h1 className="font-display text-3xl">{brochureLabels[type.data]}</h1>
    <PropertyContext listing={listing} editHref={`/brochures/${collateral.id}/property`} />
    <SalesBrochureWizard key={collateral.id} initialListing={listing} initialCollateral={collateral} agency={agency} collateralType={type.data} initialAgencyAgents={agents} availableTemplates={{ default_template_id: templates.defaultTemplateId, templates: templates.templates.map(serializeTemplateForApi) }} />
  </div>;
}
