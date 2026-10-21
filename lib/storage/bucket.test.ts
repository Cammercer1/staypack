import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", async (original) => ({
  ...await original<typeof import("@aws-sdk/client-s3")>(),
  S3Client: class { send = send; destroy() {} },
}));
import { assetBucket } from "./bucket";
import { r2PublicUrl, storageObject } from "./r2";

const download = vi.fn();
const legacy = { download, upload: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn() };
const from = vi.fn(() => legacy);
const supabase = { storage: { from } } as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STORAGE_PROVIDER", "r2");
  vi.stubEnv("R2_ACCOUNT_ID", "a".repeat(32));
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
  vi.stubEnv("R2_PUBLIC_BUCKET", "test-public");
  vi.stubEnv("R2_PRIVATE_BUCKET", "test-private");
  vi.stubEnv("R2_PUBLIC_BASE_URL", "https://assets.example.com");
});

describe("asset storage", () => {
  it("keeps private objects in the private bucket and denies public URLs", () => {
    expect(storageObject("proposal-pdfs", "agency/report/version.pdf")).toEqual({ Bucket: "test-private", Key: "proposal-pdfs/agency/report/version.pdf" });
    expect(() => r2PublicUrl("proposal-pdfs", "agency/report/version.pdf")).toThrow("Private files");
    vi.stubEnv("R2_PRIVATE_BUCKET", "test-public");
    expect(() => storageObject("proposal-pdfs", "file.pdf")).toThrow("separate buckets");
  });

  it("rejects unknown buckets and paths that could escape an object namespace", () => {
    for (const path of ["", "/file", "agency/../file", "agency//file", "agency\\file", "agency/./file", "agency/\nfile"]) {
      expect(() => storageObject("report-assets", path)).toThrow();
    }
    expect(() => storageObject("other-project", "file")).toThrow("Unsupported");
    expect(r2PublicUrl("report-assets", "agency/my image.png")).toBe("https://assets.example.com/report-assets/agency/my%20image.png");
  });

  it("writes new files to R2 and prevents accidental replacement", async () => {
    send.mockResolvedValue({});
    const result = await assetBucket(supabase, "report-pdfs").upload("agency/report.pdf", Buffer.from("pdf"), { contentType: "application/pdf", upsert: false });
    expect(result.error).toBeNull();
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: "test-public", Key: "report-pdfs/agency/report.pdf", IfNoneMatch: "*", ContentType: "application/pdf" });
    expect(from).not.toHaveBeenCalled();
  });

  it("serves a migrated private PDF from R2 without contacting Supabase", async () => {
    send.mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array([37, 80, 68, 70]) }, ContentType: "application/pdf" });
    const result = await assetBucket(supabase, "proposal-pdfs").download("agency/version.pdf");
    expect(await result.data?.text()).toBe("%PDF");
    expect(download).not.toHaveBeenCalled();
  });

  it("falls back for a not-yet-migrated private file, but not for access or service errors", async () => {
    download.mockResolvedValue({ data: new Blob(["legacy"]), error: null });
    send.mockRejectedValueOnce({ name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
    expect(await (await assetBucket(supabase, "proposal-pdfs").download("agency/version.pdf")).data?.text()).toBe("legacy");
    download.mockClear();
    send.mockRejectedValueOnce({ name: "AccessDenied", $metadata: { httpStatusCode: 403 }, message: "sensitive request data" });
    const denied = await assetBucket(supabase, "proposal-pdfs").download("agency/version.pdf");
    expect(denied.data).toBeNull();
    expect(denied.error?.message).toBe("File storage request failed");
    expect(download).not.toHaveBeenCalled();
  });

  it("uses the existing Supabase implementation until explicitly enabled", () => {
    vi.stubEnv("STORAGE_PROVIDER", "supabase");
    expect(assetBucket(supabase, "report-assets")).toBe(legacy);
    expect(send).not.toHaveBeenCalled();
  });
});
