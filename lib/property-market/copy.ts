import { marketForCountry } from "./index";
export function marketCopyPrompt(prompt: string, country?: string | null) {
  if (marketForCountry(country).country !== "US") return prompt;
  return prompt.replace(/Australian/g, "US").replace(/\bREA\b/g, "property") + "\nThis property is in the United States. Use USD for money and monthly long-term rent. Weekly fields, if supplied, are internal equivalents: multiply by 52/12 before describing monthly rent. Do not confuse automated estimates, current asking prices and historic sold prices. Do not claim the guide was calculated from comparables if the input uses an automated property estimate. Do not invent local market statistics or permit eligibility.";
}
