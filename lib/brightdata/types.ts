export type BrightDataReaAgent = {
  name?: string | null;
  link?: string | null;
  phone?: string | null;
  company_name?: string | null;
};

export type BrightDataReaRecord = {
  rea_property_id?: string;
  property_type?: string;
  state?: string;
  postcode?: string;
  bedrooms?: string | number;
  bathrooms?: string | number;
  parking?: number;
  street_address?: string;
  suburb?: string;
  fullSuburb?: string;
  url?: string;
  estimated_price?: string;
  listing_type?: string;
  rent_price?: number;
  rent_currency?: string;
  description?: string;
  images_urls?: string[];
  agents?: BrightDataReaAgent[];
  input?: { url?: string };
};
