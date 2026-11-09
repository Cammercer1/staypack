import { browserlessRequest } from "@/lib/browserless/client";
import { isDevelopment } from "@/lib/env";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import { getSocialPostFormat } from "@/lib/collateral/social/formats";

/** Render an isolated SVG image without a native image addon in the app runtime. */
export async function rasterizeSvg(svg: Buffer, width: number, height: number) {
  const outputWidth = Math.ceil(width * 1.5), outputHeight = Math.ceil(height * 1.5);
  if (outputWidth < 1 || outputHeight < 1 || outputWidth * outputHeight > 40_000_000) {
    throw new Error("Unsupported SVG dimensions");
  }
  // An img data URL never runs SVG scripts. The enclosing CSP additionally
  // blocks all network access, even if the SVG contains an escaped reference.
  const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>html,body{margin:0;background:transparent}img{display:block;width:${outputWidth}px;height:${outputHeight}px}</style></head><body><img src="data:image/svg+xml;base64,${svg.toString("base64")}"></body></html>`;
  const result = await browserlessRequest("/screenshot", {
    html, options: { type: "png", omitBackground: true, fullPage: false },
    viewport: { width: outputWidth, height: outputHeight, deviceScaleFactor: 1 },
    waitForFunction: { fn: "() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)", timeout: 15_000 },
  }, { responseType: "buffer", errorContext: "pdf", timeoutMs: 30_000 });
  if (!Buffer.isBuffer(result) || !result.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw new Error("SVG renderer did not return a PNG");
  }
  return result;
}

export async function renderPngFromUrl(
  url: string,
  variantId: SocialPostVariantId,
) {
  const format = getSocialPostFormat(variantId);

  const png = await browserlessRequest(
    "/screenshot",
    {
      url,
      options: {
        type: "png",
        fullPage: false,
      },
      viewport: {
        width: format.widthPx,
        height: format.heightPx,
        deviceScaleFactor: 1,
      },
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 60000,
      },
    },
    {
      responseType: "buffer",
      errorContext: "pdf",
    },
  );

  if (!png) {
    if (isDevelopment()) {
      return Buffer.alloc(0);
    }

    throw new Error("PNG export is not configured");
  }

  return png as Buffer;
}
