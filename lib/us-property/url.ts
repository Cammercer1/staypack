export function zillowPropertyId(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:" || !/^(www\.)?zillow\.com$/.test(parsed.hostname) || parsed.username || parsed.password) return null;
  return parsed.pathname.match(/\/(\d+)_zpid\/?$/)?.[1] ?? null;
}

/** Allow the ordinary browser/share URL to be pasted into the address box. */
export function pastedListingUrl(value: string) {
  const input = value.trim();
  if (/^https?:\/\//i.test(input)) return input;
  if (/^(?:www\.)?zillow\.com\//i.test(input)) return `https://${input}`;
  return null;
}

export function isZillowUrl(value: string) {
  try {
    const url = new URL(value);
    return /^(www\.)?zillow\.com$/.test(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
