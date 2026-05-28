import { toPng } from "html-to-image";
import {
  buildCollateralExportImageProxyUrl,
  shouldProxyImageForExport,
} from "@/lib/collateral/social/exportImageProxy";
import {
  getSocialPostDesignSize,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";
import { validateSocialPostPngBytes } from "@/lib/collateral/social/validateExportPng";

const MOUNT_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 8_000;
const CAPTURE_TIMEOUT_MS = 45_000;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function extractUrlFromCssUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/url\(["']?([^"')]+)["']?\)/);
  return match?.[1] ?? null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(url: string) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
    return url.startsWith("data:") ? url : null;
  }

  const fetchUrl = shouldProxyImageForExport(url)
    ? buildCollateralExportImageProxyUrl(url)
    : url;

  try {
    const response = await fetch(fetchUrl, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

/** Inline remote images so html-to-image does not hit a tainted canvas. */
async function inlineExternalImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      const dataUrl = await fetchImageAsDataUrl(src);
      if (dataUrl) {
        img.src = dataUrl;
        img.removeAttribute("srcset");
      }
    }),
  );

  const masked = Array.from(
    root.querySelectorAll<HTMLElement>('[style*="mask"]'),
  );
  await Promise.all(
    masked.map(async (el) => {
      const maskUrl =
        extractUrlFromCssUrl(el.style.maskImage) ||
        extractUrlFromCssUrl(el.style.webkitMaskImage);
      if (!maskUrl || maskUrl.startsWith("data:")) return;
      const dataUrl = await fetchImageAsDataUrl(maskUrl);
      if (!dataUrl) return;
      const wrapped = `url("${dataUrl}")`;
      el.style.maskImage = wrapped;
      el.style.webkitMaskImage = wrapped;
    }),
  );
}

function waitForImage(img: HTMLImageElement) {
  return Promise.race<void>([
    new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }),
    delay(IMAGE_TIMEOUT_MS),
  ]);
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;
  await Promise.all(images.map((img) => waitForImage(img)));
}

function wrapCaptureError(error: unknown): Error {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("cssrules") || msg.includes("cannot access rules")) {
      return new Error("PNG capture failed — refresh the page and try again.");
    }
    if (
      msg.includes("security") ||
      msg.includes("taint") ||
      msg.includes("cross-origin")
    ) {
      return new Error(
        "Could not capture images — ensure listing photos load in the editor, then try again.",
      );
    }
    return error;
  }
  return new Error("PNG capture failed — try again");
}

/** Wait until React has mounted the off-screen export tree. */
export async function waitForSocialPostExportRoot(
  getRoot: () => HTMLElement | null,
  timeoutMs = MOUNT_TIMEOUT_MS,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const root = getRoot();
    if (root) return root;
    await delay(50);
  }
  throw new Error("Export renderer did not mount — try again");
}

export async function waitForSocialPostExportCanvas(
  getRoot: () => HTMLElement | null,
  timeoutMs = MOUNT_TIMEOUT_MS,
) {
  const started = Date.now();
  const root = await waitForSocialPostExportRoot(getRoot, timeoutMs);

  while (Date.now() - started < timeoutMs) {
    const canvas = root.querySelector<HTMLElement>("[data-social-canvas]");
    if (canvas) {
      await waitForImages(canvas);
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await Promise.race([document.fonts.ready, delay(5_000)]);
      }
      await delay(150);
      return canvas;
    }
    await delay(50);
  }

  throw new Error("Timed out waiting for export canvas — try again");
}

export async function captureSocialPostPng(
  canvasElement: HTMLElement,
  variantId: SocialPostVariantId,
): Promise<Blob> {
  const { width, height } = getSocialPostDesignSize(variantId);

  try {
    await inlineExternalImages(canvasElement);

    const dataUrl = await Promise.race([
      toPng(canvasElement, {
        width,
        height,
        pixelRatio: 1,
        cacheBust: false,
        skipAutoScale: true,
        // Avoid reading cssRules on cross-origin sheets (e.g. Google Fonts <link>).
        skipFonts: true,
      }),
      delay(CAPTURE_TIMEOUT_MS).then(() => {
        throw new Error("PNG capture timed out — try again");
      }),
    ]);

    const base64 = dataUrl.split(",")[1];
    if (!base64) {
      throw new Error("PNG capture returned empty output");
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    validateSocialPostPngBytes(bytes.length);
    return new Blob([bytes], { type: "image/png" });
  } catch (error) {
    throw wrapCaptureError(error);
  }
}
