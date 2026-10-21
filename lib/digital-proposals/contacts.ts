import { z } from "zod";
import { sanitizeAgentPhone } from "@/lib/agents/agentContact";
import type { ProposalAgent, ProposalData } from "./data";
import { isSafeProposalUrl } from "./links";

export type ProposalContactAction = { label: string; href: string; value: string };

/** Use public business contact details only, never the proposal recipient's details. */
export function contactActions(contact: { name: string; phone?: string; email?: string }): ProposalContactAction[] {
  const actions: ProposalContactAction[] = [];
  const phone = sanitizeAgentPhone(contact.phone);
  if (phone.replace(/\D/g, "").length >= 7) actions.push({ label: `Call ${contact.name}`, href: `tel:${phone.replace(/[^+\d]/g, "")}`, value: phone });
  const email = contact.email?.trim();
  if (email && z.email().safeParse(email).success) actions.push({ label: `Email ${contact.name}`, href: `mailto:${encodeURIComponent(email)}`, value: email });
  return actions;
}

export function hasAgentContact(agents: ProposalAgent[] = []) {
  return agents.some(agent => contactActions(agent).length > 0);
}

export function agencyContactActions(agency: ProposalData["agency"]): ProposalContactAction[] {
  const actions = contactActions(agency);
  const website = agency.websiteUrl?.trim();
  if (website && isSafeProposalUrl(website)) actions.push({ label: `Visit ${agency.name}`, href: website, value: website });
  return actions;
}
