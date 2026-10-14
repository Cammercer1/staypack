import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { NewSocialFlow } from "@/components/social/NewSocialFlow";
export default async function NewSocialPage({ searchParams }: { searchParams: Promise<{ listing_id?: string }> }) {
  const { agency, user } = await requireAgency();
  const query = await searchParams;
  const listing = query.listing_id ? (await requireListingAccess(query.listing_id)).listing : null;
  return <NewSocialFlow initialListing={listing} storageKey={`property-import:${agency.id}:${user.id}`} />;
}
