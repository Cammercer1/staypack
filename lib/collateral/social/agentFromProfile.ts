import { listingAgentFromProfile } from "@/lib/reports/listingAgents";
import type { CollateralAgentSlice } from "@/lib/collateral/templates/types";
import type { AgentProfile } from "@/lib/types";

export function collateralAgentFromProfile(
  profile: AgentProfile,
): CollateralAgentSlice {
  const draft = listingAgentFromProfile(profile);
  return {
    name: draft.name,
    role_title: draft.role_title,
    phone: draft.phone,
    email: draft.email,
    photo_url: draft.photo_url,
  };
}
