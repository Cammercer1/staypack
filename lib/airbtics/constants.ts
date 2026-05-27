import type { AirbticsTier } from "@/lib/types";

export const AIRBTICS_TIER_COST_CENTS: Record<AirbticsTier, number> = {
  summary: 10,
  full: 50,
};

export const AIRBTICS_TIER_ENDPOINT: Record<AirbticsTier, string> = {
  summary: "/report/summary",
  full: "/report/all",
};
