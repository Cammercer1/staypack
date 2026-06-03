import type { DeliveryTenantBrand } from "@/lib/delivery/brand/schema";
import type { AgentProfile } from "@/lib/types";

/** Default agent card on automated STR reports when no listing agent is set. */
export function agentProfileFromBrand(
  agencyId: string,
  brand: DeliveryTenantBrand | null | undefined,
): AgentProfile | null {
  const agent = brand?.agent;
  if (!agent?.name?.trim()) return null;

  return {
    id: "00000000-0000-0000-0000-000000000001",
    agency_id: agencyId,
    name: agent.name.trim(),
    email: agent.email?.trim() || null,
    phone: agent.phone?.trim() || null,
    role_title: agent.role_title?.trim() || null,
    photo_url: agent.photo_url?.trim() || null,
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
