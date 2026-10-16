import { z } from "zod";
import { normalizeRecipientPhone } from "@/lib/str-appraisals/validation";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the contact's name.").max(200),
  email: z.string().trim().max(254).default(""),
  phone: z.string().trim().max(50).default(""),
}).superRefine((value, ctx) => {
  if (value.email && !z.email().safeParse(value.email).success) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
  }
  if (value.phone && !normalizeRecipientPhone(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter an Australian phone number or include the international + country code." });
  }
});

export const updateClientSchema = clientSchema.safeExtend({
  archived: z.boolean(),
  expected_updated_at: z.string().datetime({ offset: true }),
});

export const clientQuerySchema = z.object({
  q: z.string().trim().max(254).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  archived: z.enum(["active", "archived", "all"]).default("active"),
});

export function clientPayload(value: z.infer<typeof clientSchema>) {
  return {
    name: value.name,
    email: value.email ? value.email.toLowerCase() : null,
    phone: value.phone || null,
    phone_e164: value.phone ? normalizeRecipientPhone(value.phone) : null,
  };
}
