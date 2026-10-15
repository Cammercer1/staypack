function responseError(response: Response) {
  if (response.status === 403) return "You don’t have permission to complete this request.";
  if (response.status === 408 || response.status === 504) return "The request timed out. Please try again shortly.";
  if (response.status === 429) return "Too many requests. Please wait a moment and try again.";
  if (response.status === 502 || response.status === 503) return "The service is temporarily unavailable. Please try again shortly.";
  if (response.status >= 500) return "The service could not complete this request. Please try again.";
  return "The server returned an unexpected response. Please try again.";
}

export async function proposalFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 401 || (response.redirected && /^\/login(?:\/|$)/.test(new URL(response.url).pathname))) throw new Error("Your session has expired. Reload and sign in again.");
  const body: unknown = await response.json().catch(() => null);
  const error = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : null;
  if (!response.ok || error !== null || body === null) throw new Error(error ?? responseError(response));
  return body as T;
}
