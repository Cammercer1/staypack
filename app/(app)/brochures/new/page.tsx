import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { brochureTypeSchema } from "@/lib/brochures/workspace";
import { NewBrochureFlow } from "@/components/brochures/NewBrochureFlow";
export default async function NewBrochurePage({ searchParams }: { searchParams: Promise<{ listing_id?: string; type?: string }> }) {
  const { agency, user } = await requireAgency();
  const query = await searchParams;
  const type = brochureTypeSchema.safeParse(query.type);
  const listing = query.listing_id ? (await requireListingAccess(query.listing_id)).listing : null;
  return <NewBrochureFlow initialListing={listing} initialType={type.success ? type.data : undefined} storageKey={`property-import:${agency.id}:${user.id}`} />;
}
