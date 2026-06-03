/**
 * Build a lease brochure JSON fixture from a Bright Data REA rent-discover export.
 *
 * Usage:
 *   npx tsx scripts/build-rental-brochure-fixture.mjs \
 *     --discover ~/Downloads/sd_mpuucju91qrcwedd6x.json \
 *     --out lib/collateral/rental-brochure/fixtures/hamilton-avenue-surfers.json \
 *     --address "39/24 Hamilton Avenue" \
 *     --suburb "Surfers Paradise" --state QLD --postcode 4217 \
 *     --beds 3 --baths 2 --cars 1 --type Apartment
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const discoverPath = arg("--discover", "");
  const outPath = resolve(
    ROOT,
    arg(
      "--out",
      "lib/collateral/rental-brochure/fixtures/generated-rental-brochure.json",
    ),
  );

  if (!discoverPath) {
    console.error("Pass --discover <path-to-brightdata-json>");
    process.exit(1);
  }

  const { parseReaRentDiscoverRecords } = await import(
    "../lib/rental/parseReaRentDiscover.ts"
  );
  const { computeRentBandFromComps, formatWeeklyRentRange } = await import(
    "../lib/rental/computeRentBand.ts"
  );
  const { buildReaRentSearchUrl } = await import(
    "../lib/rental/buildReaRentSearchUrl.ts"
  );
  const raw = JSON.parse(readFileSync(resolve(discoverPath), "utf8"));
  const records = Array.isArray(raw) ? raw : [raw];
  const comps = parseReaRentDiscoverRecords(records);

  const suburb = arg("--suburb", "Surfers Paradise");
  const state = arg("--state", "QLD");
  const postcode = arg("--postcode", "4217");
  const beds = Number(arg("--beds", "3"));
  const baths = Number(arg("--baths", "2"));
  const cars = Number(arg("--cars", "1"));
  const propertyType = arg("--type", "Apartment");
  const street = arg("--address", "39/24 Hamilton Avenue");

  const searchUrl = buildReaRentSearchUrl({
    suburb,
    state,
    postcode,
    bedrooms: beds,
    bathrooms: baths,
    carSpaces: cars,
    propertyType,
  });

  const band = computeRentBandFromComps(comps, {
    subjectPropertyType: propertyType,
    preferSuburb: suburb,
    maxFeaturedComps: 4,
  });

  const templatePath = resolve(
    ROOT,
    "lib/collateral/rental-brochure/fixtures/hamilton-avenue-surfers.json",
  );
  const template = existsSync(templatePath)
    ? JSON.parse(readFileSync(templatePath, "utf8"))
    : null;
  const { _meta: _drop, ...base } = template ?? {
    version: "rental_brochure_v1",
    type: "rental_brochure",
    template_id: "rental-brochure-gallery-2pg",
    agency: { name: "Sample Agency", primary_colour: "#009eca" },
    agent: { name: "Agent" },
    agents: [],
    property: {},
    copy: { heading: "", blurb: "", blurb_blocks: [], property_highlights: [], inspection_cta: "", disclaimer: "" },
    qr_target_url: "https://example.com",
    assets: { qr_code_url: "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=example" },
  };

  const displayPrice = band
    ? formatWeeklyRentRange(band.weeklyMin, band.weeklyMax)
    : base.property?.display_price ?? "";

  const document = {
    ...base,
    generated_at: new Date().toISOString(),
    _meta: {
      description: "Generated from Bright Data REA discover export",
      generated_at: new Date().toISOString(),
      discover_file: discoverPath,
      rea_discover_url: searchUrl,
      discover_input: records[0]?.discovery_input ?? null,
      comp_count_raw: comps.length,
    },
    property: {
      ...base.property,
      address: `${street}, ${suburb}`,
      suburb,
      state,
      postcode,
      property_type: propertyType,
      bedrooms: beds,
      bathrooms: baths,
      car_spaces: cars,
      display_price: displayPrice,
    },
    copy: {
      ...base.copy,
      price_value: displayPrice,
      bond_value: band
        ? `$${(band.weeklyMidpoint * 4).toLocaleString("en-AU")}`
        : base.copy.bond_value,
    },
    rental_appraisal: band
      ? {
          weekly_min: band.weeklyMin,
          weekly_max: band.weeklyMax,
          weekly_midpoint: band.weeklyMidpoint,
          source: "rea_discover",
          comp_count: band.compCount,
        }
      : undefined,
    rental_comps: band
      ? band.featuredComps.map((comp) => ({
          address: comp.address,
          suburb: comp.suburb,
          weekly_rent: comp.weeklyRent,
          bedrooms: comp.bedrooms,
          bathrooms: comp.bathrooms,
          property_type: comp.propertyType,
          image_url: comp.imageUrl,
          listing_url: comp.listingUrl,
        }))
      : [],
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log("Wrote", outPath);
  console.log("Comps:", comps.length, "Band:", band);
  console.log("SERP (no keywords):", searchUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
