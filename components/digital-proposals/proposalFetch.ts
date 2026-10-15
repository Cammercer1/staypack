export async function proposalFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({ error: "Your session may have expired. Reload and try again." }));
  if (!response.ok || typeof body.error === "string") throw new Error(body.error ?? "Unable to complete this request.");
  return body as T;
}
