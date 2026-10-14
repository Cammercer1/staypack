import { z } from "zod";

export const propertyCandidateSchema = z.object({
  source: z.enum(["domain", "google", "zillow"]),
  country: z.enum(["AU", "US"]).optional(),
  zpid: z.string().regex(/^\d+$/).optional(),
  address: z.string().trim().min(1).max(300),
  streetAddress: z.string().trim().min(1).max(250),
  suburb: z.string().max(120).default(""),
  state: z.string().max(20).default(""),
  postcode: z.string().max(10).default(""),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(300)
    .optional(),
  placeId: z.string().max(500).optional(),
  partialMatch: z.boolean().optional(),
});
export type PropertyCandidate = z.infer<typeof propertyCandidateSchema>;

export const lookupMediaSchema = z.object({
  url: z.string().url(),
  role: z.enum(["photo", "floor_plan"]),
  date: z.string().optional(),
  current: z.boolean(),
});
export type LookupMedia = z.infer<typeof lookupMediaSchema>;

export const propertyLookupSourceSchema = z.object({
  source: z.enum(["domain", "google", "url", "zillow"]),
  matchedAt: z.string(),
  zpid: z.string().regex(/^\d+$/).optional(),
  profileSlug: z.string().optional(),
  activeListingId: z.number().optional(),
  agencyName: z.string().optional(),
  features: z.array(z.string()).optional(),
  advertisedSalePrice: z.string().nullable().optional(),
  advertisedWeeklyRent: z.string().nullable().optional(),
  media: z.array(lookupMediaSchema),
  originalAgents: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        photo_url: z.string().optional(),
        role_title: z.string().optional(),
      }),
    )
    .optional(),
});
export type PropertyLookupSource = z.infer<typeof propertyLookupSourceSchema>;

export type ExistingProperty = {
  country?: string | null;
  id: string;
  property_address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
};
