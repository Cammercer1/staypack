import { z } from "zod";
export const propertyMarketSchema = z.union([z.object({ country: z.literal("AU"), currency: z.literal("AUD"), rentPeriod: z.literal("week") }), z.object({ country: z.literal("US"), currency: z.literal("USD"), rentPeriod: z.literal("month") })]);
