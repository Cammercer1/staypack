export const AGENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const AGENT_PHOTO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
];
export function validateAgentPhoto(file: Pick<File, "size" | "type">) {
  if (!AGENT_PHOTO_TYPES.includes(file.type))
    return "Choose a PNG, JPG, WebP or AVIF photo.";
  if (!file.size) return "Choose a photo that is not empty.";
  if (file.size > AGENT_PHOTO_MAX_BYTES)
    return "Photos must be 5 MB or smaller.";
  return null;
}

export function cropSource(
  width: number,
  height: number,
  zoom: number,
  x: number,
  y: number,
) {
  const size = Math.min(width, height) / Math.max(1, Math.min(3, zoom));
  return {
    size,
    x: ((width - size) * Math.max(0, Math.min(100, x))) / 100,
    y: ((height - size) * Math.max(0, Math.min(100, y))) / 100,
  };
}
