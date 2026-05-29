import type { LeadWithListing } from "@/lib/types";

export type LeadContact = {
  /** Stable key used for grouping (normalized email, phone, or lead id). */
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  enquiries: LeadWithListing[];
  propertyCount: number;
  totalEnquiries: number;
  newCount: number;
  contactedCount: number;
  /** True when every enquiry from this contact has been actioned. */
  allContacted: boolean;
  /** ISO timestamp of the most recent enquiry. */
  latestCreatedAt: string;
};

function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function normalizePhone(phone: string | null): string | null {
  const digits = phone?.replace(/[^\d+]/g, "");
  return digits ? digits : null;
}

function contactKey(lead: LeadWithListing): string {
  const email = normalizeEmail(lead.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(lead.phone);
  if (phone) return `phone:${phone}`;
  return `lead:${lead.id}`;
}

/**
 * Groups leads into contacts by normalized email, falling back to phone, then
 * the lead id when neither is present. Each contact aggregates every enquiry
 * the person has submitted across properties. Enquiries and contacts are sorted
 * newest-first by their most recent enquiry.
 */
export function groupLeads(leads: LeadWithListing[]): LeadContact[] {
  const byKey = new Map<string, LeadWithListing[]>();

  for (const lead of leads) {
    const key = contactKey(lead);
    const existing = byKey.get(key);
    if (existing) {
      existing.push(lead);
    } else {
      byKey.set(key, [lead]);
    }
  }

  const contacts: LeadContact[] = [];

  for (const [key, group] of byKey) {
    const enquiries = [...group].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const latest = enquiries[0];
    const newCount = enquiries.filter((lead) => lead.status === "new").length;
    const uniqueListings = new Set(enquiries.map((lead) => lead.listing_id));

    contacts.push({
      key,
      name: latest.name,
      email: enquiries.find((lead) => lead.email)?.email ?? null,
      phone: enquiries.find((lead) => lead.phone)?.phone ?? null,
      enquiries,
      propertyCount: uniqueListings.size,
      totalEnquiries: enquiries.length,
      newCount,
      contactedCount: enquiries.length - newCount,
      allContacted: newCount === 0,
      latestCreatedAt: latest.created_at,
    });
  }

  return contacts.sort(
    (a, b) =>
      new Date(b.latestCreatedAt).getTime() -
      new Date(a.latestCreatedAt).getTime(),
  );
}
