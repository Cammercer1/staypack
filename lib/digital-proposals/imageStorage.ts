// Server/CLI module; never import this into a client component.
import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { fetchExportImage } from "../collateral/social/fetchExportImage";
import { r2Client, r2PublicUrl, usesR2Storage } from "../storage/r2";
import { storageObject } from "../storage/r2";
import { proposalImageUrls, replaceProposalImages } from "./imageSnapshot";

export type ProposalImage = { buffer: Buffer; contentType: string };
type Options = {
  // Backfills may recover the original bytes from a version's existing PDF mirrors.
  recover?: (url: string) => Promise<ProposalImage | null>;
  onImage?: (source: string, preserved: string) => void;
  timeoutMs?: number;
};
const extensions: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif", avif: "avif" };
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function validatedImage(image: ProposalImage): Promise<ProposalImage & { extension: string }> {
  let xml = image.buffer.toString("utf8");
  // PNG/JPEG metadata can itself contain SVG text. Only XML input is eligible
  // for XML sanitizing; decoding binary image bytes as UTF-8 would corrupt them.
  const isSvg = /^\s*</.test(xml) && /<svg[\s>]/i.test(xml);
  if (isSvg) {
    // Older vector exports include a public SVG DTD. Remove that declaration
    // without loading it; internal subsets and entity declarations remain banned.
    xml = xml.replace(/<!DOCTYPE\s+svg\s+PUBLIC\s+["'][^"'\[\]<>]*["']\s+["'][^"'\[\]<>]*["']\s*>/gi, "");
    image = { ...image, buffer: Buffer.from(xml) };
  }
  const references = [...xml.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map(match => match[1] ?? match[2]);
  references.push(...[...xml.matchAll(/url\(([^)]*)\)/gi)].map(match => match[1].trim().replace(/^["']|["']$/g, "")));
  if (isSvg && (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|@import/i.test(xml) || references.some(value => !value.trim().startsWith("#")))) {
    throw new Error("SVG image contains external or active content");
  }
  const metadata = await sharp(image.buffer, { limitInputPixels: 40_000_000 }).metadata();
  // Rasterize SVGs so the permanent public copy cannot contain active SVG content
  // or references to external resources. Other image bytes remain unchanged.
  if (metadata.format === "svg") {
    if (!isSvg) throw new Error("Unsupported SVG encoding");
    const buffer = await sharp(image.buffer, { density: 144, limitInputPixels: 40_000_000 }).png().toBuffer();
    return { buffer, contentType: "image/png", extension: "png" };
  }
  const format = metadata.format === "heif" && metadata.compression === "av1" ? "avif" : metadata.format;
  const extension = format && extensions[format];
  if (!extension || !metadata.width || !metadata.height) throw new Error("Unsupported proposal image");
  return { ...image, extension, contentType: `image/${format}` };
}

/** Content-addressed copies are never overwritten, even when a source URL changes. */
export async function preserveProposalImages<T>(snapshot: T, scope: string, options: Options = {}): Promise<T> {
  if (!usesR2Storage()) return snapshot;
  if (!/^(?:prospects\/)?[a-f0-9-]{36}$/.test(scope)) throw new Error("Invalid proposal image scope");
  const urls = proposalImageUrls(snapshot);
  if (urls.length > 128) throw new Error("Too many proposal images");
  const replacements = new Map<string, string>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Proposal image preservation timed out")), options.timeoutMs ?? 45_000);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
      while (next < urls.length) {
        controller.signal.throwIfAborted();
        const source = urls[next++];
        const absolute = new URL(source, "https://staypack.app").toString();
        const permanentPrefix = r2PublicUrl("report-assets", `${scope}/published-images`);
        let publicUrl: string;
        if (absolute.startsWith(`${permanentPrefix}/`) && /^[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/.test(absolute.slice(permanentPrefix.length + 1))) {
          const image = await fetchExportImage(absolute, controller.signal);
          if (sha256(image.buffer) !== absolute.slice(permanentPrefix.length + 1).split(".")[0]) throw new Error("Preserved image checksum mismatch");
          publicUrl = absolute;
        } else {
          const recovered = await options.recover?.(source);
          const original = recovered ?? await fetchExportImage(absolute, controller.signal);
          let image: Awaited<ReturnType<typeof validatedImage>>;
          try { image = await validatedImage(original); }
          catch (error) {
            // Identify malformed source responses without logging signed URLs.
            throw new Error(`${error instanceof Error ? error.message : "Invalid image"}; host=${new URL(absolute).hostname}; source=${sha256(Buffer.from(source)).slice(0, 16)}; bytes=${original.buffer.length}; signature=${original.buffer.subarray(0, 8).toString("hex")}`);
          }
          controller.signal.throwIfAborted();
          const hash = sha256(image.buffer);
          const path = `${scope}/published-images/${hash}.${image.extension}`;
          try {
            await r2Client().send(new PutObjectCommand({ ...storageObject("report-assets", path), Body: image.buffer,
              ContentType: image.contentType, CacheControl: "public, max-age=31536000, immutable", Metadata: { sha256: hash }, IfNoneMatch: "*",
            }), { abortSignal: controller.signal });
          } catch (error) {
            if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
          }
          publicUrl = r2PublicUrl("report-assets", path);
          const readback = await fetchExportImage(publicUrl, controller.signal);
          if (sha256(readback.buffer) !== hash) throw new Error("Preserved image checksum mismatch");
        }
        replacements.set(source, publicUrl);
        options.onImage?.(source, publicUrl);
      }
    }));
    return replaceProposalImages(snapshot, replacements);
  } catch (error) {
    controller.abort(error);
    throw error;
  } finally { clearTimeout(timer); }
}
