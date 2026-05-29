import type { ListingPurpose } from "@/lib/types";

const LEASE_URL_PATTERN = /(?:^|[/_-])(rent|lease|leased|for-rent|for-lease|to-rent|rentals?)(?:$|[/_?#-])/i;
const SALE_URL_PATTERN = /(?:^|[/_-])(buy|sale|for-sale|sold|sales)(?:$|[/_?#-])/i;
const LEASE_PRICE_PATTERN = /(\bpw\b|\bpcm\b|\bpm\b|p\/w|p\.w|per\s*week|per\s*month|weekly|\/week|\/wk|\/pw)/i;

type DetectInput = {
  url?: string | null;
  displayPrice?: string | null;
  aiPurpose?: ListingPurpose | null;
};

export function detectListingPurpose({
  url,
  displayPrice,
  aiPurpose,
}: DetectInput): ListingPurpose {
  if (aiPurpose === "sale" || aiPurpose === "lease") {
    return aiPurpose;
  }

  if (url) {
    if (LEASE_URL_PATTERN.test(url)) {
      return "lease";
    }
    if (SALE_URL_PATTERN.test(url)) {
      return "sale";
    }
  }

  if (displayPrice && LEASE_PRICE_PATTERN.test(displayPrice)) {
    return "lease";
  }

  return "sale";
}
