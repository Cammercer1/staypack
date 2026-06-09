export type NearbyRentSuburb = {
  suburb: string;
  state: string;
  postcode: string;
};

/** Extra REA rent SERP targets when the primary suburb has thin stock. */
const NEIGHBORS_BY_POSTCODE: Record<string, NearbyRentSuburb[]> = {
  "2776": [
    { suburb: "Springwood", state: "NSW", postcode: "2777" },
    { suburb: "Winmalee", state: "NSW", postcode: "2777" },
    { suburb: "Hazelbrook", state: "NSW", postcode: "2779" },
    { suburb: "Linden", state: "NSW", postcode: "2778" },
    { suburb: "Blaxland", state: "NSW", postcode: "2774" },
  ],
  "4011": [
    { suburb: "Hendra", state: "QLD", postcode: "4011" },
    { suburb: "Clayfield", state: "QLD", postcode: "4011" },
    { suburb: "Ascot", state: "QLD", postcode: "4007" },
    { suburb: "Hamilton", state: "QLD", postcode: "4007" },
  ],
};

export function nearbyRentSearchSuburbs(
  suburb: string,
  state: string,
  postcode: string,
): NearbyRentSuburb[] {
  const neighbors = NEIGHBORS_BY_POSTCODE[postcode.trim()];
  if (!neighbors?.length) {
    return [];
  }

  const subject = suburb.trim().toLowerCase();
  return neighbors.filter((row) => row.suburb.trim().toLowerCase() !== subject);
}
