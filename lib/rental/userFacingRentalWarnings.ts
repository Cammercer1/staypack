/** Operational scrape/enrich messages — not shown in product UI. */
export function isInternalRentalAppraisalWarning(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) {
    return true;
  }

  if (/^Rental appraisal\b/i.test(trimmed)) {
    return true;
  }

  if (/Apify|Bright\s*Data/i.test(trimmed)) {
    return true;
  }

  if (/Imported from realestate\.com\.au via/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function stripInternalRentalAppraisalWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !isInternalRentalAppraisalWarning(warning));
}
