const RENTAL_INSPECTION_CTA = "Contact the agent to arrange an inspection and request rental details.";

/** Shared agency defaults can contain sales copy; keep rental brochures tenant-facing. */
export function resolveRentalInspectionCta(agencyCta?: string | null): string {
  const cta = agencyCta?.trim();
  if (!cta || /\bbuyers?\b|\bfor sale\b|\bpurchas(?:e|er|ers|ing)\b/i.test(cta)) {
    return RENTAL_INSPECTION_CTA;
  }
  return cta;
}
