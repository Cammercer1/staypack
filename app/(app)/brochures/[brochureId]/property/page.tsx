import { notFound } from "next/navigation";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { brochureTypeSchema } from "@/lib/brochures/workspace";
import { BrochureProperty } from "@/components/brochures/BrochureProperty";
export default async function BrochurePropertyPage({ params }: { params: Promise<{ brochureId: string }> }) {
  const { brochureId } = await params;
  const { listing, collateral } = await requireCollateralAccess(brochureId).catch(() => notFound());
  if (!listing || !brochureTypeSchema.safeParse(collateral.type).success) notFound();
  return <BrochureProperty initialListing={listing} brochureId={brochureId} />;
}
