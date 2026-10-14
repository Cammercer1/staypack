import { describe, expect, it } from "vitest";
import { appraisalQuerySchema, normalizeRecipientPhone, recipientPayload, recipientSchema } from "./validation";
import { isConfirmedStrReport } from "./classification";
import type { Report } from "@/lib/types";

describe("private appraisal recipients", () => {
  const customer = { mode:"named" as const, name:" Alex Owner ", email:"alex@example.test", phone:"0400 000 001" };
  it("requires a customer name but allows missing delivery details", () => {
    expect(recipientSchema.safeParse({...customer,name:" "}).success).toBe(false);
    expect(recipientSchema.safeParse({...customer,email:"",phone:""}).success).toBe(true);
    expect(recipientSchema.safeParse({...customer,email:"invalid"}).success).toBe(false);
  });
  it("normalizes known Australian and international formats without guessing countries", () => {
    expect(normalizeRecipientPhone("(02) 9000 0001")).toBe("+61290000001");
    expect(normalizeRecipientPhone("0400 000 001")).toBe("+61400000001");
    expect(normalizeRecipientPhone("+44 7700 900001")).toBe("+447700900001");
    expect(normalizeRecipientPhone("7700900001")).toBeNull();
    expect(normalizeRecipientPhone("+0000000000")).toBeNull();
  });
  it("strips stale PII and contact identity when switching to general", () => {
    expect(recipientPayload({...customer,mode:"general",contact_id:"10000000-0000-4000-8000-000000000001"})).toEqual({ mode:"general",contact_id:null,name:null,email:null,phone:null,phone_e164:null });
    expect(recipientPayload(customer)).toMatchObject({name:"Alex Owner",phone_e164:"+61400000001"});
  });
});

it("validates dashboard scope and bounds pagination", () => {
  expect(appraisalQuerySchema.parse({})).toEqual({q:"",status:"all",page:1});
  expect(appraisalQuerySchema.safeParse({listing_id:"not-a-property"}).success).toBe(false);
  expect(appraisalQuerySchema.safeParse({page:"-1"}).success).toBe(false);
});
it("does not mistake sales, lease or ambiguous legacy reports for STR", () => {
  expect(isConfirmedStrReport({template_id:"classic-detailed",final_report_json:null})).toBe(true);
  expect(isConfirmedStrReport({template_id:"classic-sales-appraisal",final_report_json:null})).toBe(false);
  expect(isConfirmedStrReport({template_id:null,final_report_json:null})).toBe(false);
  expect(isConfirmedStrReport({template_id:"classic-detailed",final_report_json:{version:"lease_appraisal_v1"} as Report["final_report_json"]})).toBe(false);
});
