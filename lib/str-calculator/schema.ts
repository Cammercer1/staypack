import { z } from "zod";
import { calculateAccommodates } from "@/lib/reports/formatters";
import type { ReportActivity } from "./enquiryProgress";

export const calculatorFieldsSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your full name.").max(200, "Use 200 characters or fewer."),
  address: z.string().trim().min(10, "Enter the full street address, suburb and postcode.").max(300),
  bedrooms: z.number().int().min(0, "Choose the number of bedrooms.").max(10),
  bathrooms: z.number().min(0.5, "Choose the number of bathrooms.").max(20).multipleOf(0.5),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address.")),
  phone: z.string().trim().max(32).refine(value => !value || (/^\+?[\d\s().-]+$/.test(value) && /^\d{7,15}$/.test(value.replace(/\D/g, ""))), "Enter a valid phone number or leave it blank.").optional(),
  consent: z.boolean().refine(value => value, "Please agree before viewing your estimate."),
  website: z.string().max(0).default(""),
});
// Open embeds from before name collection can still finish their enquiry.
export const calculatorSubmissionSchema = calculatorFieldsSchema.extend({ full_name: calculatorFieldsSchema.shape.full_name.optional(), requestId: z.uuid() }).strict();
export const calculatorSettingsSchema = z.object({ enabled: z.boolean(), country: z.enum(["AU", "US"]), ask_phone: z.boolean().optional() }).strict();
export type CalculatorFields = z.input<typeof calculatorFieldsSchema>;
export type CalculatorSubmission = z.infer<typeof calculatorSubmissionSchema>;
export type CalculatorSettings = { id: string; public_token: string; enabled: boolean; country: "AU" | "US"; ask_phone: boolean };
export const calculatorEstimateSchema = z.object({
  annualRevenue: z.number().positive(), monthlyRevenue: z.number().positive(),
  nightlyRate: z.number().positive(), occupancyRate: z.number().positive().max(100),
  currency: z.enum(["AUD", "USD"]), address: z.string(), bedrooms: z.number(), bathrooms: z.number(), guests: z.number(),
});
export type CalculatorEstimate = z.infer<typeof calculatorEstimateSchema>;
export type CalculatorLead = {
  id: string; address: string; bedrooms: number; email: string; phone: string | null; country: string;
  full_name?: string | null; contact_id?: string | null;
  status: "processing" | "estimated" | "failed"; estimate_json: CalculatorEstimate | null; created_at: string;
  report_id?: string | null;
  report_activity?: ReportActivity | null;
};

export const CALCULATOR_CONSENT_VERSION = "str-calculator-v3";
export const calculatorConsent = (agencyName: string, askPhone = false) =>
  `I agree to ${agencyName} receiving my ${askPhone ? "name, email, phone" : "name, email"} and property details and contacting me about this estimate.`;

/** Match report defaults so the same property can reuse its calculator estimate. */
export function calculatorAssumptions(bedrooms: number) {
  return { guests: calculateAccommodates(bedrooms), radiusM: 2000 };
}

export function calculatorMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
