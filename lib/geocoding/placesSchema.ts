import { z } from "zod";

export const addressSuggestionsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suggest"), country: z.enum(["AU", "US"]).default("AU"), input: z.string().trim().min(3).max(300), sessionToken: z.string().uuid() }),
  z.object({ action: z.literal("select"), country: z.enum(["AU", "US"]).default("AU"), placeId: z.string().min(1).max(500), address: z.string().trim().min(3).max(300), sessionToken: z.string().uuid() }),
]);
