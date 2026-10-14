import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { brochureQuerySchema, listBrochures, openOrCreateBrochure } from "./workspace";
function database(results: unknown[]) {
  const queries: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const from = vi.fn(() => {
    const result = results.shift();
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ['select','eq','in','neq','order','ilike','range','insert','update','maybeSingle','single']) query[method] = vi.fn(() => query);
    query.then = vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject));
    queries.push(query); return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, queries };
}
const ok = (data: unknown, count?: number) => ({ data, error: null, count });
describe('brochure workspace', () => {
  it('scopes brochure search and pagination to the agency and excludes appraisal documents', async () => {
    const db = database([ok([], 0)]);
    await listBrochures(db.client, 'agency', brochureQuerySchema.parse({ q: '20%_Road', page: 2, type: 'rental_brochure', status: 'generated' }));
    const query = db.queries[0];
    expect(query.eq).toHaveBeenCalledWith('agency_id', 'agency');
    expect(query.eq).toHaveBeenCalledWith('listing.agency_id', 'agency');
    expect(query.in).toHaveBeenCalledWith('type', ['sales_brochure','rental_brochure']);
    expect(query.neq).toHaveBeenCalledWith('status', 'archived');
    expect(query.ilike).toHaveBeenCalledWith('listing.property_address', '%20\\%\\_Road%');
    expect(query.range).toHaveBeenCalledWith(20, 39);
  });
  it('reopens an existing document without replacing its content, even if source photos changed', async () => {
    const db = database([ok({ id: 'saved', status: 'published' })]);
    const listing = { ...createLintRegressionFixtures().listing, selected_image_urls: [], uploaded_image_urls: [], scraped_listing_json: null };
    expect(await openOrCreateBrochure(db.client, listing, 'sales_brochure')).toEqual({ id: 'saved', archived: false });
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(db.queries[0].insert).not.toHaveBeenCalled(); expect(db.queries[0].update).not.toHaveBeenCalled();
  });
  it('creates a draft for the requested type and recovers a concurrent duplicate', async () => {
    const db = database([ok(null), { error: { code: '23505' }, data: null }, ok({ id: 'concurrent', status: 'draft' })]);
    const listing = createLintRegressionFixtures().listing;
    expect(await openOrCreateBrochure(db.client, listing, 'rental_brochure')).toEqual({ id: 'concurrent', archived: false });
    expect(db.queries[1].insert).toHaveBeenCalledWith({ listing_id: listing.id, agency_id: listing.agency_id, type: 'rental_brochure', status: 'draft' });
  });
  it('requires photos for a new brochure and rejects archived properties', async () => {
    const db = database([ok(null)]);
    const listing = { ...createLintRegressionFixtures().listing, selected_image_urls: [], uploaded_image_urls: [], scraped_listing_json: null };
    await expect(openOrCreateBrochure(db.client, listing, 'sales_brochure')).rejects.toThrow('photos');
    expect(db.from).toHaveBeenCalledTimes(1);
    await expect(openOrCreateBrochure(db.client, { ...listing, status: 'archived' }, 'sales_brochure')).rejects.toThrow('Restore this property');
  });
  it('requires explicit restoration and preserves the archived document', async () => {
    const db = database([ok({ id: 'old', status: 'archived' })]);
    const listing = createLintRegressionFixtures().listing;
    expect(await openOrCreateBrochure(db.client, listing, 'sales_brochure')).toEqual({ id: 'old', archived: true });
    expect(db.queries[0].update).not.toHaveBeenCalled();
    const restore = database([ok({ id: 'old', status: 'archived' }), ok(null)]);
    expect(await openOrCreateBrochure(restore.client, listing, 'sales_brochure', true)).toEqual({ id: 'old', archived: false });
    expect(restore.queries[1].update).toHaveBeenCalledWith({ status: 'draft' });
    expect(restore.queries[1].eq).toHaveBeenCalledWith('agency_id', listing.agency_id);
  });
});
