/** Only describe features directly supported by the subject, never by unrelated numbers or building amenities. */
export function appraisalSubjectFeatures(description: string, bathrooms: number, carSpaces: number) {
  const desc = description.toLowerCase();
  const features: string[] = [];
  if (/\bnorth[- ]facing\b/.test(desc)) features.push("north-facing aspect");
  if (/\b(?:ocean|harbour|water|city|district|panoramic|skyline) views?\b/.test(desc)) features.push("views");
  if (/\b(?:level|floor)\s+[1-9]\d?\b|\b(?:[1-9]\d?(?:st|nd|rd|th)|first|second|third|top|upper)[ -]floor\b|\bupper level\b|\belevated (?:position|setting)\b/.test(desc)) {
    features.push("elevated position");
  }
  if (bathrooms >= 2) features.push(`${bathrooms} bathrooms`);
  if (carSpaces >= 1) {
    const secure = /\bsecure\b.{0,30}\b(car|parking|garage|carport)\b|\b(car|parking|garage|carport)\b.{0,30}\bsecure\b/.test(desc);
    features.push(secure ? "secure parking" : "off-street parking");
  }
  return features.slice(0, 4).join(", ");
}
