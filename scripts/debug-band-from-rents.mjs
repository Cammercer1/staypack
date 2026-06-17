import { computeRentBandFromComps, formatWeeklyRentRange } from "../lib/rental/computeRentBand.ts";

const rents = [
  950, 975, 980, 1000, 1100, 1150, 1150, 1200, 1250, 1350, 1400, 1450, 1475, 1550,
  1575, 1650, 1675, 1925, 1950, 2200, 2500, 4250, 4300,
];
const comps = rents.map((r, i) => ({
  address: `x${i}`,
  weeklyRent: r,
  propertyType: "apartment",
  suburb: i < 5 ? "Labrador" : "Main Beach",
  bedrooms: 3,
  bathrooms: 2,
}));

const band = computeRentBandFromComps(comps, {
  subjectPropertyType: "Unit",
  subjectBedrooms: 3,
  subjectBathrooms: 2,
  preferSuburb: "Labrador",
  premiumSignals: {
    luxuryScore: 2,
    luxuryKeywordHits: ["luxury"],
    largeLand: false,
    premiumLand: false,
  },
  strictFeaturedPropertyType: true,
  maxFeaturedComps: 5,
});

console.log("Raw 23 comps: $950 – $4,300/wk (median $1,450)");
console.log(
  "Pipeline band:",
  band ? formatWeeklyRentRange(band.weeklyMin, band.weeklyMax) : "null",
);
console.log("Midpoint: $" + band?.weeklyMidpoint, "| pool n=" + band?.compCount);
