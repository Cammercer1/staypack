/** Provider diagnostics stay in source data and server logs, outside product copy. */
export function isPropertyProviderDiagnostic(message: string) {
  return /\bdomain(?:\.com\.au)?\b/i.test(message);
}

export function userFacingPropertyMessage(message: string) {
  return isPropertyProviderDiagnostic(message)
    ? "Property lookup is temporarily unavailable. Try again or enter the details manually."
    : message;
}
