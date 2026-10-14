import { writeFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { mergeAppraisalResults, resolveAppraisalInput } from "./resolveAppraisalInput";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";

import type { ParsedListing } from "@/lib/types";
import { runLeaseAppraisalJob } from "@/lib/lease-appraisal/runLeaseAppraisalJob";
import { runSalesAppraisalJob } from "@/lib/sales-appraisal/runSalesAppraisalJob";
// Only the provider boundary is synthetic. Actual workers, storage, CAS and HTTP run.
vi.mock("@/lib/lease-appraisal/enrichParsedListingForLeaseAppraisal", () => ({ enrichParsedListingForLeaseAppraisal: vi.fn(async (parsed: ParsedListing) => ({ parsed: { ...parsed, warnings: ["Synthetic rental refresh"] }, warnings: [] })) }));
vi.mock("@/lib/sales-appraisal/enrichParsedListingForSalesAppraisal", () => ({ enrichParsedListingForSalesAppraisal: vi.fn(async (parsed: ParsedListing) => ({ parsed: { ...parsed, warnings: ["Synthetic sales refresh"] }, warnings: [] })) }));

// Opt-in only. Disposable agencies, synthetic provider evidence and no messages.
it.skipIf(process.env.APPRAISAL_INTEGRATION_TEST !== "1").each(["AU", "US"] as const)("%s rental and sales: authenticated APIs, isolation, immutable versions and brochure sources", async country => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const origin = process.env.STAGING_BASE_URL ?? "http://localhost:3000";
  const agencies = [randomUUID(),randomUUID()], listingId = randomUUID(), userIds: string[] = [], clients: SupabaseClient[] = [], cookies: string[] = [];
  const check = <T extends { data: unknown; error: { message:string } | null }>(value:T): NonNullable<T["data"]> => { if(value.error) throw new Error(value.error.message); return value.data as NonNullable<T["data"]>; };
  const api = (path:string,method="GET",body?:unknown,actor=0) => fetch(`${origin}${path}`,{method,redirect:"manual",headers:{Origin:origin,Cookie:cookies[actor] ?? "","Content-Type":"application/json","User-Agent":"Mozilla/5.0 Safari/605.1"},...(body ? {body:JSON.stringify(body)} : {})});
  const json = async(path:string,method="GET",body?:unknown) => { const response=await api(path,method,body); const value=await response.json(); expect(response.status,`${path}: ${JSON.stringify(value)}`).toBeLessThan(300); return value; };
  try {
    for(const agencyId of agencies) {
      const email=`appraisal-${agencyId}@example.com`,password=`${randomUUID()}Aa1!`;
      const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user!; userIds.push(user.id);
      check(await admin.from("agencies").insert({id:agencyId,name:"Appraisal Integration",country_code:country,slug:`appraisal-${agencyId}`}));
      check(await admin.from("agency_members").insert({agency_id:agencyId,user_id:user.id,role:"owner"}));
      const values:{name:string;value:string}[]=[];
      const auth=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>values,setAll:next=>{values.splice(0,values.length,...next); }}});
      check(await auth.auth.signInWithPassword({email,password})); clients.push(auth); cookies.push(values.map(c=>`${c.name}=${c.value}`).join("; "));
    }
    const f=createLintRegressionFixtures();
    const source={...f.listing,id:listingId,agency_id:agencies[0],created_by:userIds[0],agent_profile_id:null,public_slug:`appraisal-${listingId}`};
    if (country === "US") Object.assign(source, {country:"United States",property_address:"545 Westbourne Dr",suburb:"West Hollywood",state:"CA",postcode:"90048",latitude:34.0811,longitude:-118.3801});
    if (country === "US") source.scraped_listing_json = { ...source.scraped_listing_json!, country: "US", address: source.property_address!, suburb: source.suburb!, state: source.state!, postcode: source.postcode!, domainAvm: undefined, domainAvmInputFingerprint: undefined, appraisalInputFingerprints: undefined };
    source.scraped_listing_json=mergeAppraisalResults(source,"lease",resolveAppraisalInput(source));
    source.scraped_listing_json=mergeAppraisalResults(source,"sales",resolveAppraisalInput(source));
    const seed = { ...source, landing_template: "minimal" };
    check(await admin.from("listings").insert(seed));
    const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
    expect((await anonymous.from("appraisals").select("report_id")).error).not.toBeNull();
    const original=check(await admin.from("listings").select("*").eq("id",listingId).single());
    for(const kind of ["lease","sales"] as const) {
      const ids=[randomUUID(),randomUUID()];
      const body={kind,listing_id:listingId,request_id:ids[0],recipient:{mode:"named",name:"Jordan Owner",email:"private-owner@example.com",phone:"0412345678"}};
      expect((await json("/api/appraisals","POST",body)).report.id).toBe(ids[0]);
      expect((await json("/api/appraisals","POST",body)).report.id).toBe(ids[0]);
      expect((await api("/api/appraisals","POST",{...body,kind:kind === "lease" ? "sales" : "lease"})).status).toBe(409);
      await json("/api/appraisals","POST",{...body,request_id:ids[1]});
      const root=`/api/appraisals/${ids[0]}`;
      let current=await json(root);
      expect((await api(root,"GET",undefined,1)).status).toBe(404);
      // Next returns HTTP 200 for streamed not-found pages; the API is a hard 404.
      const deniedPage=await api(`/appraisals/${ids[0]}`,"GET",undefined,1);
      const deniedHtml=await deniedPage.text();
      expect(deniedHtml).toContain("This page could not be found");
      expect(deniedHtml).not.toContain("Jordan Owner");
      expect(deniedHtml).not.toContain("private-owner@example.com");
      expect((await api(`/api/str/appraisals/${ids[0]}/proposal`)).status).toBe(404);
      expect(check(await clients[1].from("appraisals").select("report_id").eq("report_id",ids[0]))).toEqual([]);
      expect(check(await clients[1].rpc("list_appraisals",{p_agency_id:agencies[0]})).total).toBe(0);
      expect((await clients[1].rpc("save_appraisal_inputs",{p_agency_id:agencies[0],p_report_id:ids[0],p_expected_updated_at:current.appraisal.updated_at,p_inputs:{version:1,listing:{}}})).error).not.toBeNull();
      expect((await clients[0].rpc("save_appraisal_inputs",{p_agency_id:agencies[0],p_report_id:ids[0],p_expected_updated_at:current.appraisal.updated_at,p_inputs:{}})).error).not.toBeNull();
      const queuedAt=current.appraisal.updated_at;
      const jobInput={agency_id:agencies[0],listing_id:listingId,created_by:userIds[0],status:"pending",request_json:{appraisal_report_id:ids[0],appraisal_updated_at:queuedAt}};
      const job=check(await admin.from(`${kind}_appraisal_jobs`).insert(jobInput).select("id").single());
      const run=kind === "lease" ? runLeaseAppraisalJob : runSalesAppraisalJob;
      expect((await run({supabase:admin,jobId:job.id})).status).toBe("completed");
      expect((await json(`${root}/evidence/jobs/${job.id}`)).job.status).toBe("completed");
      expect((await api(`/api/appraisals/${ids[1]}/evidence/jobs/${job.id}`)).status).toBe(404);
      const staleJob=check(await admin.from(`${kind}_appraisal_jobs`).insert(jobInput).select("id").single());
      await expect(run({supabase:admin,jobId:staleJob.id})).rejects.toThrow(/changed/);
      expect((await json(`${root}/evidence/jobs/${staleJob.id}`)).job.status).toBe("failed");
      current=await json(root);
      expect(current.appraisal.input_revision).toBe(1);
      const firstUpdated=current.appraisal.updated_at;
      const edits=kind === "lease" ? {weekly_min:1400,weekly_max:1600,weekly_midpoint:1500} : {price_min:2800000,price_max:3200000,price_midpoint:3000000};
      current=await json(`${root}/evidence/data`,"PATCH",{expected_updated_at:firstUpdated,...edits,selected_comp_listing_ids:["https://example.test/comparable/0","https://example.test/comparable/1"]});
      expect((await api(`${root}/evidence/data`,"PATCH",{expected_updated_at:firstUpdated,...edits})).status).toBe(409);
      expect((await api(`${root}/proposal`)).status).toBe(409);
      const prepared=await json(`${root}/prepare`,"POST",{expected_updated_at:current.appraisal.updated_at});
      expect(prepared.appraisal.document_revision).toBe(prepared.appraisal.input_revision);
      let workspace=await json(`${root}/proposal`) as ProposalWorkspace;
      expect(workspace.data?.appraisal?.kind).toBe(kind);
      expect(workspace.data?.market?.country).toBe(country);
      expect(workspace.data?.market?.rentPeriod).toBe(country === "US" ? "month" : "week");
      expect(workspace.data?.appraisal?.midpoint).toBe(kind === "lease" ? 1500 : 3000000);
      const draft={...workspace.assignment!.defaults,content:{...workspace.assignment!.defaults.content,introduction:`Private ${kind} proposal`}};
      check(await admin.from("digital_proposal_assignments").insert({agency_id:agencies[0],kind,name:workspace.assignment!.name,version:1,defaults:workspace.assignment!.defaults}));
      workspace=await json(`${root}/proposal`);
      const saved=await json(`${root}/proposal`,"PUT",{draft,revision:0});
      const published=await json(`${root}/proposal/publish`,"POST",{revision:saved.revision,sourceFingerprint:workspace.sourceFingerprint});
      const version=check(await admin.from("digital_proposal_versions").select("*").eq("id",published.version.id).single());
      expect(version.final_report_json.data.recipient.displayName).toBe("Jordan Owner");
      expect(JSON.stringify(version.final_report_json)).not.toContain("private-owner@example.com");
      expect(version.final_report_json.pdfReport.template_id).toContain(`${kind}-appraisal`);
      const publicPage=await fetch(`${origin}${published.version.path}`); expect(publicPage.status).toBe(200);
      const html=await publicPage.text(); expect(html).toContain(kind === "lease" ? "Rental appraisal" : "Sales appraisal");
      expect(html).not.toContain("private-owner@example.com");
      if (process.env.APPRAISAL_PDF_TEST === "1") {
        expect((await json(`${root}/proposal/pdf`,"POST",{versionId:version.id})).status).toBe("ready");
        const pdf = await fetch(`${origin}/api/proposals/${published.version.path.split("/").pop()}/pdf`);
        expect(pdf.status).toBe(200);
        const bytes=Buffer.from(await pdf.arrayBuffer()); expect(bytes.subarray(0,5).toString()).toBe("%PDF-");
        await writeFile(`/tmp/appraisal-${kind}.pdf`,bytes);
      }
      const collateral=check(await admin.from("collateral_items").select("report_id").eq("listing_id",listingId).eq("type",`${kind}_appraisal`).single());
      expect(collateral.report_id).toBe(ids[0]);
      const brochureSource=check(await admin.from("reports").select("final_report_json").eq("id",ids[0]).single());
      current=await json(root);
      await json(root,"PATCH",{expected_updated_at:current.appraisal.updated_at,recipient:{...body.recipient,name:"Alex Updated"}});
      expect((await api(`${root}/proposal/publish`,"POST",{revision:saved.revision,sourceFingerprint:workspace.sourceFingerprint})).status).toBe(409);
      current=await json(root);
      const updated=await json(`${root}/evidence/data`,"PATCH",{expected_updated_at:current.appraisal.updated_at,...(kind === "lease" ? {weekly_min:1700,weekly_max:1900,weekly_midpoint:1800} : {price_min:3300000,price_max:3500000,price_midpoint:3400000})});
      const awaitingReview=await json(`${root}/proposal`);
      expect(awaitingReview.needsEvidenceReview).toBe(true);
      expect((await api(`${root}/proposal/publish`,"POST",{revision:saved.revision,sourceFingerprint:awaitingReview.sourceFingerprint})).status).toBe(409);
      await json(`${root}/prepare`,"POST",{expected_updated_at:updated.appraisal.updated_at});
      workspace=await json(`${root}/proposal`);
      expect(check(await admin.from("reports").select("final_report_json").eq("id",ids[0]).single())).toEqual(brochureSource);
      expect(check(await admin.from("digital_proposal_versions").select("final_report_json").eq("id",version.id).single()).final_report_json).toEqual(version.final_report_json);
      const other=await json(`/api/appraisals/${ids[1]}`);
      expect(other.appraisal.input_revision).toBe(0);
      expect(check(await admin.from("listings").select("*").eq("id",listingId).single())).toEqual(original);
      const dashboard=await json(`/api/appraisals?kind=${kind}`); expect(dashboard.total).toBe(2); expect(dashboard.counts.published).toBe(1);
      const beforeRevoke=await json(root);
      await json(`${root}/evidence/data`,"PATCH",{expected_updated_at:beforeRevoke.appraisal.updated_at,...edits});
      await json(`${root}/proposal/revoke`,"POST",{versionId:version.id,linkId:published.version.link_id});
      expect((await fetch(`${origin}${published.version.path}`)).status).toBe(404);
      await json(root,"DELETE"); await json(root,"POST");
      expect((await fetch(`${origin}${published.version.path}`)).status).toBe(404);
    }
    const str=await json("/api/str/appraisals"); expect(str.total).toBe(0);
    const all=await json("/api/appraisals"); expect(all.total).toBe(4);
  } finally {
    for(const id of agencies) check(await admin.from("agencies").delete().eq("id",id));
    for(const id of userIds) check(await admin.auth.admin.deleteUser(id));
  }
},240000);
