import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSalesBrochurePreviewBrandFixture,
  salesBrochurePreviewBrandFromAgency,
  type SalesBrochurePreviewBrand,
} from "@/lib/collateral/sales-brochure/previewBrand";
import type { CollateralAgentSlice } from "@/lib/collateral/templates/types";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import type { Agency, AgentProfile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Showcase agent in brochure previews when present on the agency. */
export const SALES_BROCHURE_PREVIEW_AGENT_NAME_DEFAULT = "Harvey Specter";

function agentProfileToSlice(agent: AgentProfile): CollateralAgentSlice {
  return {
    name: agent.name,
    role_title: agent.role_title ?? "",
    phone: agent.phone ?? "",
    email: agent.email ?? "",
    photo_url: agent.photo_url ?? "",
  };
}

export function pickPreviewAgentProfile(
  agents: AgentProfile[],
): AgentProfile | null {
  const preferred = (
    process.env.SALES_BROCHURE_PREVIEW_AGENT_NAME ??
    SALES_BROCHURE_PREVIEW_AGENT_NAME_DEFAULT
  )
    .trim()
    .toLowerCase();

  if (!preferred) {
    return agents.find((row) => row.is_default) ?? agents[0] ?? null;
  }

  const exact = agents.find(
    (row) => row.name.trim().toLowerCase() === preferred,
  );
  if (exact) return exact;

  const partial = agents.find((row) =>
    row.name.trim().toLowerCase().includes(preferred),
  );
  if (partial) return partial;

  return agents.find((row) => row.is_default) ?? agents[0] ?? null;
}

/** Logged-in agency brand + showcase agent (e.g. Harvey Specter) for brochure previews. */
export async function loadSalesBrochurePreviewBrandForAgency(
  agency: Agency,
  supabase: SupabaseClient,
): Promise<SalesBrochurePreviewBrand> {
  const agents = await loadAgencyAgentProfiles(supabase, agency.id);
  const profile = pickPreviewAgentProfile(agents);

  return salesBrochurePreviewBrandFromAgency(
    agency,
    profile
      ? agentProfileToSlice(profile)
      : getSalesBrochurePreviewBrandFixture().agent,
  );
}

/** Fallback when no session — optional env agency id, else fixture. */
export async function loadSalesBrochurePreviewBrand(): Promise<SalesBrochurePreviewBrand> {
  const agencyId = process.env.SALES_BROCHURE_PREVIEW_AGENCY_ID?.trim();
  if (!agencyId) {
    return getSalesBrochurePreviewBrandFixture();
  }

  const admin = createAdminClient();

  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .select("*")
    .eq("id", agencyId)
    .maybeSingle();

  if (agencyError || !agency) {
    return getSalesBrochurePreviewBrandFixture();
  }

  const { data: agents } = await admin
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agencyId)
    .order("is_default", { ascending: false });

  const agentRows = (agents ?? []) as AgentProfile[];
  const profile = pickPreviewAgentProfile(agentRows);

  return salesBrochurePreviewBrandFromAgency(
    agency as Agency,
    profile
      ? agentProfileToSlice(profile)
      : getSalesBrochurePreviewBrandFixture().agent,
  );
}
