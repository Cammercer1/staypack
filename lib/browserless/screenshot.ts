import { browserlessRequest } from "@/lib/browserless/client";
import { isDevelopment } from "@/lib/env";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import { getSocialPostFormat } from "@/lib/collateral/social/formats";

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
