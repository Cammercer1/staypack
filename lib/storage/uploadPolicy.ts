export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const IMAGE_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;

export type SignedAssetUpload = {
  path: string;
  publicUrl: string;
  provider?: "supabase" | "r2";
  token?: string;
  signedUrl?: string;
  headers?: Record<string, string>;
};

export function isImageUpload(type: string, size: number) {
  return (IMAGE_UPLOAD_TYPES as readonly string[]).includes(type) && Number.isSafeInteger(size) && size > 0 && size <= MAX_IMAGE_UPLOAD_BYTES;
}
