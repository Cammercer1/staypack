import Link from "next/link";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import type { Listing } from "@/lib/types";

export function PropertyContext({ listing, editHref, onEdit }: {
  listing: Pick<Listing, "id" | "property_address" | "hero_image_url">;
  editHref?: string;
  onEdit?: () => void;
}) {
  return <div data-theme="staypack-workspace" className="flex flex-wrap items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-4 text-base-content">
    <ListingThumbnail eager src={listing.hero_image_url} address={listing.property_address || "Property"} className="size-12 shrink-0" />
    <p className="min-w-0 flex-1 basis-40 font-medium">{listing.property_address || "Untitled property"}</p>
    {editHref && <Link href={editHref} className="du-btn du-btn-sm du-btn-ghost min-h-11">Edit details/photos</Link>}
    {onEdit && <button type="button" onClick={onEdit} className="du-btn du-btn-sm du-btn-ghost min-h-11">Edit details/photos</button>}
  </div>;
}

export function CreateAnother({ listingId }: { listingId: string }) {
  return <div data-theme="staypack-workspace" className="border-t border-base-300 pt-5 text-base-content">
    <Link href={`/create?listing_id=${encodeURIComponent(listingId)}`} className="du-btn du-btn-sm min-h-11">Create another for this property</Link>
  </div>;
}
