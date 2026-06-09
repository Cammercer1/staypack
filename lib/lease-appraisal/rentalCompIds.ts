export function rentalCompListingId(
  comp: { listingUrl?: string; address: string },
  index: number,
) {
  if (comp.listingUrl?.trim()) {
    return comp.listingUrl.trim();
  }
  return `comp-${index}-${comp.address.slice(0, 48)}`;
}
