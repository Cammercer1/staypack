/** Redirects from public auth forms must stay on this application. */
export function safeAuthRedirect(value?: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/dashboard";
  return value;
}
