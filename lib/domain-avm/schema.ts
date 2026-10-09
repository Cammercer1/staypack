import { z } from "zod";
const number = z.number().finite().nonnegative().optional();
const confidence = z.enum(["high", "medium", "low"]);
export const domainAvmSchema = z.object({
  propertyId: z.string().optional(),
  urlSlug: z.string(),
  address: z.string(),
  propertyType: z.string().optional(),
  bedrooms: number,
  bathrooms: number,
  carSpaces: number,
  floorAreaSqm: number,
  landAreaSqm: number,
  valuation: z
    .object({
      lowerPrice: z.number(),
      midPrice: z.number(),
      upperPrice: z.number(),
      confidence,
      source: z.string().optional(),
      date: z.string().optional(),
    })
    .optional(),
  rentalEstimate: z
    .object({
      weeklyRent: z.number(),
      confidence,
      date: z.string().optional(),
      yieldPct: number,
    })
    .optional(),
  suburbMarket: z
    .object({
      medianSoldPrice: number,
      medianWeeklyRent: number,
      daysOnMarket: number,
    })
    .optional(),
  comparableSales: z.array(
    z.object({
      slug: z.string().optional(),
      address: z.string(),
      bedrooms: number,
      bathrooms: number,
      carSpaces: number,
      soldDate: z.string().optional(),
      soldPrice: number,
      imageUrl: z.string().optional(),
    }),
  ),
  matchedAt: z.string(),
});
