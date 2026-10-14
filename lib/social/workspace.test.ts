import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { getCollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";
import { openOrCreateMarketingAsset } from "@/lib/brochures/workspace";
import { createSocialSchema, listSocialPosts, openOrCreateSocialPosts, socialQuerySchema } from "./workspace";

vi.mock("@/lib/collateral/generateCollateralDocument", () => ({ generateCollateralDocument: vi.fn(async () => ({ type: "social_posts", edited: false })) }));
function database(results: unknown[]) {
  const queries: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const from = vi.fn(() => {
    const result = results.shift();
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "in", "neq", "is", "order", "ilike", "range", "insert", "update", "maybeSingle", "single"]) query[method] = vi.fn(() => query);
    query.then = vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject));
    queries.push(query); return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, queries };
}
const ok = (data: unknown, count?: number) => ({ data, error: null, count });
const fixture = createLintRegressionFixtures();
describe("social workspace", () => {
  it("uses agency-scoped search and stable pagination without loading full designs", async () => {
    const db = database([ok([], 0)]);
    await listSocialPosts(db.client, "agency", socialQuerySchema.parse({ q: "20%_Road", page: 2 }));
    expect(db.queries[0].eq).toHaveBeenCalledWith("agency_id", "agency");
    expect(db.queries[0].eq).toHaveBeenCalledWith("listing.agency_id", "agency");
    expect(db.queries[0].eq).toHaveBeenCalledWith("type", "social_posts");
    expect(db.queries[0].neq).toHaveBeenCalledWith("status", "archived");
    expect(db.queries[0].ilike).toHaveBeenCalledWith("listing.property_address", "%20\\%\\_Road%");
    expect(db.queries[0].range).toHaveBeenCalledWith(18, 35);
  });
  it("accepts one photo for social while preserving brochure requirements", async () => {
    const listing = { ...fixture.listing, selected_image_urls: ["https://example.com/photo.jpg"], uploaded_image_urls: ["https://example.com/photo.jpg"], scraped_listing_json: null };
    expect(getCollateralPhotoRequirement(listing, "social_posts")).toMatchObject({ minimum: 1, met: true });
    expect(getCollateralPhotoRequirement(listing, "sales_brochure")).toMatchObject({ minimum: 5, met: false });
    const db = database([ok(null), ok({ id: "new" })]);
    expect(await openOrCreateMarketingAsset(db.client, listing, "social_posts")).toEqual({ id: "new", archived: false });
  });
  it("reopens edited social designs without writing anything", async () => {
    const saved = { ...fixture.collateral, type: "social_posts", document_json: { edited: "keep me" } };
    const db = database([ok({ id: saved.id, status: "generated" }), ok(saved)]);
    await openOrCreateSocialPosts(db.client, fixture.agency, fixture.listing);
    expect(db.queries.every(query => query.update.mock.calls.length === 0 && query.insert.mock.calls.length === 0)).toBe(true);
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it("initializes a missing design with a conditional tenant-scoped write", async () => {
    const saved = { ...fixture.collateral, type: "social_posts", document_json: null };
    const db = database([ok({ id: saved.id, status: "draft" }), ok(saved), ok([]), ok({ id: saved.id })]);
    await openOrCreateSocialPosts(db.client, fixture.agency, fixture.listing);
    expect(db.queries[3].is).toHaveBeenCalledWith("document_json", null);
    expect(db.queries[3].eq).toHaveBeenCalledWith("agency_id", fixture.agency.id);
    expect(db.queries[3].neq).toHaveBeenCalledWith("status", "archived");
  });
  it("preserves a concurrent generated design instead of overwriting it", async () => {
    const saved = { ...fixture.collateral, type: "social_posts", document_json: null };
    const db = database([ok({ id: saved.id, status: "draft" }), ok(saved), ok([]), ok(null), ok({ document_json: { edited: true } })]);
    await expect(openOrCreateSocialPosts(db.client, fixture.agency, fixture.listing)).resolves.toMatchObject({ id: saved.id });
    expect(db.queries.filter(query => query.update.mock.calls.length)).toHaveLength(1);
  });
  it("does not restore archived social designs without an explicit action", async () => {
    const db = database([ok({ id: "archived", status: "archived" })]);
    expect(await openOrCreateSocialPosts(db.client, fixture.agency, fixture.listing)).toEqual({ id: "archived", archived: true });
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it("validates input and rejects unexpected fields", () => {
    expect(createSocialSchema.safeParse({ listing_id: "bad" }).success).toBe(false);
    expect(createSocialSchema.safeParse({ listing_id: "91508ca8-eb2e-4cea-945d-df20c4fa9ed3", agency_id: "other" }).success).toBe(false);
    expect(socialQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });
});
