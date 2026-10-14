import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { CreateOptions } from "@/components/properties/CreateOptions";
import { PropertyContext } from "@/components/properties/PropertyContext";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ listing_id?: string }> }) {
  await requireAgency();
  const query = await searchParams;
  const listing = query.listing_id ? (await requireListingAccess(query.listing_id)).listing : null;
  return <div data-theme="staypack-workspace" className="max-w-6xl space-y-8 text-base-content">
    <header><h1 className="font-display text-3xl sm:text-4xl">{listing ? "Create another for this property" : "What would you like to create?"}</h1><p className="mt-3 text-base-content/65">{listing ? "Choose what to prepare next." : "Choose an output, then select or import your property."}</p></header>
    {listing && <PropertyContext listing={listing} />}
    <CreateOptions listingId={listing?.id} />
  </div>;
}
