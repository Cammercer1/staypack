import { z } from "zod";

// Accept Australian local numbers and explicit international numbers. Do not
// guess the country of an ambiguous number or imply that it is SMS-capable.
export function normalizeRecipientPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^0[23478]\d{8}$/.test(compact)) return `+61${compact.slice(1)}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

export const recipientSchema = z.object({
  mode: z.enum(["named", "general"]),
  contact_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  name: z.string().trim().max(200),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(50),
}).superRefine((value, ctx) => {
  if (value.mode === "general") return;
  if (!value.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Enter the client's name." });
  if (value.email && !z.email().safeParse(value.email).success)
    ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
  if (value.phone && !normalizeRecipientPhone(value.phone))
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter an Australian phone number or include the international + country code." });
});
export type RecipientValues = z.infer<typeof recipientSchema>;

export const generalRecipient: RecipientValues = { mode: "general", name: "", email: "", phone: "" };

export function recipientPayload(input: RecipientValues) {
  const value = recipientSchema.parse(input);
  if (value.mode === "general") return { mode: "general", contact_id: null, name: null, email: null, phone: null, phone_e164: null };
  return {
    mode: value.mode,
    contact_id: value.contact_id || null,
    name: value.name,
    email: value.email || null,
    phone: value.phone || null,
    phone_e164: value.phone ? normalizeRecipientPhone(value.phone) : null,
  };
}

export const createStrAppraisalSchema = z.object({
  listing_id: z.string().uuid(),
  request_id: z.string().uuid(),
  recipient: recipientSchema,
});
export const updateRecipientSchema = z.object({
  recipient: recipientSchema,
  expected_updated_at: z.string().datetime({ offset: true }),
});

export const appraisalQuerySchema = z.object({
  q: z.string().trim().max(160).default(""),
  status: z.enum(["all", "draft", "ready", "published", "failed", "archived"]).default("all"),
  listing_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type AppraisalQuery = z.infer<typeof appraisalQuerySchema>;
