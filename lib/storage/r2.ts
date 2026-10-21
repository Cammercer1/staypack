import { S3Client } from "@aws-sdk/client-s3";

const PUBLIC_BUCKETS = new Set(["agency-assets", "agent-assets", "report-assets", "report-pdfs"]);
const PRIVATE_BUCKETS = new Set(["proposal-pdfs", "proposal-documents", "scrape-html"]);

export function usesR2Storage() {
  const provider = process.env.STORAGE_PROVIDER || "supabase";
  if (provider !== "supabase" && provider !== "r2") throw new Error("Invalid storage provider");
  return provider === "r2";
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing storage configuration: ${name}`);
  return value;
}

export function r2Configuration() {
  const accountId = required("R2_ACCOUNT_ID");
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("Invalid R2 account ID");
  const publicUrl = new URL(required("R2_PUBLIC_BASE_URL"));
  if (publicUrl.protocol !== "https:" || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
    throw new Error("Invalid public storage URL");
  }
  const publicBucket = required("R2_PUBLIC_BUCKET");
  const privateBucket = required("R2_PRIVATE_BUCKET");
  if (publicBucket === privateBucket) throw new Error("Public and private storage must use separate buckets");
  return {
    accountId, publicBucket, privateBucket,
    publicBaseUrl: publicUrl.toString().replace(/\/$/, ""),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  };
}

let cached: { key: string; client: S3Client } | undefined;
export function r2Client() {
  const config = r2Configuration();
  const key = `${config.accountId}:${config.accessKeyId}:${config.secretAccessKey}`;
  if (cached?.key !== key) {
    cached?.client.destroy();
    cached = {
      key,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  }
  return cached.client;
}

export function storageObject(bucket: string, path: string) {
  if (!PUBLIC_BUCKETS.has(bucket) && !PRIVATE_BUCKETS.has(bucket)) throw new Error("Unsupported storage bucket");
  if (!path || path.startsWith("/") || /[\\\x00-\x1f]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Invalid storage path");
  }
  const config = r2Configuration();
  return { Bucket: PUBLIC_BUCKETS.has(bucket) ? config.publicBucket : config.privateBucket, Key: `${bucket}/${path}` };
}

export function r2PublicUrl(bucket: string, path: string) {
  if (!PUBLIC_BUCKETS.has(bucket)) throw new Error("Private files do not have public URLs");
  const { Key } = storageObject(bucket, path);
  return `${r2Configuration().publicBaseUrl}/${Key.split("/").map(encodeURIComponent).join("/")}`;
}

export function isMissingObject(error: unknown) {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value?.name === "NoSuchKey" || value?.name === "NotFound" || value?.$metadata?.httpStatusCode === 404;
}
