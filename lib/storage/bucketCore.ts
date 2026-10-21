import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingObject, r2Client, r2PublicUrl, storageObject, usesR2Storage } from "./r2";

function storageError(error: unknown) {
  // SDK errors can contain signed request information. Return only a safe message.
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return new Error(status === 412 ? "This file already exists" : "File storage request failed");
}

/** Call only after the route's agency/document access check. Credentials stay server-side. */
export function assetBucket(supabase: Pick<SupabaseClient, "storage">, bucket: string) {
  if (!usesR2Storage()) return supabase.storage.from(bucket);
  return {
    async upload(path: string, body: Uint8Array, options: { contentType?: string; cacheControl?: string; upsert?: boolean } = {}) {
      try {
        await r2Client().send(new PutObjectCommand({
          ...storageObject(bucket, path), Body: body,
          ContentType: options.contentType || "application/octet-stream",
          CacheControl: `max-age=${options.cacheControl || "3600"}`,
          ...(!options.upsert ? { IfNoneMatch: "*" } : {}),
        }));
        return { data: { path, fullPath: `${bucket}/${path}` }, error: null };
      } catch (error) { return { data: null, error: storageError(error) }; }
    },
    getPublicUrl(path: string) { return { data: { publicUrl: r2PublicUrl(bucket, path) } }; },
    async download(path: string) {
      try {
        const result = await r2Client().send(new GetObjectCommand(storageObject(bucket, path)));
        if (!result.Body) throw new Error("Empty storage response");
        const bytes = await result.Body.transformToByteArray();
        return { data: new Blob([new Uint8Array(bytes)], { type: result.ContentType }), error: null };
      } catch (error) {
        // During migration old private paths remain valid. Never hide permission/outage errors.
        if (isMissingObject(error)) return supabase.storage.from(bucket).download(path);
        return { data: null, error: storageError(error) };
      }
    },
    async remove(paths: string[]) {
      try {
        for (const path of paths) await r2Client().send(new DeleteObjectCommand(storageObject(bucket, path)));
        return { data: [], error: null };
      } catch (error) { return { data: null, error: storageError(error) }; }
    },
    async info(path: string) {
      try {
        const result = await r2Client().send(new HeadObjectCommand(storageObject(bucket, path)));
        return { data: { size: result.ContentLength || 0, contentType: result.ContentType || "" }, error: null };
      } catch (error) { return { data: null, error: storageError(error) }; }
    },
  };
}
