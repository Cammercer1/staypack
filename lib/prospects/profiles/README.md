# Prospect brand library

Prospect branding is independent of customer agencies. `prospect_brands` is the live source of truth; these reviewed JSON files are reusable seed configurations. `prospect_proposals` stores the original listing and estimate, explicit overrides, brand snapshot and frozen final presentation separately. No agency, Auth user, membership, delivery job or billing record is created.

Only explicitly enrolled `prospect_operators` can read their own records. Customer agency membership gives no access. The internal read-only library is `/prospects`; it deliberately has no shared customer navigation entry. Published examples live at `https://staypack.app/examples/<company>/<property-address-suburb>`, for example `/examples/property-providers/6-33-malvern-avenue-manly`. Anyone visiting the URL can view the example: these are unlisted public sales demos, not confidential reports. Only the frozen public proposal snapshot is returned.

The `public_slug` is saved once at publication. Repeated property examples get a proposal-ID suffix rather than overwriting an existing link. Branding/address edits do not rename saved URLs. Old `/example/<random-token>` links redirect to the saved URL, preserving the selected page. Both routes require a published, non-revoked record on every request. Set `revoked_at` to disable both links; never reuse a revoked slug.

Both URL namespaces send `X-Robots-Tag: noindex, nofollow, noarchive` plus HTML noindex metadata and no-store headers. They are absent from sitemaps and public navigation, with no examples index or company directory. Do not block these paths in robots.txt: crawlers need to read the noindex directive. Noindex is not access control.

## Create another example

Use the Docker environment (Node 24 and server credentials). Prepare/validate a profile using `prospectProfileSchema`, then run:

```sh
docker compose exec app npx tsx scripts/create-prospect-proposal.ts \
  --profile lib/prospects/profiles/property-providers.json \
  --owner <internal-operator-user-id> \
  --url <Domain-listing-url> \
  --id <new-request-uuid> \
  --publish
```

Omit `--publish` to save a private draft. `--id` makes repeated requests return the saved result without paying for another estimate. Generation and branding edits currently use this internal command workflow; the library is read-only, not a self-service creation wizard.

If a listing cannot be imported, pass `--listing <reviewed-Listing.json>`. `createEmptyListingDraft` provides the field structure for manual entries. `--estimate <saved-estimate-and-enrichment.json>` reuses a saved market estimate. `--overrides <json>` records reviewed parking/guest/photo corrections separately from the original listing. Do not fabricate estimates. Property details affecting the estimate must be reviewed before fetching it.

## Attach after signup

Once the customer has an agency account with a membership:

```sh
docker compose exec app npx tsx scripts/attach-prospect-brand.ts \
  --brand <prospect-brand-id> --agency <new-customer-agency-id> --owner <operator-user-id>
```

This atomically copies branding, management defaults and proposal design, then links the prospect to the account. It refuses an account that already has a proposal design. It does not create a login, send an invitation or migrate sample proposals into the customer's workspace. Existing sample links retain their snapshots.

## Property Providers

Reviewed 13 October 2026. The turquoise `#00acc1`, light blue `#8ac1ce`, charcoal `#263238`, Montserrat and logo come from their website. The dark logo preserves the source vector geometry with a dark fill for white pages. Service copy is adapted from [What We Do](https://www.propertyproviders.com.au/what-we-do/); the Manly service image is from [their homepage](https://www.propertyproviders.com.au/). The 25% uplift is the operator's illustrative assumption, not a verified claim by Property Providers.

The 6/33 Malvern Avenue example uses the imported Domain profile and live STR estimate. One car space was verified against the public listing and stored as an explicit override. Seven current-listing photos were selected. The LTR comparator is the profile's estimated weekly rent. The model assumes availability throughout the year and expressly requires permitted use and owner availability to be checked. Monthly historical occupancy was unavailable; no values were invented.

The Property Providers assignment uses the code-owned `property-providers` renderer,
with Montserrat headings and body, the website's #1277a0 blue, #00acc1 accent,
charcoal header and white logo. Public contacts are stored on the detached profile,
then copied into each proposal snapshot; they never reference customer agent IDs.
Don Binkley's portrait, role and email are sourced from his public team page.
Only `/example/` and `/examples/` enable the non-binding agreement demonstration; customer proposals
use their configured links. Internal uplift settings stay in the private profile
and overrides. Public copy retains estimates, costs and availability assumptions.

Standalone occupancy generation falls back to an uncached provider request only if
Next's incremental cache is absent before any request started. Other cache/provider
errors do not cause a duplicate request. Save and reuse the successful evidence.

## Reusable agency layout and Aus Vision Realty

New profiles can select `agency-proposal` to reuse the six-page layout with their
own brand tokens, `presentation.tagline`, `presentation.coverCaption`, service
content, optional booking-platform logos, and contacts. `property-providers`
remains supported for its original header and review presentation. Roboto,
Montserrat and Manrope are self-hosted for proposal pages.

Aus Vision Realty was reviewed on 13 October 2026. Its red logo, white header,
Roboto, team image, Lucy Deng portrait and service details come from the agency's
website and linked source pages in `aus-vision-realty.json`. The sample for
57 Garling Street, Kardinya uses imported property data, a live STR estimate and
12 months of City of Melville four-bedroom occupancy history. The operator
confirmed a 25% management uplift. Four total parking spaces follow the active
Domain listing; eight guests is a modelling assumption, not verified occupancy
permission. No customer account is created. Booking-platform SVG sources are in
`public/brands/platforms/sources.json`.

## Deployment

Publish these routes through the normal Git deployment to `staypack.app`. A manual
Netlify deployment does not add files to Git and will be replaced by the next build.
Keep the public routes, shared proposal renderer, brand/font assets and prospect
profiles in the same release. `lib/prospects/routes.test.ts` covers both example
URLs, legacy redirects and noindex headers. After publishing, check both live links
and a page such as `?page=forecast` before sharing them.
