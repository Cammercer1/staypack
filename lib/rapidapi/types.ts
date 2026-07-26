export type RapidApiReaAddress = {
  street?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  state?: string | null;
  show_address?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type RapidApiReaFeatureValue = {
  label?: string | null;
  type?: string | null;
  value?: number | null;
};

export type RapidApiReaAdvertiser = {
  id?: string | null;
  name?: string | null;
  agentId?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  profile_url?: string | null;
};

export type RapidApiReaListing = {
  listing_id?: string | number | null;
  channel?: string | null;
  url?: string | null;
  short_url?: string | null;
  self_url?: string | null;
  title?: string | null;
  description?: string | null;
  property_type?: string | null;
  construction_status?: string | null;
  price?: string | null;
  price_raw?: string | number | null;
  modified_date?: string | null;
  sold_date?: string | null;
  auction_time?: string | null;
  beds?: number | null;
  baths?: number | null;
  parking?: number | null;
  land_size?:
    | number
    | string
    | { value?: number | string | null; unit?: string | null; display?: string | null }
    | null;
  building_size?:
    | number
    | string
    | { value?: number | string | null; unit?: string | null; display?: string | null }
    | null;
  address?: RapidApiReaAddress | null;
  main_image?: string | null;
  images?: string[] | null;
  general_features?: {
    bedrooms?: RapidApiReaFeatureValue | number | null;
    bathrooms?: RapidApiReaFeatureValue | number | null;
    parkingSpaces?: RapidApiReaFeatureValue | number | null;
  } | null;
  is_sold?: boolean | null;
  is_rent?: boolean | null;
  is_buy?: boolean | null;
  advertisers?: RapidApiReaAdvertiser[] | null;
};

export type RapidApiReaSearchResponse = {
  message?: string;
  source?: string;
  total?: number;
  nextPage?: boolean;
  resultCount?: number;
  searchResults?: RapidApiReaListing[];
};

export type RapidApiReaDetailResponse = {
  message?: string;
  source?: string;
  detail?: RapidApiReaListing | null;
};
