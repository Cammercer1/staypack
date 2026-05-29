export const BUSINESS_CARD_VARIANT_IDS = ["front", "back"] as const;

export type BusinessCardVariantId = (typeof BUSINESS_CARD_VARIANT_IDS)[number];

export const BUSINESS_CARD_VARIANTS: Record<
  BusinessCardVariantId,
  { label: string; description: string }
> = {
  front: {
    label: "Front",
    description: "Logo, agent photo and primary contact details.",
  },
  back: {
    label: "Back",
    description: "Contact details, agency details and optional property QR.",
  },
};

export function normalizeBusinessCardVariantId(
  value: unknown,
): BusinessCardVariantId {
  return value === "back" ? "back" : "front";
}
