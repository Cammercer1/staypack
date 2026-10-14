import { z } from "zod";
export const assetUrlSchema = z.string().refine(value => {
  if (value === "" || /^\/(?!\/)/.test(value)) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "Use a local asset path or an HTTP(S) URL.");
