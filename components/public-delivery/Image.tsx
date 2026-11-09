import type { ImageProps } from "next/image";

/* eslint-disable @typescript-eslint/no-unused-vars -- Strip Next-only options before forwarding native image props. */

/** Reports use original CDN assets. This adapter avoids loading the Next server at the edge. */
export default function ReportImage({ src, alt, fill, priority, preload, unoptimized: _unoptimized, loader: _loader,
  quality: _quality, placeholder: _placeholder, blurDataURL: _blur, onLoadingComplete: _complete,
  overrideSrc, style, width, height, loading, fetchPriority, ...props }: ImageProps) {
  const image = typeof src === "string" ? src : "default" in src ? src.default : src;
  const url = overrideSrc ?? (typeof image === "string" ? image : image.src);
  // eslint-disable-next-line @next/next/no-img-element -- Standalone viewer uses the same original CDN URLs as unoptimized Next images.
  return <img {...props} src={url} alt={alt} width={fill ? undefined : width} height={fill ? undefined : height}
    loading={priority || preload ? "eager" : loading ?? "lazy"} fetchPriority={fetchPriority ?? (priority || preload ? "high" : undefined)}
    style={{ ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } as const : {}), ...style }} />;
}
