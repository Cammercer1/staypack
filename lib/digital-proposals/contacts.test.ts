import { expect, it } from "vitest";
import { agencyContactActions, contactActions, hasAgentContact } from "./contacts";
import { proposalDataSchema, proposalFromReport } from "./data";
import { createProposalFixture } from "./fixtures";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";

it("excludes masked or invalid contact details and unsafe websites", () => {
  expect(contactActions({ name: "Agent", phone: "04** *** ***", email: "not an email" })).toEqual([]);
  expect(agencyContactActions({ name: "Agency", logoUrl: "", phone: "abc", websiteUrl: "javascript:alert(1)" })).toEqual([]);
  expect(agencyContactActions({ name: "Agency", logoUrl: "", websiteUrl: "https://secret@example.com" })).toEqual([]);
  expect(hasAgentContact([{ name: "Agent", phone: "123", email: "", role: "", photoUrl: "" }])).toBe(false);
});

it("freezes public agency contacts without exposing recipient contact fields", () => {
  const report = getStrPlaygroundReport();
  report.agency.phone = "02 9000 1234"; report.agency.email = "agency@example.com"; report.agency.website_url = "https://agency.example.com";
  const data = proposalFromReport(report, "Jordan");
  expect(agencyContactActions(data.agency)).toHaveLength(3);
  report.agency.email = "changed@example.com";
  expect(data.agency.email).toBe("agency@example.com");
  const parsed = proposalDataSchema.parse({ ...data, recipient: { displayName: "Jordan", phone: "private phone", email: "private@example.com" } });
  expect(parsed.recipient).toEqual({ displayName: "Jordan" });
});

it("keeps published snapshots without agency contacts compatible", () => {
  const old = createProposalFixture();
  expect(proposalDataSchema.parse(old).agency).toEqual(old.agency);
  expect(agencyContactActions(old.agency)).toEqual([]);
});
