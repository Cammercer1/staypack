export const COMPRESS_IF_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LONG_EDGE = 4000;
export const PRINT_SAFE_LONG_EDGE = 2500;
const OUTPUT_QUALITY = 0.88;

export type OptimizeResult = {
  file: File;
  optimized: boolean;
  width: number;
  height: number;
};

type WorkerResponse =
  | {
      ok: true;
      blob: Blob | null;
      optimized: boolean;
      width: number;
      height: number;
      type?: string;
    }
  | { ok: false; error: string };

/**
 * Spawns a dedicated worker that runs canvas resizing off the main thread.
 * Returns null when workers/OffscreenCanvas are unavailable so callers can
 * fall back to the synchronous main-thread path.
 */
export function createOptimizerWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (typeof OffscreenCanvas === "undefined") {
    return null;
  }

  try {
    return new Worker(new URL("./imageOptimizer.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

export function optimizeWithWorker(worker: Worker, file: File): Promise<OptimizeResult> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      const data = event.data;

      if (!data?.ok) {
        reject(new Error(data?.error ?? "Compression failed"));
        return;
      }

      if (data.optimized && data.blob) {
        const optimizedFile = new File([data.blob], file.name, {
          type: data.type ?? file.type,
          lastModified: file.lastModified,
        });
        resolve({ file: optimizedFile, optimized: true, width: data.width, height: data.height });
        return;
      }

      resolve({ file, optimized: false, width: data.width ?? 0, height: data.height ?? 0 });
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error ?? new Error("Worker compression failed"));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({
      file,
      compressIfBytes: COMPRESS_IF_BYTES,
      maxLongEdge: MAX_UPLOAD_LONG_EDGE,
      quality: OUTPUT_QUALITY,
    });
  });
}

async function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions"));
    };
    img.src = url;
  });
}

/**
 * Main-thread fallback mirroring the worker logic, used when workers or
 * OffscreenCanvas are unavailable, or when a worker request fails.
 */
export async function optimizeOnMainThread(file: File): Promise<OptimizeResult> {
  if (!file.type.startsWith("image/")) {
    return { file, optimized: false, width: 0, height: 0 };
  }

  let width = 0;
  let height = 0;

  try {
    const dims = await getImageDimensions(file);
    width = dims.width;
    height = dims.height;
  } catch {
    return { file, optimized: false, width: 0, height: 0 };
  }

  const longEdge = Math.max(width, height);
  const shouldCompress = file.size >= COMPRESS_IF_BYTES || longEdge > MAX_UPLOAD_LONG_EDGE;

  if (!shouldCompress) {
    return { file, optimized: false, width, height };
  }

  const scale = longEdge > MAX_UPLOAD_LONG_EDGE ? MAX_UPLOAD_LONG_EDGE / longEdge : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    return { file, optimized: false, width, height };
  }

  const imageBitmap = await createImageBitmap(file);
  context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close();

  const outputType =
    file.type === "image/jpeg" || file.type === "image/webp" || file.type === "image/avif"
      ? file.type
      : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, OUTPUT_QUALITY);
  });

  if (!blob || blob.size >= file.size * 0.98) {
    return { file, optimized: false, width, height };
  }

  const optimizedFile = new File([blob], file.name, {
    type: outputType,
    lastModified: file.lastModified,
  });

  return { file: optimizedFile, optimized: true, width: targetWidth, height: targetHeight };
}
