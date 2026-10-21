import { createHash, randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2PublicUrl, storageObject } from "./r2";
import { signR2ImageUpload, verifyR2ImageUpload } from "./signedUpload";

// Explicitly enabled against configured R2 buckets; only touches disposable UUID test keys.
it.skipIf(process.env.RUN_R2_STORAGE_SMOKE !== "1")("uploads safely, serves public assets, and keeps proposals private", async () => {
  const path = `migration-smoke/${randomUUID()}.png`;
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XQAAAAASUVORK5CYII=", "base64");
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const client = r2Client();
  try {
    const upload = await signR2ImageUpload(path, "image/png", image.length);
    const preflight = await fetch(upload.signedUrl!, { method: "OPTIONS", headers: { Origin: "https://staypack.app", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type,if-none-match,cache-control" } });
    expect(preflight.ok).toBe(true);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://staypack.app");
    const incorrectType = await fetch(upload.signedUrl!, { method: "PUT", headers: { ...upload.headers, "Content-Type": "text/html" }, body: image });
    expect(incorrectType.status).toBe(403);
    const put = await fetch(upload.signedUrl!, { method: "PUT", headers: upload.headers, body: image });
    expect(put.status).toBe(200);
    expect((await fetch(upload.signedUrl!, { method: "PUT", headers: upload.headers, body: image })).status).toBe(412);
    expect(await verifyR2ImageUpload(path)).toBe(upload.publicUrl);
    const publicFile = await fetch(upload.publicUrl, { headers: { Origin: "https://staypack.app" } });
    expect(publicFile.status).toBe(200);
    expect(publicFile.headers.get("content-type")).toBe("image/png");
    expect(hash(new Uint8Array(await publicFile.arrayBuffer()))).toBe(hash(image));
    const privateObject = storageObject("proposal-pdfs", `${path}.pdf`);
    await client.send(new PutObjectCommand({ ...privateObject, Body: Buffer.from("Private migration smoke test"), ContentType: "application/pdf", IfNoneMatch: "*" }));
    const privateFile = await client.send(new GetObjectCommand(privateObject));
    expect(await privateFile.Body?.transformToString()).toBe("Private migration smoke test");
    const publicPrivateProbe = new URL(`/proposal-pdfs/${path}.pdf`, r2PublicUrl("report-assets", path));
    expect((await fetch(publicPrivateProbe)).status).toBe(404);
    await expect(client.send(new ListObjectsV2Command({ Bucket: "opt-img", MaxKeys: 1 }))).rejects.toMatchObject({ $metadata: { httpStatusCode: 403 } });
  } finally {
    await client.send(new DeleteObjectCommand(storageObject("report-assets", path)));
    await client.send(new DeleteObjectCommand(storageObject("proposal-pdfs", `${path}.pdf`)));
  }
}, 60_000);
