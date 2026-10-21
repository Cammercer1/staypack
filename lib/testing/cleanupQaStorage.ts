import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { r2Client, r2Configuration, usesR2Storage } from "../storage/r2";

const qaNames = new Map([
  ["integration", "Proposal Integration QA"],
  ["str-release", "STR Release QA"],
  ["appraisal", "Appraisal Integration"],
  ["appraisal-ui", "Coastal Appraisals"],
  ["proposal-qa", "Proposal QA Agency"],
]);
const buckets = ["report-assets", "report-pdfs", "proposal-pdfs", "proposal-documents"] as const;

/** Run before deleting the disposable agency so its identity can still be checked. */
export async function cleanupQaStorage(admin: SupabaseClient, agencyId: string) {
  z.uuid().parse(agencyId);
  const agency = await admin.from("agencies").select("name,slug").eq("id", agencyId).maybeSingle();
  if (agency.error) throw new Error(agency.error.message);
  // A setup failure before agency creation cannot have uploaded scoped assets.
  const record = agency.data;
  if (!record) return;
  if (![...qaNames].some(([prefix, name]) => record.name === name && record.slug === `${prefix}-${agencyId}`)) {
    throw new Error("Refusing storage cleanup for an agency that is not a disposable QA fixture.");
  }

  if (usesR2Storage()) {
    const config = r2Configuration();
    const client = r2Client();
    for (const bucket of buckets) {
      const Bucket = bucket.startsWith("proposal-") ? config.privateBucket : config.publicBucket;
      const Prefix = `${bucket}/${agencyId}/`;
      const keys: string[] = [];
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }));
        for (const object of page.Contents ?? []) {
          if (!object.Key?.startsWith(Prefix)) throw new Error("Storage returned an object outside the QA agency prefix.");
          keys.push(object.Key);
        }
        ContinuationToken = page.NextContinuationToken;
      } while (ContinuationToken);
      for (const Key of keys) await client.send(new DeleteObjectCommand({ Bucket, Key }));
    }
  }

  // Check both stores: old fixtures and PDF mirrors can predate the R2 switch.
  for (const bucket of buckets) {
    const keys: string[] = [];
    async function collect(prefix: string) {
      for (let offset = 0; ; offset += 100) {
        const page = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
        if (page.error) throw new Error(page.error.message);
        for (const item of page.data) {
          const path = `${prefix}/${item.name}`;
          if (item.id) keys.push(path);
          else await collect(path);
        }
        if (page.data.length < 100) break;
      }
    }
    await collect(agencyId);
    for (let offset = 0; offset < keys.length; offset += 100) {
      const removed = await admin.storage.from(bucket).remove(keys.slice(offset, offset + 100));
      if (removed.error) throw new Error(removed.error.message);
    }
  }
}
