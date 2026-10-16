import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// These are production entry points, not optional preview features. Keep this
// check in the build so a partial Git release cannot silently remove a workspace.
export const requiredRoutes = [
  "/(app)/settings/billing/page",
  "/api/billing/checkout/route",
  "/api/billing/portal/route",
  "/api/billing/webhook/route",
  "/api/billing/usage-sync/route",
  "/(app)/marketing/str-calculator/page",
  "/(public)/embed/str-calculator/[token]/page",
  "/api/marketing/str-calculator/route",
  "/api/marketing/str-calculator/leads/[id]/report/route",
  "/api/str-calculator/[token]/route",
  "/api/str-calculator/[token]/address-suggestions/route",
  "/(app)/create/page",
  "/(app)/clients/page",
  "/api/clients/route",
  "/api/clients/[id]/route",
  "/(app)/social/page",
  "/(app)/social/new/page",
  "/(app)/social/[socialId]/page",
  "/(app)/social/[socialId]/property/page",
  "/api/social/route",
  "/(app)/dashboard/page",
  "/(app)/brochures/page",
  "/(app)/brochures/new/page",
  "/(app)/brochures/[brochureId]/page",
  "/(app)/brochures/[brochureId]/property/page",
  "/api/brochures/route",
  "/api/properties/route",
  "/(app)/appraisals/page",
  "/(app)/appraisals/new/page",
  "/(app)/appraisals/rental/page",
  "/(app)/appraisals/sales/page",
  "/(app)/appraisals/[reportId]/page",
  "/(app)/appraisals/[reportId]/preview/page",
  "/api/appraisals/route",
  "/api/appraisals/[reportId]/route",
  "/api/appraisals/[reportId]/property/route",
  "/api/appraisals/[reportId]/prepare/route",
  "/api/appraisals/[reportId]/evidence/data/route",
  "/api/appraisals/[reportId]/evidence/enrich/route",
  "/api/appraisals/[reportId]/evidence/jobs/[jobId]/route",
  "/api/appraisals/[reportId]/proposal/route",
  "/api/appraisals/[reportId]/proposal/publish/route",
  "/api/appraisals/[reportId]/proposal/revoke/route",
  "/api/appraisals/[reportId]/proposal/pdf/route",
  "/api/appraisals/[reportId]/proposal/activity/route",
  "/api/appraisals/[reportId]/proposal/attachments/route",
  "/api/appraisals/[reportId]/proposal/attachments/[attachmentId]/route",

  "/(app)/short-term-rentals/page",
  "/(app)/short-term-rentals/appraisals/new/page",
  "/(app)/short-term-rentals/appraisals/[reportId]/page",
  "/(app)/short-term-rentals/appraisals/[reportId]/preview/page",
  "/(app)/short-term-rentals/appraisals/[reportId]/proposal/page",
  "/(app)/reports/page",
  "/(app)/reports/new/page",
  "/(app)/listings/[listingId]/reports/[reportId]/page",
  "/api/str/appraisals/route",
  "/api/str/appraisals/[reportId]/route",
  "/api/str/appraisals/[reportId]/proposal/route",
  "/api/str/appraisals/[reportId]/proposal/publish/route",
  "/api/str/appraisals/[reportId]/proposal/revoke/route",
  "/api/str/appraisals/[reportId]/proposal/pdf/route",
  "/api/str/appraisals/[reportId]/proposal/activity/route",
  "/api/str/appraisals/[reportId]/proposal/attachments/route",
  "/api/str/appraisals/[reportId]/proposal/attachments/[attachmentId]/route",
  "/api/str/contacts/route",
  "/api/str/properties/route",
  "/api/listings/[id]/property-profile/route",
  "/(public)/proposal/[token]/page",
  "/(public)/proposal/print/[versionId]/page",
  "/api/proposals/[token]/events/route",
  "/api/proposals/[token]/pdf/route",
  "/api/proposals/[token]/attachments/[attachmentId]/route",
  "/(public)/example/[token]/page",
  "/(public)/examples/[company]/[property]/page",
];

export function verifyReleaseRoutes(manifest) {
  const missing = requiredRoutes.filter(route => !manifest[route]);
  if (missing.length) {
    throw new Error(`Release blocked: required production routes are missing:\n${missing.join("\n")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = JSON.parse(readFileSync(resolve(".next/server/app-paths-manifest.json"), "utf8"));
  verifyReleaseRoutes(manifest);
  console.log(`Release verified: all ${requiredRoutes.length} appraisal, proposal and marketing routes are in the production build.`);
}
