type AddressInput = {
  property_address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
};

export function buildAddressQuery(input: AddressInput) {
  const parts = [
    input.property_address,
    input.suburb,
    input.state,
    input.postcode,
    input.country ?? "Australia",
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  return parts.join(", ");
}

export function hasGeocodableAddress(input: AddressInput) {
  return Boolean(buildAddressQuery(input));
}
