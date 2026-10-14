import { z } from "zod";
const band = z.object({ mid: z.number().positive(), low: z.number().positive().optional(), high: z.number().positive().optional() });
export const usPropertySchema = z.object({
  address: z.object({ streetAddress: z.string(), city: z.string(), state: z.string(), zipcode: z.string() }),
  zpid: z.string().regex(/^\d+$/), currency: z.literal("USD"), observedAt: z.string(),
  homeStatus: z.string(), valuation: band.optional(), rentMonthly: band.optional(),
  lastSold: z.object({ price: z.number().positive(), date: z.string().optional() }).optional(),
  // Original provider evidence, distinct from reviewed fields and report overrides.
  raw: z.record(z.string(), z.unknown()),
});
export type UsProperty = z.infer<typeof usPropertySchema>;
