import type { ComponentType } from "react";
import type { CollateralType } from "@/lib/types";

export type CollateralPageFormatId =
  | "a4-portrait"
  | "a4-landscape"
  | "business-card-au";

export type CollateralBrandSlice = {
  name: string;
  logo_url: string;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  text_colour: string;
  background_colour: string;
  heading_font_family: string;
  body_font_family: string;
  font_family: string;
  heading_font_file_url: string;
  body_font_file_url: string;
  font_file_url: string;
  website_url: string;
  email: string;
  phone: string;
};

export type CollateralAgentSlice = {
  name: string;
  role_title: string;
  phone: string;
  email: string;
  photo_url: string;
};

export type CollateralListingSlice = {
  address: string;
  suburb: string;
  display_price: string;
  hero_image_url: string;
};

export type BusinessCardDocumentJson = {
  version: "business_card_v1";
  type: "agent_business_card";
  template_id: string;
  generated_at: string;
  agency: CollateralBrandSlice;
  listing: CollateralListingSlice;
  agent: CollateralAgentSlice;
  qr_target_url: string;
  assets: {
    qr_code_url: string;
  };
};

export type CollateralDocumentJson = BusinessCardDocumentJson;

export type CollateralTemplateProps = {
  document: CollateralDocumentJson;
};

export type CollateralTemplateDefinition = {
  id: string;
  collateralType: CollateralType;
  label: string;
  description: string;
  pageFormat: CollateralPageFormatId;
  pages: number;
  Component: ComponentType<CollateralTemplateProps>;
};

export type CollateralTemplateDefaults = Partial<Record<CollateralType, string>>;
