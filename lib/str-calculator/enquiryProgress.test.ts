import { expect, it } from "vitest";
import { enquiryProgress } from "./enquiryProgress";

it("keeps saved people separate from report progress", () => {
  expect(enquiryProgress({})).toBe("New enquiry");
  expect(enquiryProgress({ contact_id: "person" })).toBe("Contact saved");
  expect(enquiryProgress({ contact_id: "person", report_id: "draft" })).toBe("Draft created");
  expect(enquiryProgress({ report_id: "report", report_activity: "published" })).toBe("Report published");
  expect(enquiryProgress({ report_id: "report", report_activity: "unpublished" })).toBe("Report unpublished");
  expect(enquiryProgress({ report_id: "report", report_activity: "archived" })).toBe("Report archived");
});
