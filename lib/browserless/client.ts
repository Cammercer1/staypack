import { isDevelopment } from "@/lib/env";

const DEFAULT_BASE_URL = "https://production-sfo.browserless.io";
const DEFAULT_TIMEOUT_MS = 60_000;

export function getBrowserlessApiKey() {
  return process.env.BROWSERLESS_API_KEY?.trim() ?? "";
}

export function getBrowserlessBaseUrl() {
  const configured = process.env.BROWSERLESS_BASE_URL?.trim();
  const raw = configured || DEFAULT_BASE_URL;

  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return raw.replace(/\/$/, "").split("?")[0]?.replace(/\/smart-scrape.*$/, "") ?? DEFAULT_BASE_URL;
  }
}

export function getBrowserlessTimeoutMs() {
  const configured = Number(process.env.BROWSERLESS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

export function hasBrowserlessConfig() {
  return Boolean(getBrowserlessApiKey());
}

export function buildBrowserlessUrl(
  path: string,
  query: Record<string, string | number> = {},
) {
  const baseUrl = getBrowserlessBaseUrl();
  const apiKey = getBrowserlessApiKey();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams({
    token: apiKey,
    ...Object.fromEntries(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    ),
  });

  return `${baseUrl}${normalizedPath}?${params.toString()}`;
}

export async function browserlessRequest(
  path: string,
  body: Record<string, unknown>,
  options?: {
    responseType?: "text" | "buffer" | "json";
    query?: Record<string, string | number>;
    errorContext?: "scrape" | "pdf";
  },
) {
  const apiKey = getBrowserlessApiKey();

  if (!apiKey) {
    if (isDevelopment()) {
      return null;
    }

    throw new Error("Listing import service is not configured");
  }

  const response = await fetch(
    buildBrowserlessUrl(path, options?.query),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(formatBrowserlessError(response.status, detail, options?.errorContext));
  }

  if (options?.responseType === "buffer") {
    return Buffer.from(await response.arrayBuffer());
  }

  if (options?.responseType === "json") {
    return response.json();
  }

  return response.text();
}

type SmartScrapeResponse = {
  ok?: boolean;
  content?: string | null;
  links?: string[];
  message?: string | null;
  strategy?: string;
};

export async function fetchSmartScrapeHtml(
  url: string,
  options?: { timeoutMs?: number },
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? getBrowserlessTimeoutMs();
  const payload = (await browserlessRequest(
    "/smart-scrape",
    {
      url,
      formats: ["html", "links"],
    },
    {
      responseType: "json",
      query: { timeout: timeoutMs },
    },
  )) as SmartScrapeResponse | null;

  if (!payload) {
    return null;
  }

  if (!payload.ok || !payload.content) {
    throw new Error(
      payload.message ??
        "Could not fetch the full listing page for this URL",
    );
  }

  return payload.content;
}

const DOMAIN_BROWSERLESS_TIMEOUT_MS = 22_000;

/** Full rendered HTML from headless Chrome — includes __NEXT_DATA__ script tags. */
export async function fetchBrowserlessContentHtml(
  url: string,
  options?: { timeoutMs?: number },
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? DOMAIN_BROWSERLESS_TIMEOUT_MS;

  const html = await browserlessRequest(
    "/content",
    {
      url,
      gotoOptions: {
        waitUntil: "networkidle2",
      },
      waitForSelector: {
        selector: "#__NEXT_DATA__",
        timeout: timeoutMs,
      },
    },
    {
      responseType: "text",
      query: { timeout: timeoutMs },
    },
  );

  return typeof html === "string" && html.trim() ? html : null;
}

type UnblockResponse = {
  content?: string | null;
};

/** Stealth browser fetch for bot-protected pages when /content is blocked. */
export async function fetchBrowserlessUnblockHtml(
  url: string,
  options?: { timeoutMs?: number },
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? DOMAIN_BROWSERLESS_TIMEOUT_MS;

  const payload = (await browserlessRequest(
    "/unblock",
    {
      url,
      content: true,
      ttl: timeoutMs,
      waitForSelector: {
        selector: "#__NEXT_DATA__",
        timeout: timeoutMs,
      },
    },
    {
      responseType: "json",
      query: { timeout: timeoutMs },
    },
  )) as UnblockResponse | null;

  if (!payload?.content?.trim()) {
    return null;
  }

  return payload.content;
}

function formatBrowserlessError(
  status: number,
  detail: string,
  context: "scrape" | "pdf" = "scrape",
) {
  const trimmedDetail = detail.trim().slice(0, 240);
  const label =
    context === "pdf" ? "PDF generation failed" : "Listing import failed";

  if (status === 401) {
    const authLabel =
      context === "pdf"
        ? "PDF generation authentication failed."
        : "Listing import authentication failed.";

    return [
      authLabel,
      "Check your Browserless settings and try again.",
      trimmedDetail ? `Response: ${trimmedDetail}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return trimmedDetail
    ? `${label} (${status}): ${trimmedDetail}`
    : `${label} (${status})`;
}
