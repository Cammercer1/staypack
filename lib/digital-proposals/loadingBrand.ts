import { z } from "zod";
import { assetUrlSchema } from "./assets";

// This is the only information allowed in the loading screen before live access is checked.
export const loadingBrandSchema = z.object({
  name: z.string(), logoUrl: assetUrlSchema,
  primary: z.string().regex(/^#[\da-f]{6}$/i),
  primaryText: z.string().regex(/^#[\da-f]{6}$/i),
});
export type LoadingBrand = z.infer<typeof loadingBrandSchema>;
export const LOADING_BRAND_SELECT = "name:final_report_json->data->agency->>name,logoUrl:final_report_json->data->agency->>logoUrl,primary:final_report_json->brand->>primary,primaryText:final_report_json->brand->>primaryText";
