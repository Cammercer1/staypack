import type { AgentProfile, Listing } from "@/lib/types";
import { isMaskedPhone } from "./agentContact";

type Contact = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};
const normalName = (value?: string | null) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
const normalPhone = (value?: string | null) => {
  if (isMaskedPhone(value) || /[^\d+()\s.-]/.test(value ?? "")) return "";
  const digits = (value?.replace(/\D/g, "") ?? "").replace(/^00/, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits.startsWith("61") && digits.length === 11
    ? `0${digits.slice(2)}`
    : digits;
};

// Existing shared contacts can still be maintained. Only a new contact collision
// is blocked, including matches against archived profiles.
export function findBlockingDuplicateAgents(
  contact: Contact,
  agents: AgentProfile[],
  initial?: AgentProfile,
) {
  const email = contact.email?.trim().toLowerCase() ?? "";
  const phone = normalPhone(contact.phone);
  const emailChanged =
    !initial || email !== (initial.email?.trim().toLowerCase() ?? "");
  const phoneChanged = !initial || phone !== normalPhone(initial.phone);
  return agents.filter(
    (agent) =>
      agent.id !== initial?.id &&
      ((emailChanged && email && email === agent.email?.trim().toLowerCase()) ||
        (phoneChanged && phone && phone === normalPhone(agent.phone))),
  );
}

export function duplicateReasons(left: Contact, right: Contact): string[] {
  const reasons = [];
  if (normalName(left.name) && normalName(left.name) === normalName(right.name))
    reasons.push("name");
  if (
    left.email?.trim() &&
    left.email.trim().toLowerCase() === right.email?.trim().toLowerCase()
  )
    reasons.push("email");
  const phone = normalPhone(left.phone);
  if (phone.length >= 8 && phone === normalPhone(right.phone))
    reasons.push("phone");
  return reasons;
}

export function findDuplicateAgents(
  contact: Contact,
  agents: AgentProfile[],
  excludeId?: string,
) {
  return agents.filter(
    (agent) =>
      agent.id !== excludeId && duplicateReasons(contact, agent).length > 0,
  );
}

export type AgentListingUsage = {
  id: string;
  address: string;
  match: "assigned" | "contact match";
};
export type AgentDirectoryEntry = AgentProfile & {
  listings: AgentListingUsage[];
};

export function agentListingUsage(
  agent: AgentProfile,
  listings: Pick<
    Listing,
    | "id"
    | "property_address"
    | "listing_title"
    | "agent_profile_id"
    | "scraped_listing_json"
  >[],
): AgentListingUsage[] {
  return listings.flatMap((listing) => {
    const assigned = listing.agent_profile_id === agent.id;
    const matched = listing.scraped_listing_json?.agents?.some(
      (contact) => duplicateReasons(agent, contact).length > 0,
    );
    return assigned || matched
      ? [
          {
            id: listing.id,
            address:
              listing.property_address ||
              listing.listing_title ||
              "Untitled listing",
            match: assigned
              ? ("assigned" as const)
              : ("contact match" as const),
          },
        ]
      : [];
  });
}

export function filterAgentDirectory(
  agents: AgentDirectoryEntry[],
  search: string,
  status: string,
  sort: string,
) {
  const query = search.trim().toLowerCase();
  return agents
    .filter(
      (agent) =>
        (status === "all" ||
          (status === "archived" ? !!agent.archived_at : !agent.archived_at)) &&
        (!query ||
          [agent.name, agent.email, agent.phone, agent.role_title].some(
            (value) => value?.toLowerCase().includes(query),
          )) &&
        (status !== "duplicates" ||
          findDuplicateAgents(agent, agents, agent.id).length > 0),
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : sort === "za"
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name),
    );
}
