export type BrandAssetType =
  "logo" | "logo-light" | "logo-dark" | "font" | "heading-font" | "body-font";

export function validateBrandAsset(
  file: Pick<File, "name" | "size" | "type">,
  type: BrandAssetType,
): string | null {
  const logo = type.startsWith("logo");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!file.size) return "Choose a file that is not empty.";
  if (file.size > (logo ? 5 : 10) * 1024 * 1024)
    return `${logo ? "Logos" : "Fonts"} must be ${logo ? 5 : 10} MB or smaller.`;
  if (
    logo &&
    (!["png", "jpg", "jpeg", "webp", "svg"].includes(extension ?? "") ||
      !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
        file.type,
      ))
  )
    return "Choose a PNG, JPG, WebP or SVG logo.";
  if (!logo && !["woff", "woff2", "ttf", "otf"].includes(extension ?? ""))
    return "Choose a WOFF, WOFF2, TTF or OTF font.";
  return null;
}

export async function uploadBrandAsset(
  file: File,
  type: BrandAssetType,
): Promise<string> {
  const error = validateBrandAsset(file, type);
  if (error) throw new Error(error);
  const body = new FormData();
  body.append("file", file);
  body.append("type", type);
  const response = await fetch("/api/agencies/upload-asset", {
    method: "POST",
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url)
    throw new Error(payload?.error || "Upload failed. Please try again.");
  return payload.url;
}
