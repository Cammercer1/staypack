import "server-only";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, r2PublicUrl, storageObject } from "./r2";
import { isImageUpload, type SignedAssetUpload } from "./uploadPolicy";

export async function signR2ImageUpload(path: string, contentType: string, size: number): Promise<SignedAssetUpload> {
  if (!isImageUpload(contentType, size)) throw new Error("Choose a supported image under 20 MB");
  const signedUrl = await getSignedUrl(r2Client(), new PutObjectCommand({
    ...storageObject("report-assets", path), ContentType: contentType,
    ContentLength: size, IfNoneMatch: "*", CacheControl: "max-age=3600",
  }), { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length", "if-none-match", "cache-control"]) });
  return { provider: "r2", path, signedUrl, publicUrl: r2PublicUrl("report-assets", path), headers: {
    "Content-Type": contentType, "If-None-Match": "*", "Cache-Control": "max-age=3600",
  } };
}

export async function verifyR2ImageUpload(path: string) {
  const object = await r2Client().send(new HeadObjectCommand(storageObject("report-assets", path)));
  if (!isImageUpload(object.ContentType || "", object.ContentLength || 0)) throw new Error("Uploaded image is missing or invalid");
  return r2PublicUrl("report-assets", path);
}
