const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchStaticHtml(url: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch listing (${response.status})`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
