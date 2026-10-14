import { PropertyEditor } from "@/components/properties/PropertyEditor";
import type { Listing } from "@/lib/types";
export function BrochureProperty({ initialListing, brochureId }: { initialListing: Listing; brochureId: string }) {
  return <PropertyEditor initialListing={initialListing} returnPath={`/brochures/${brochureId}`} returnLabel="brochure" />;
}
