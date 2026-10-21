/**
 * Trusted internal workflow. Creates no agency, Auth user, membership, billing or delivery job.
 * docker compose exec app npx tsx scripts/create-prospect-proposal.ts --help
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "../lib/supabase/admin";
import { prospectProfileSchema } from "../lib/prospects/profile";
import { saveProspectBrand } from "../lib/prospects/repository";
import { prospectPublicPath, prospectSlugCandidates } from "../lib/prospects/publicLinks";
import { buildProspectProposal } from "../lib/prospects/buildProposal";
import { preserveProposalImages } from "../lib/digital-proposals/imageStorage";
import { importDomainProperty } from "../lib/domain-avm/propertyLookup";
import { fetchStrEstimate } from "../lib/str/estimate";
import { geocodeReportAddress } from "../lib/geocoding";
import type { Listing } from "../lib/types";

async function main() {
  const { values } = parseArgs({ options: {
    profile: { type: "string" }, owner: { type: "string" }, id: { type: "string" },
    url: { type: "string" }, listing: { type: "string" }, estimate: { type: "string" },
    overrides: { type: "string" },
    publish: { type: "boolean", default: false }, output: { type: "string" }, help: { type: "boolean" },
  } });
  if (values.help) {
    console.log("--profile <brand.json> --owner <operator-user-id> --url <Domain listing URL> [--publish] [--output <result.json>]\nUse --listing <reviewed Listing JSON> instead of --url for saved/manual property inputs. --estimate <saved estimate/enrichment JSON> reuses a reviewed estimate. --id <uuid> makes retries idempotent.");
    return;
  }
  if (!values.profile || !values.owner || (!values.url && !values.listing)) throw new Error("Provide --profile, --owner, and --url or --listing. Use --help for details.");
  const ownerId = z.uuid().parse(values.owner);
  const proposalId = values.id ? z.uuid().parse(values.id) : randomUUID();
  const profile = prospectProfileSchema.parse(JSON.parse(readFileSync(values.profile, "utf8")));
  const admin = createAdminClient();
  const operator = await admin.from("prospect_operators").select("user_id").eq("user_id", ownerId).maybeSingle();
  if (operator.error || !operator.data) throw new Error("Internal prospect access is required.");
  const previous = await admin.from("prospect_proposals").select("id,owner_user_id,public_token,public_slug,published_at,revoked_at,property_address,brand_snapshot_json").eq("id", proposalId).maybeSingle();
  if (previous.error) throw new Error("Unable to check an existing proposal.");
  if (previous.data) {
    if (previous.data.owner_user_id !== ownerId || previous.data.brand_snapshot_json.slug !== profile.slug) throw new Error("The request ID belongs to a different proposal.");
    console.log(JSON.stringify({ id: previous.data.id, address: previous.data.property_address,
      path: previous.data.published_at && !previous.data.revoked_at ? prospectPublicPath(previous.data) : null, reused: true }));
    return;
  }
  const listing: Listing | null = values.listing ? JSON.parse(readFileSync(values.listing, "utf8")) : await importDomainProperty(values.url!);
  if (!listing) throw new Error("Could not match this listing. Supply reviewed property inputs with --listing.");
  if (!listing.property_address || !listing.suburb || !listing.bedrooms || !listing.bathrooms || (listing.selected_image_urls?.length ?? 0) < 5)
    throw new Error("Review the property address, bedrooms, bathrooms and at least five photos before generating. Supply corrected inputs with --listing.");
  const coordinates = listing.latitude != null && listing.longitude != null ? { latitude: listing.latitude, longitude: listing.longitude } : await geocodeReportAddress(listing);
  const inputs = values.estimate ? JSON.parse(readFileSync(values.estimate, "utf8")) : await fetchStrEstimate({ ...coordinates, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, accommodates: listing.accommodates ?? listing.bedrooms * 2 }, listing);
  const brandId = await saveProspectBrand(ownerId, profile);
  const propertyOverrides = values.overrides ? JSON.parse(readFileSync(values.overrides, "utf8")) : {};
  const { snapshot, overrides, finalEstimate } = buildProspectProposal({ profile, brandId, proposalId, listing, ...inputs, propertyOverrides });
  const publishedSnapshot = values.publish ? await preserveProposalImages(snapshot, `prospects/${brandId}`) : snapshot;
  const token = values.publish ? randomBytes(32).toString("hex") : null;
  const record = {
    id: proposalId, brand_id: brandId, owner_user_id: ownerId,
    property_address: `${listing.property_address}, ${listing.suburb}, ${listing.state} ${listing.postcode}`,
    source_listing_json: listing, original_estimate_json: inputs.estimate, enrichment_json: inputs.enrichment,
    overrides_json: overrides, brand_snapshot_json: profile, final_report_json: publishedSnapshot,
    public_token: token, published_at: token ? new Date().toISOString() : null,
  };
  const candidates = token ? prospectSlugCandidates(profile.slug, snapshot.data.property.address, snapshot.data.property.suburb, proposalId) : [null];
  let publicSlug: string | null = null;
  for (const candidate of candidates) {
    const saved = await admin.from("prospect_proposals").insert({ ...record, public_slug: candidate });
    if (!saved.error) { publicSlug = candidate; break; }
    // The unique constraint arbitrates concurrent publishers without replacing another example.
    if (saved.error.code !== "23505" || !saved.error.message.includes("prospect_proposals_public_slug_key") || candidate === candidates.at(-1))
      throw new Error(`Unable to save example proposal: ${saved.error.message}`);
  }
  const result = { id: proposalId, brandId, address: listing.property_address, path: prospectPublicPath({ public_slug: publicSlug, public_token: token }),
    marketAnnual: inputs.estimate.annualRevenue, managedAnnual: finalEstimate.annualRevenue, upliftPercent: profile.upliftPercent };
  if (values.output) writeFileSync(values.output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Unable to create prospect proposal."); process.exitCode = 1; });
