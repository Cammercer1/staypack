export type ApifyReaAgentRecord = {
  name?: string;
  jobTitle?: string;
  phoneNumber?: string;
  emails?: string[];
  image?: string;
};

export type ApifyReaListingRecord = {
  source?: string;
  country?: string;
  listingId?: string;
  title?: string;
  propertyType?: string;
  channel?: string;
  status?: string;
  price?: string;
  address?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  carSpaces?: number | null;
  description?: string;
  isRent?: boolean;
  isBuy?: boolean;
  url?: string;
  images?: string[];
  agents?: ApifyReaAgentRecord[];
  originalSearchUrl?: string;
  listing?: {
    price?: {
      display?: string;
      value?: number;
      period?: string;
    };
  };
};
