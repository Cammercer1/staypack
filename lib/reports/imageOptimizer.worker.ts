/// <reference lib="webworker" />

type OptimizeRequest = {
  file: File;
  compressIfBytes: number;
  maxLongEdge: number;
  quality: number;
};

type OptimizeResponse =
  | {
      ok: true;
      blob: Blob | null;
      optimized: boolean;
      width: number;
      height: number;
      type?: string;
    }
  | { ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<OptimizeRequest>) => {
  const { file, compressIfBytes, maxLongEdge, quality } = event.data;

  try {
    if (!file.type.startsWith("image/")) {
      post({ ok: true, blob: null, optimized: false, width: 0, height: 0 });
      return;
    }

    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    const longEdge = Math.max(width, height);
    const shouldCompress = file.size >= compressIfBytes || longEdge > maxLongEdge;

    if (!shouldCompress) {
      bitmap.close();
      post({ ok: true, blob: null, optimized: false, width, height });
      return;
    }

    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      post({ ok: true, blob: null, optimized: false, width, height });
      return;
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const outputType =
      file.type === "image/jpeg" || file.type === "image/webp" || file.type === "image/avif"
        ? file.type
        : "image/jpeg";

    const blob = await canvas.convertToBlob({ type: outputType, quality });

    if (!blob || blob.size >= file.size * 0.98) {
      post({ ok: true, blob: null, optimized: false, width, height });
      return;
    }

    post({
      ok: true,
      blob,
      optimized: true,
      width: targetWidth,
      height: targetHeight,
      type: outputType,
    });
  } catch (error) {
    post({ ok: false, error: error instanceof Error ? error.message : "Compression failed" });
  }
};

function post(message: OptimizeResponse) {
  ctx.postMessage(message);
}
