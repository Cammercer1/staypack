export type ReportActivity = "draft" | "published" | "archived" | "unpublished";

/** Enquiry progress is separate from whether its estimate was delivered. */
export function enquiryProgress(enquiry: { report_id?: string | null; contact_id?: string | null; report_activity?: ReportActivity | null }) {
  if (enquiry.report_id) {
    if (enquiry.report_activity === "published") return "Report published";
    if (enquiry.report_activity === "archived") return "Report archived";
    if (enquiry.report_activity === "unpublished") return "Report unpublished";
    return "Draft created";
  }
  return enquiry.contact_id ? "Contact saved" : "New enquiry";
}
