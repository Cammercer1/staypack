import { zipSync } from "fflate";
import type { SocialPostVariantId } from "./formats";

/** One browser download avoids multiple-download blocking for a format bundle. */
export async function packageSocialImages(address: string, images: Map<SocialPostVariantId, Blob>) {
  const stem = address.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "property";
  if (images.size === 1) {
    const [variant, blob] = [...images][0];
    return { blob, filename: `${stem}-${variant}.png` };
  }
  if (images.size === 0) throw new Error("No images are ready to download");
  const files = Object.fromEntries(await Promise.all([...images].map(async ([variant, blob]) => [
    `${stem}-${variant}.png`, new Uint8Array(await blob.arrayBuffer()),
  ])));
  // PNGs are already compressed; storing them avoids expensive recompression.
  const zip = zipSync(files, { level: 0 });
  return { blob: new Blob([new Uint8Array(zip)], { type: "application/zip" }), filename: `${stem}-social-media.zip` };
}
