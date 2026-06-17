import { createHash } from "crypto";
import { browserlessRequest } from "@/lib/browserless/client";
import { isDevelopment } from "@/lib/env";
import {
  getCollateralPageFormat,
  getPdfOptionsForCollateralFormat,
} from "@/lib/collateral/pageFormat";
import {
  getPdfOptionsForFormat,
  getReportPageFormat,
} from "@/lib/reports/pageFormat";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEFAULT_PDF_OPTIONS = getPdfOptionsForFormat(getReportPageFormat("portrait"));

export type PrintHtmlAssetMirror = (
  sourceUrl: string,
  buffer: Buffer,
  contentType: string,
) => Promise<string | null>;

export type PrintHtmlImageMirror = PrintHtmlAssetMirror;

export type PrintHtmlStylesheetMirror = PrintHtmlAssetMirror;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

async function fetchImageBuffer(src: string, pageOrigin: string) {
  const decodedSrc = decodeHtmlEntities(src);

  if (decodedSrc.startsWith("data:")) {
    return null;
  }

  const fetchUrl = resolveAssetUrl(decodedSrc, pageOrigin);

  try {
    const response = await fetch(fetchUrl, {
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
  pageOrigin: string,
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
    const fetched = await fetchImageBuffer(src, pageOrigin);

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

const MAX_INLINE_STYLESHEET_BYTES = 8_000;

function extractGoogleFontsUrl(html: string): string | null {
  const match = html.match(
    /href=["'](https:\/\/fonts\.googleapis\.com\/css[^"']+)["']/i,
  );
  return match ? decodeHtmlEntities(match[1]) : null;
}

function extractPrintRootHtml(html: string) {
  const reportRoot = html.match(
    /<div class="report-print-root[\s\S]*?(?=<\/body>)/,
  )?.[0];
  if (reportRoot) {
    return reportRoot;
  }

  const collateralRoot = html.match(
    /<div class="collateral-print-root[\s\S]*?(?=<\/body>)/,
  )?.[0];
  if (collateralRoot) {
    return collateralRoot;
  }

  const dataRoot = html.match(
    /<div[^>]+data-report-root[\s\S]*?(?=<\/body>)/,
  )?.[0];
  if (dataRoot) {
    return dataRoot;
  }

  return null;
}

async function preparePrintStyles(
  html: string,
  pageUrl: string,
  mirrorStylesheet?: PrintHtmlStylesheetMirror,
) {
  const origin = new URL(pageUrl).origin;
  const stylesheetPattern =
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const hrefs = [...html.matchAll(stylesheetPattern)].map((match) => match[1]);
  const inlineStyles: string[] = [];
  const linkedStyles: string[] = [];
  let linkedStylesheetCount = 0;
  let inlinedStylesheetCount = 0;

  for (const href of hrefs) {
    const stylesheetUrl = resolveAssetUrl(decodeHtmlEntities(href), origin);
    const response = await fetch(stylesheetUrl, { cache: "no-store" });

    if (!response.ok) {
      continue;
    }

    const cssBuffer = Buffer.from(await response.arrayBuffer());
    const cssText = cssBuffer.toString("utf8");

    if (
      stylesheetUrl.includes("fonts.googleapis.com") ||
      stylesheetUrl.includes("use.typekit.net")
    ) {
      inlineStyles.push(cssText);
      inlinedStylesheetCount += 1;
      continue;
    }

    if (mirrorStylesheet) {
      const publicUrl = await mirrorStylesheet(
        stylesheetUrl,
        cssBuffer,
        "text/css",
      );

      if (publicUrl) {
        linkedStyles.push(publicUrl);
        linkedStylesheetCount += 1;
        continue;
      }
    }

    if (cssText.length <= MAX_INLINE_STYLESHEET_BYTES) {
      inlineStyles.push(absolutizeCssUrls(cssText, origin));
      inlinedStylesheetCount += 1;
    }
  }

  const embeddedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n");

  return {
    inlineStyles: [embeddedStyles, ...inlineStyles].filter(Boolean).join("\n"),
    linkedStyles,
    stylesheetCount: hrefs.length,
    linkedStylesheetCount,
    inlinedStylesheetCount,
    inlinedCssBytes: inlineStyles.join("\n").length,
  };
}

function buildPrintDocument(
  bodyHtml: string,
  styles: Awaited<ReturnType<typeof preparePrintStyles>>,
  googleFontsUrl?: string | null,
) {
  const fontPreconnect = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
  const googleFontLink = googleFontsUrl
    ? `<link rel="stylesheet" href="${googleFontsUrl}">`
    : "";
  const headLinks = styles.linkedStyles
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");
  const headStyles = styles.inlineStyles
    ? `<style>${styles.inlineStyles}</style>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${fontPreconnect}${googleFontLink}${headLinks}${headStyles}</head><body>${bodyHtml}</body></html>`;
}

async function preparePrintHtml(
  url: string,
  options?: {
    mirrorImage?: PrintHtmlImageMirror;
    mirrorStylesheet?: PrintHtmlStylesheetMirror;
  },
) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load print page (${response.status})`);
  }

  const html = await response.text();
  const printRootHtml = extractPrintRootHtml(html);

  if (!printRootHtml) {
    throw new Error("Could not find printable report content on the print page");
  }

  const pageOrigin = new URL(url).origin;
  const googleFontsUrl = extractGoogleFontsUrl(html);
  const styles = await preparePrintStyles(
    html,
    url,
    options?.mirrorStylesheet,
  );
  const withImages = await mirrorImages(
    printRootHtml,
    pageOrigin,
    options?.mirrorImage,
  );

  return {
    html: buildPrintDocument(withImages.html, styles, googleFontsUrl),
    stylesheetCount: styles.stylesheetCount,
    linkedStylesheetCount: styles.linkedStylesheetCount,
    inlinedStylesheetCount: styles.inlinedStylesheetCount,
    inlinedCssBytes: styles.inlinedCssBytes,
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

export function buildPdfStylesheetPath(
  agencyId: string,
  assetScopeId: string,
  sourceUrl: string,
) {
  const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);

  return `${agencyId}/${assetScopeId}/pdf-assets/${hash}.css`;
}

type BrowserlessPdfOptions = {
  format?: string;
  width?: string;
  height?: string;
  landscape?: boolean;
  printBackground: boolean;
  preferCSSPageSize: boolean;
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
};

function buildBrowserlessPdfBody(
  html: string | null,
  url: string | null,
  pdfOptions: BrowserlessPdfOptions = DEFAULT_PDF_OPTIONS,
) {
  const base = {
    options: pdfOptions,
    emulateMediaType: "print",
    gotoOptions: {
      waitUntil: "networkidle0" as const,
      timeout: 90000,
    },
  };

  if (html) {
    return { ...base, html };
  }

  return { ...base, url: url! };
}

export async function renderPdfFromUrl(
  url: string,
  options?: {
    mirrorImage?: PrintHtmlImageMirror;
    mirrorStylesheet?: PrintHtmlStylesheetMirror;
    pageFormatId?: string;
  },
) {
  const pdfOptions: BrowserlessPdfOptions = options?.pageFormatId
    ? getPdfOptionsForCollateralFormat(getCollateralPageFormat(options.pageFormatId))
    : DEFAULT_PDF_OPTIONS;

  const prepared = await preparePrintHtml(url, {
    mirrorImage: options?.mirrorImage,
    mirrorStylesheet: options?.mirrorStylesheet,
  });

  const body = buildBrowserlessPdfBody(prepared.html, null, pdfOptions);

  const pdf = await browserlessRequest("/pdf", body, {
    responseType: "buffer",
    errorContext: "pdf",
  });

  if (!pdf) {
    if (isDevelopment()) {
      return Buffer.from(`Mock PDF for ${url}`);
    }

    throw new Error("PDF generation is not configured");
  }

  return pdf;
}
