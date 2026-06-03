/**
 * Build lease appraisal fixture: REA property scrape + PropRadar suburb + AI copy.
 *
 * Usage:
 *   npx tsx scripts/build-lease-appraisal-fixture.mjs \
 *     "https://www.realestate.com.au/property-apartment-qld-surfers+paradise-151279484" \
 *     --keep-enrichment lib/lease-appraisal/fixtures/haven-ferny-lease-appraisal.json \
 *     --ai
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const url = process.argv.find((a) => a.startsWith("http") && !a.includes("/rent/"));
const rentSearchUrl = arg("--rent-search-url", "");
const discoverJson = arg("--discover-json", "");
const keepEnrichmentPath = arg("--keep-enrichment", "");
const useAi = process.argv.includes("--ai");
const skipDiscover = process.argv.includes("--skip-discover") || Boolean(keepEnrichmentPath);
const outRel =
  arg("--out", "lib/lease-appraisal/fixtures/haven-ferny-lease-appraisal.json");

function loadKeptEnrichment(path) {
  const abs = resolve(ROOT, path);
  const existing = JSON.parse(readFileSync(abs, "utf8"));
  const ltr = existing.ltr_enrichment;
  if (!ltr) {
    throw new Error(`No ltr_enrichment in ${path}`);
  }
  return {
    ltr_enrichment: ltr,
    rentalAppraisal: {
      weeklyMin: ltr.weekly_range?.p25 ?? null,
      weeklyMax: ltr.weekly_range?.p75 ?? null,
      weeklyMidpoint: ltr.weekly_range?.p50 ?? null,
      source: ltr.source ?? "rea_discover",
      compCount: ltr.comp_count ?? 0,
      searchUrl: ltr.search_url,
    },
    rentalComps: (ltr.comps ?? []).map((c) => ({
      address: c.name,
      suburb: c.suburb ?? undefined,
      weeklyRent: c.weekly_rent ?? 0,
      bedrooms: c.bedrooms ?? undefined,
      bathrooms: c.bathrooms ?? undefined,
      imageUrl: c.thumbnail_url || undefined,
      listingUrl: c.listing_url || undefined,
    })),
    suburb_market: ltr.suburb_market ?? existing._meta?.suburb_market ?? null,
  };
}

async function main() {
  if (!url) {
    console.error(
      "Usage: npx tsx scripts/build-lease-appraisal-fixture.mjs <rea-url> [--keep-enrichment fixture.json] [--ai] [--skip-discover]",
    );
    process.exit(1);
  }

  const { buildLeaseAppraisalReport } = await import(
    "../lib/lease-appraisal/buildLeaseAppraisalReport.ts"
  );
  const { applyHavenLeaseAppraisalBrandToReport } = await import(
    "../lib/reports/templates/haven-properties/brand.ts"
  );
  const { ltrEnrichmentFromParsed } = await import(
    "../lib/lease-appraisal/ltrEnrichmentFromParsed.ts"
  );

  console.log("Property URL:", url);
  if (skipDiscover) {
    console.log("Skipping rent discover — reusing comps from fixture.\n");
  }

  const { extractListingFromUrl } = await import("../lib/scraping/extractListing.ts");
  const { enrichListingRentalAppraisal } = await import(
    "../lib/rental/enrichListingRentalAppraisal.ts"
  );
  const { enrichLtrSuburbMarket } = await import("../lib/propradar/enrichLtrSuburbMarket.ts");
  const { formatWeeklyRentRange } = await import("../lib/rental/computeRentBand.ts");

  let parsed = (await extractListingFromUrl(url)).listing;
  let keptLtrEnrichment = null;

  if (keepEnrichmentPath) {
    const kept = loadKeptEnrichment(keepEnrichmentPath);
    keptLtrEnrichment = kept.ltr_enrichment;
    parsed = {
      ...parsed,
      rentalAppraisal: kept.rentalAppraisal,
      rentalComps: kept.rentalComps,
      displayPrice:
        kept.rentalAppraisal.weeklyMin != null && kept.rentalAppraisal.weeklyMax != null
          ? formatWeeklyRentRange(kept.rentalAppraisal.weeklyMin, kept.rentalAppraisal.weeklyMax)
          : parsed.displayPrice,
      ltrSuburbMarket: kept.suburb_market ?? parsed.ltrSuburbMarket,
      warnings: [
        ...(parsed.warnings ?? []),
        `Reused rent comps from ${keepEnrichmentPath}.`,
      ],
    };
  } else if (discoverJson) {
    const { parseReaRentDiscoverRecords } = await import(
      "../lib/rental/parseReaRentDiscover.ts"
    );
    const { computeRentBandFromComps } = await import("../lib/rental/computeRentBand.ts");
    const raw = JSON.parse(readFileSync(resolve(discoverJson), "utf8"));
    const records = Array.isArray(raw) ? raw : [raw];
    const comps = parseReaRentDiscoverRecords(records);
    const band = computeRentBandFromComps(comps, {
      subjectPropertyType: parsed.propertyType,
      preferSuburb: parsed.suburb,
      maxFeaturedComps: 6,
    });
    if (band && comps.length >= 5) {
      parsed = {
        ...parsed,
        displayPrice: formatWeeklyRentRange(band.weeklyMin, band.weeklyMax),
        rentalAppraisal: {
          weeklyMin: band.weeklyMin,
          weeklyMax: band.weeklyMax,
          weeklyMidpoint: band.weeklyMidpoint,
          source: "rea_discover",
          compCount: band.compCount,
          searchUrl: rentSearchUrl || records[0]?.discovery_input?.url,
        },
        rentalComps: band.featuredComps,
        warnings: [
          ...(parsed.warnings ?? []),
          `Rental appraisal from saved discover export (n=${band.compCount}).`,
        ],
      };
    }
  } else if (!skipDiscover) {
    console.log("Rent discover (often 2–4 min)…\n");
    parsed = await enrichListingRentalAppraisal(parsed, {
      ...(rentSearchUrl ? { searchUrl: rentSearchUrl } : {}),
    });
  }

  const suburbResult = await enrichLtrSuburbMarket(parsed);
  parsed = suburbResult.listing;

  const now = new Date().toISOString();
  const listing = {
    id: "00000000-0000-4000-8000-000000000001",
    agency_id: "00000000-0000-4000-8000-000000000003",
    status: "active",
    listing_url: url,
    property_address: parsed.address ?? "",
    suburb: parsed.suburb ?? "",
    state: parsed.state ?? "",
    postcode: parsed.postcode ?? "",
    property_type: parsed.propertyType ?? "",
    bedrooms: parsed.bedrooms ?? 0,
    bathrooms: parsed.bathrooms ?? 0,
    car_spaces: parsed.carSpaces ?? 0,
    accommodates: null,
    listing_title: parsed.title ?? parsed.address ?? "",
    listing_description: parsed.description ?? null,
    display_price: parsed.displayPrice ?? null,
    scraped_listing_json: parsed,
    created_at: now,
    updated_at: now,
  };

  const agency = {
    id: "00000000-0000-4000-8000-000000000003",
    slug: "havenly-property",
    name: "havenly property",
    logo_url: "",
    logo_light_url: "",
    logo_dark_url: "",
    primary_colour: "#009eca",
    secondary_colour: "#ffffff",
    accent_colour: "#009eca",
    text_colour: "#111111",
    background_colour: "#ffffff",
    font_family: "manrope",
    heading_font_family: "manrope",
    body_font_family: "manrope",
    font_file_url: "",
    heading_font_file_url: "",
    body_font_file_url: "",
    website_url: "",
    phone: "",
    email: "",
    default_disclaimer: null,
    default_cta: null,
    brand_advanced_json: null,
    report_template_id: null,
    created_at: now,
    updated_at: now,
  };

  const report = {
    id: "00000000-0000-4000-8000-000000000002",
    agency_id: agency.id,
    listing_id: listing.id,
    status: "generated",
    template_id: "haven-properties-lease-appraisal",
    created_at: now,
    updated_at: now,
  };

  const { generateLeaseAppraisalCopy } = await import(
    "../lib/openai/generateLeaseAppraisalCopy.ts"
  );

  console.log(useAi ? "Generating copy with OpenAI…\n" : "Deriving copy from listing…\n");

  const ltrEnrichmentForCopy = keptLtrEnrichment ?? ltrEnrichmentFromParsed(parsed);

  const copy = await generateLeaseAppraisalCopy({
    agency,
    listing,
    parsed,
    compCount: parsed.rentalAppraisal?.compCount ?? ltrEnrichmentForCopy?.comp_count ?? 0,
    weeklyMin: parsed.rentalAppraisal?.weeklyMin ?? null,
    weeklyMax: parsed.rentalAppraisal?.weeklyMax ?? null,
    suburbMarket: parsed.ltrSuburbMarket ?? ltrEnrichmentForCopy?.suburb_market ?? null,
    featuredComps: ltrEnrichmentForCopy?.comps ?? [],
  });

  let finalReport = applyHavenLeaseAppraisalBrandToReport(
    buildLeaseAppraisalReport({
      agency,
      listing,
      report,
      parsed,
      copy,
    }),
  );

  if (keptLtrEnrichment) {
    finalReport = {
      ...finalReport,
      ltr_enrichment: keptLtrEnrichment,
      ltr: {
        ...finalReport.ltr,
        weekly_min: keptLtrEnrichment.weekly_range?.p25 ?? finalReport.ltr.weekly_min,
        weekly_max: keptLtrEnrichment.weekly_range?.p75 ?? finalReport.ltr.weekly_max,
        weekly_midpoint: keptLtrEnrichment.weekly_range?.p50 ?? finalReport.ltr.weekly_midpoint,
      },
    };
  } else {
    const built = ltrEnrichmentFromParsed(parsed);
    if (built) {
      finalReport = { ...finalReport, ltr_enrichment: built };
    }
  }

  const outPath = resolve(ROOT, outRel);
  mkdirSync(dirname(outPath), { recursive: true });

  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        ...finalReport,
        _meta: {
          source_url: url,
          scraped_at: now,
          description_length: parsed.description?.length ?? 0,
          rental_appraisal: parsed.rentalAppraisal ?? null,
          suburb_market: parsed.ltrSuburbMarket ?? null,
          warnings: parsed.warnings ?? [],
          copy_source: useAi ? "openai" : "derived",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("Wrote:", outPath);
  console.log("Address:", parsed.address);
  console.log("Title:", parsed.title?.slice(0, 80));
  console.log("Description chars:", parsed.description?.length ?? 0);
  console.log("Heading:", copy.heading);
  console.log("Rent band:", parsed.rentalAppraisal);
  console.log("Images:", parsed.images?.length ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
