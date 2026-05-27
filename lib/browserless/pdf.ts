import { createHash } from "crypto";
import { browserlessRequest } from "@/lib/browserless/client";
import { isDevelopment } from "@/lib/env";
import {
  getPdfOptionsForFormat,
  getReportPageFormat,
} from "@/lib/reports/pageFormat";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PDF_OPTIONS = getPdfOptionsForFormat(getReportPageFormat("portrait"));

export type PrintHtmlImageMirror = (
  sourceUrl: string,
  buffer: Buffer,
  contentType: string,
) => Promise<string | null>;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isPublicPrintUrl(url: string) {
  try {
    const { hostname, protocol } = new URL(url);
    return (
      protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "[::1]"
    );
  } catch {
    return false;
  }
}

function resolveAssetUrl(href: string, origin: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${origin}${href.startsWith("/") ? href : `/${href}`}`;
}

function absolutizeCssUrls(css: string, origin: string) {
  return css.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (_match, quote, path) => {
    return `url(${quote}${origin}${path}${quote})`;
  });
}

function replaceImageSrc(html: string, source: string, replacement: string) {
  return html
    .split(`src="${source}"`)
    .join(`src="${replacement}"`)
    .split(`src='${source}'`)
    .join(`src='${replacement}'`);
}

async function fetchStylesheetContent(href: string, origin: string) {
  const stylesheetUrl = resolveAssetUrl(href, origin);
  const response = await fetch(stylesheetUrl, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const css = await response.text();
  return absolutizeCssUrls(css, origin);
}

async function fetchImageBuffer(src: string) {
  const decodedSrc = decodeHtmlEntities(src);

  if (decodedSrc.startsWith("data:")) {
    return null;
  }

  try {
    const response = await fetch(decodedSrc, {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "image/*,*/*",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";

    return { buffer, contentType, decodedSrc };
  } catch {
    return null;
  }
}

async function mirrorImages(
  html: string,
  mirrorImage?: PrintHtmlImageMirror,
) {
  const sources = [
    ...new Set(
      [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(
        (match) => match[1],
      ),
    ),
  ];

  let preparedHtml = html;
  let mirroredCount = 0;
  let failedCount = 0;
  const sampleMirroredUrls: string[] = [];

  for (const src of sources) {
    const fetched = await fetchImageBuffer(src);

    if (!fetched || !mirrorImage) {
      failedCount += 1;
      continue;
    }

    const publicUrl = await mirrorImage(
      fetched.decodedSrc,
      fetched.buffer,
      fetched.contentType,
    );

    if (!publicUrl) {
      failedCount += 1;
      continue;
    }

    preparedHtml = replaceImageSrc(preparedHtml, src, publicUrl);
    mirroredCount += 1;

    if (sampleMirroredUrls.length < 2) {
      sampleMirroredUrls.push(publicUrl);
    }
  }

  return {
    html: preparedHtml,
    imageCount: sources.length,
    mirroredCount,
    failedCount,
    sampleMirroredUrls,
  };
}

async function inlineRemoteStylesheets(html: string, pageUrl: string) {
  const origin = new URL(pageUrl).origin;
  const stylesheetPattern =
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const hrefs = [...html.matchAll(stylesheetPattern)].map((match) => match[1]);
  const inlineStyles: string[] = [];

  for (const href of hrefs) {
    const css = await fetchStylesheetContent(href, origin);
    if (css) {
      inlineStyles.push(css);
    }
  }

  let preparedHtml = html.replace(stylesheetPattern, "");
  preparedHtml = preparedHtml.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    "",
  );
  preparedHtml = preparedHtml.replace(
    /<section[^>]*data-sonner-toaster[^>]*>[\s\S]*?<\/section>/gi,
    "",
  );

  const styleBlock = `<style>${inlineStyles.join("\n")}</style>`;
  preparedHtml = preparedHtml.includes("</head>")
    ? preparedHtml.replace("</head>", `${styleBlock}</head>`)
    : `${styleBlock}${preparedHtml}`;

  return {
    html: preparedHtml,
    stylesheetCount: hrefs.length,
    inlinedStylesheetCount: inlineStyles.length,
    inlinedCssBytes: inlineStyles.join("\n").length,
  };
}

async function preparePrintHtml(
  url: string,
  mirrorImage?: PrintHtmlImageMirror,
) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load print page (${response.status})`);
  }

  const html = await response.text();
  const withStyles = await inlineRemoteStylesheets(html, url);
  const withImages = await mirrorImages(withStyles.html, mirrorImage);

  return {
    html: withImages.html,
    stylesheetCount: withStyles.stylesheetCount,
    inlinedStylesheetCount: withStyles.inlinedStylesheetCount,
    inlinedCssBytes: withStyles.inlinedCssBytes,
    imageCount: withImages.imageCount,
    mirroredImageCount: withImages.mirroredCount,
    failedImageCount: withImages.failedCount,
    sampleMirroredUrls: withImages.sampleMirroredUrls,
  };
}

export function buildPdfImagePath(
  agencyId: string,
  reportId: string,
  sourceUrl: string,
  contentType: string,
) {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);

  return `${agencyId}/${reportId}/pdf-images/${hash}.${ext}`;
}

function buildBrowserlessPdfBody(html: string | null, url: string | null) {
  const base = {
    options: PDF_OPTIONS,
    emulateMediaType: "print",
    gotoOptions: {
      waitUntil: "networkidle0" as const,
      timeout: 60000,
    },
  };

  if (html) {
    return { ...base, html };
  }

  return { ...base, url: url! };
}

export async function renderPdfFromUrl(
  url: string,
  options?: { mirrorImage?: PrintHtmlImageMirror },
) {
  const usePublicUrl = isPublicPrintUrl(url);
  const prepared = usePublicUrl ? null : await preparePrintHtml(url, options?.mirrorImage);

  const body = buildBrowserlessPdfBody(
    prepared?.html ?? null,
    usePublicUrl ? url : null,
  );

  const pdf = await browserlessRequest("/pdf", body, { responseType: "buffer" });

  if (!pdf) {
    if (isDevelopment()) {
      return Buffer.from(`Mock PDF for ${url}`);
    }

    throw new Error("PDF generation is not configured");
  }

  return pdf;
}
