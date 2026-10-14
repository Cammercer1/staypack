import type { ReportStatus } from "@/lib/types";

export type AgencyContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

/** Private agency data. Never merge this record into final_report_json. */
export type StrAppraisal = {
  report_id: string;
  agency_id: string;
  contact_id: string | null;
  recipient_mode: "named" | "general";
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_phone_e164: string | null;
  source: "manual" | "legacy" | "managed_delivery";
  created_at: string;
  updated_at: string;
};

export type StrAppraisalRow = StrAppraisal & {
  proposal_status?: string; proposal_opens?: number; last_opened?: string | null;
  report: {
    id: string;
    listing_id: string;
    status: ReportStatus;
    updated_at: string;
    pdf_url: string | null;
    listing: {
      id: string;
      property_address: string | null;
      hero_image_url: string | null;
      suburb: string | null;
      status: string;
    };
  };
};

export const appraisalStatuses = {
  draft: { label: "Draft", values: ["draft", "scraped", "estimated"] },
  ready: { label: "Ready", values: ["generated"] },
  published: { label: "Published", values: ["published"] },
  failed: { label: "Needs attention", values: ["failed"] },
  archived: { label: "Archived", values: ["archived"] },
} as const;

export function appraisalStatusLabel(status: string) {
  return Object.values(appraisalStatuses).find((group) =>
    (group.values as readonly string[]).includes(status),
  )?.label ?? "Draft";
}

export function strAppraisalPath(reportId: string) {
  return `/short-term-rentals/appraisals/${reportId}`;
}
