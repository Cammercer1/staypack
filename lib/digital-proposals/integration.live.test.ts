import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { load } from "cheerio";
import { mkdirSync, writeFileSync } from "node:fs";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyStrEstimateAdjustments, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import type { ProposalWorkspace } from "./workspace";
import { proposalPrintUrl } from "./printAccess";
import havenlyAssignment from "./assignments/havenly.json";
import { usesR2Storage, r2Client, r2Configuration } from "@/lib/storage/r2";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

// Only disposable agencies/users. No estimate/import/copy APIs or messages.
it.skipIf(process.env.STR_LIVE_TEST !== "1")("live digital workflow: isolation, assignment, snapshots, documents, analytics and PDF", async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const origin = process.env.STAGING_BASE_URL ?? "http://localhost:3000";
  const agencyId = randomUUID(), otherAgencyId = randomUUID(), listingId = randomUUID();
  const userIds: string[] = [];
  const agentIds = [randomUUID(), randomUUID()], foreignAgentId = randomUUID(), archivedAgentId = randomUUID();
  const paths: { bucket: string; path: string }[] = [];
  const check = <T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> => {
    if (result.error) throw new Error(result.error.message); return result.data as NonNullable<T["data"]>;
  };
  const cookieHeaders: string[] = [];
  async function api(path: string, method = "GET", body?: unknown, actor = 0) {
    return fetch(`${origin}${path}`, { method, redirect: "manual", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookieHeaders[actor] ?? "", "User-Agent": "Mozilla/5.0 Safari/605.1" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function json(path: string, method = "GET", body?: unknown) {
    const response = await api(path, method, body);
    const payload = await response.json();
    expect(response.status, JSON.stringify(payload)).toBeLessThan(300); return payload;
  }
  try {
    for (const id of [agencyId, otherAgencyId]) {
      const email = `str-integration-${id}@example.com`, password = `${randomUUID()}Aa1!`;
      const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user!; userIds.push(user.id);
      check(await admin.from("agencies").insert({ id, name: "Proposal Integration QA", slug: `integration-${id}`, ...(process.env.STR_HAVEN_TEST === "1" ? { report_template_id: "haven-properties-str" } : {}) }));
      if (process.env.STR_HAVEN_TEST === "1") check(await admin.from("account_template_grants").insert({ agency_id: id, template_id: "haven-properties-str", product: "str", is_default: true }));
      if (process.env.STR_HAVEN_TEST === "1") check(await admin.from("digital_proposal_assignments").insert({ agency_id: id, ...havenlyAssignment }));
      check(await admin.from("agency_members").insert({ agency_id: id, user_id: user.id, role: "owner" }));
      const cookies: { name: string; value: string }[] = [];
      const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookies, setAll: values => { cookies.splice(0, cookies.length, ...values); } } });
      check(await auth.auth.signInWithPassword({ email, password })); cookieHeaders.push(cookies.map(item => `${item.name}=${item.value}`).join("; "));
    }
    check(await admin.from("agent_profiles").insert([
      { id: agentIds[0], agency_id: agencyId, name: "Alex Adviser", role_title: "Property manager", phone: "0400000001", email: "alex@example.com" },
      { id: agentIds[1], agency_id: agencyId, name: "Taylor Agent", role_title: "Leasing specialist", phone: "0400000002", email: "taylor@example.com" },
      { id: foreignAgentId, agency_id: otherAgencyId, name: "Other agency contact" },
      { id: archivedAgentId, agency_id: agencyId, name: "Archived contact", archived_at: new Date().toISOString() },
    ]));
    const photos = ["marketing/staypack-rental-appraisal-front.webp", "marketing/staypack-rental-appraisal-comparables.webp", "marketing/businessman-presenting-brochure.webp", "collateral/refined-floor-plan-preview.png", "staypack-logo.png"].map(path => `https://staypack.app/${path}`);
    photos[0] = createLintRegressionFixtures().document.property.hero_image_url;
    check(await admin.from("listings").insert({ id: listingId, public_slug: `proposal-integration-${listingId}`, agency_id: agencyId, created_by: userIds[0], property_address: "12 Proposal Test Esplanade, Byron Bay NSW 2481", suburb: "Byron Bay", state: "NSW", postcode: "2481", bedrooms: 3, bathrooms: 2, property_type: "house", hero_image_url: photos[0], selected_image_urls: photos, uploaded_image_urls: photos }));
    if (usesR2Storage()) {
      const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XQAAAAASUVORK5CYII=", "base64");
      const signed = await json("/api/reports/upload-asset/sign", "POST", { listing_id: listingId, storage_protocol: 2, files: [{ name: "qa.png", type: "image/png", size: image.length }] });
      const upload = signed.uploads[0];
      expect(upload.provider).toBe("r2");
      expect((await fetch(upload.signedUrl, { method: "PUT", headers: upload.headers, body: image })).status).toBe(200);
      const finalized = await json("/api/reports/upload-asset/finalize", "POST", { listing_id: listingId, uploads: [{ path: upload.path, provider: upload.provider }] });
      expect(finalized.uploaded_image_urls).toContain(upload.publicUrl);
      expect(upload.publicUrl).toMatch(/^https:\/\/assets\.staypack\.app\//);
      expect(Buffer.from(await (await fetch(upload.publicUrl)).arrayBuffer())).toEqual(image);
      const imageForm = new FormData(); imageForm.set("listing_id", listingId); imageForm.set("file", new File([image], "qa-server.png", { type: "image/png" }));
      const serverUpload = await fetch(`${origin}/api/reports/upload-asset`, { method: "POST", headers: { Cookie: cookieHeaders[0], Origin: origin }, body: imageForm });
      expect(serverUpload.status).toBe(200);
      expect((await serverUpload.json()).url).toMatch(/^https:\/\/assets\.staypack\.app\//);
    }
    const created = await json("/api/str/appraisals", "POST", { listing_id: listingId, request_id: randomUUID(), recipient: { mode: "named", name: "Jordan QA", email: "private-qa@example.com", phone: "0412345678" } });
    const reportId = created.report.id;
    const root = `/api/str/appraisals/${reportId}/proposal`;
    let workspace = await json(root) as ProposalWorkspace;
    expect(workspace.availableAgents!.map(agent => agent.id).sort()).toEqual([...agentIds].sort());
    const initial = workspace.assignment!.defaults;
    await json(root, "PUT", { revision: 0, draft: initial });
    expect((await api(`${root}/publish`, "POST", { revision: 1, sourceFingerprint: workspace.sourceFingerprint })).status).toBe(400);
    const f = createLintRegressionFixtures().report;
    const rates = { nightlyRate: 420, occupancyRate: 72 };
    const overrides = saveStrRateOverride({ strProperty: { weeklyRent: 1150, propertyValue: 1250000, amenities: [], additionalAmenities: [] } }, rates, { unavailableNights: 14, listingStage: "established", rationale: "Synthetic management scenario" });
    if (f.str_enrichment_json) f.str_enrichment_json.seasonality = Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, revenue: 5000 + i * 500, revenue_low: null, revenue_high: null, occupancy: 60, adr: 420 }));
    check(await admin.from("reports").update({ user_overrides_json: overrides, original_estimate_json: f.original_estimate_json, final_estimate_json: applyStrEstimateAdjustments(f.original_estimate_json!, rates), str_enrichment_json: f.str_enrichment_json, ai_copy_json: f.ai_copy_json, status: "estimated" }).eq("id", reportId));
    workspace = await json(root);
    expect((await api(root, "GET", undefined, 1)).status).toBe(404);
    expect((await api(`${root}/activity`, "GET", undefined, 1)).status).toBe(404);
    const form = new FormData(); const bytes = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
    form.set("file", new File([bytes], "Agreement information.pdf", { type: "application/pdf" }));
    const upload = await fetch(`${origin}${root}/attachments`, { method: "POST", headers: { Cookie: cookieHeaders[0], Origin: origin }, body: form });
    expect(upload.status, await upload.clone().text()).toBe(201);
    const attachment = (await upload.json()).attachment;
    paths.push({ bucket: "proposal-documents", path: `${agencyId}/${reportId}/${attachment.id}.pdf` });
    const link = { id: randomUUID(), kind: "sign", label: "Review & sign agreement", url: "https://example.com/agreement" };
    const draft = { ...workspace.draft!, presetId: "studio", heroLayout: "split", brandOverrides: { primary: "#ff0000" }, attachmentIds: [attachment.id], links: [link], agentIds, content: { ...workspace.draft!.content, comparisonTitle: "CUSTOMER SHOULD NOT EDIT THIS" }, pages: workspace.draft!.pages.map(page => ({ ...page, title: "CUSTOMER PAGE EDIT", body: "CUSTOMER PAGE CONTENT" })) };
    expect((await api(root, "PUT", { revision: workspace.revision, draft: { ...draft, agentIds: [foreignAgentId] } })).status).toBe(400);
    expect((await api(root, "PUT", { revision: workspace.revision, draft: { ...draft, agentIds: [archivedAgentId] } })).status).toBe(400);
    const saved = await json(root, "PUT", { revision: workspace.revision, draft });
    expect(saved.draft.agentIds).toEqual(agentIds);
    expect(saved.draft.content.comparisonTitle).toBe(initial.content.comparisonTitle);
    expect(saved.draft.pages[0].title).toBe(initial.pages[0].title);
    expect(saved.draft.pages[0].body).toBe(initial.pages[0].body);
    expect(saved.draft.presetId).toBe(initial.presetId); expect(saved.draft.heroLayout).toBe("overlay");
    expect(saved.draft.brandOverrides.primary).not.toBe("#ff0000");
    const noChange = await json(root, "PUT", { revision: saved.revision, draft: saved.draft }); expect(noChange.revision).toBe(saved.revision);
    expect((await api(root, "PUT", { revision: saved.revision - 1, draft })).status).toBe(409);
    const first = (await json(`${root}/publish`, "POST", { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint })).version;
    const repeated = (await json(`${root}/publish`, "POST", { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint })).version;
    expect(repeated.id).toBe(first.id); expect(repeated.path).toBe(first.path);
    const publicPath = first.path; const token = publicPath.split("/").pop();
    if (process.env.STR_HAVEN_TEST === "1") {
      const frozen = check(await admin.from("digital_proposal_versions").select("final_report_json").eq("id", first.id).single()).final_report_json;
      expect(frozen.pdfReport.template_id).toBe("haven-properties-str");
      expect(frozen.pdfReport.agents.map((agent: { name: string }) => agent.name)).toEqual(["Alex Adviser", "Taylor Agent"]);
      expect(frozen.pdfReport.str.annual_revenue).toBe(frozen.data.str.managed.annualRevenue);
      expect(frozen.pdfReport.ltr.annual_midpoint).toBe(frozen.data.ltr.annualRent);
      expect((await api(`/proposal/print/${first.id}`, "GET", undefined, 2)).status).toBe(404);
      const printPath = new URL(proposalPrintUrl(first.id, origin));
      const printed = await api(`${printPath.pathname}${printPath.search}`, "GET", undefined, 2);
      expect(printed.status).toBe(200);
      const content = await printed.text(); expect(content).toContain("Alex Adviser"); expect(content).not.toContain("Shannyn Laird");
    }
    const publicPage = await api(publicPath, "GET", undefined, 2); expect(publicPage.status).toBe(200);
    const html = await publicPage.text(); expect(html).toContain("Jordan QA"); expect(html).not.toContain("private-qa@example.com"); expect(html).not.toContain("0412345678");
    // A manual host deploy can serve HTML while omitting the framework's asset folder.
    const assets = [...new Set([...html.matchAll(/(?:src|href)="([^"?]*\/_next\/static\/[^"?]+\.(?:css|js))(?:\?[^"]*)?"/g)].map(match => match[1]))];
    expect(assets.some(asset => asset.endsWith(".css"))).toBe(true);
    expect(assets.some(asset => asset.endsWith(".js"))).toBe(true);
    await Promise.all(assets.map(async asset => {
      const response = await fetch(new URL(asset, origin));
      expect(response.status, `Published asset missing: ${asset}`).toBe(200);
      expect(response.headers.get("content-type")).toMatch(asset.endsWith(".css") ? /text\/css/ : /javascript/);
      await response.arrayBuffer();
    }));
    if (process.env.STR_HAVEN_TEST === "1") {
      const service = await api(`${first.path}?page=service`, "GET", undefined, 2);
      expect(service.status).toBe(200); expect(await service.text()).toContain("Thoughtfully managed.");
    }
    expect(publicPage.headers.get("cache-control")).toMatch(/no-store|no-cache, must-revalidate/);
    expect(publicPage.headers.get("referrer-policy")).toBe("no-referrer");
    expect((await api(`/api/proposals/${token}/attachments/${attachment.id}`, "GET", undefined, 2)).status).toBe(200);
    expect((await api(`/api/proposals/${token}/attachments/${randomUUID()}`, "GET", undefined, 2)).status).toBe(404);
    const contactsHtml = await (await api(`${first.path}?page=next-steps`, "GET", undefined, 2)).text();
    expect(contactsHtml).toContain("Alex Adviser"); expect(contactsHtml).toContain("Taylor Agent");
    // Production Cloudflare email protection rewrites mailto URLs in the HTML;
    // compare the underlying address rather than requiring one wire encoding.
    const contactLinks = load(contactsHtml)("a[href^='mailto:'], a[href^='/cdn-cgi/l/email-protection#']").toArray().map(node => {
      const href = node.attribs.href;
      if (!href.startsWith("/cdn-cgi/l/email-protection#")) return decodeURIComponent(href);
      const bytes = Buffer.from(href.split("#")[1], "hex");
      return `mailto:${decodeURIComponent(Buffer.from(bytes.subarray(1).map(byte => byte ^ bytes[0])).toString("utf8"))}`;
    });
    expect(contactLinks).toContain("mailto:alex@example.com"); expect(contactsHtml).not.toContain("Other agency contact");
    const session = randomUUID();
    const event = { id: randomUUID(), session, kind: "open", target: "proposal" };
    expect((await api(`/api/proposals/${token}/events`, "POST", event, 2)).status).toBe(204);
    await api(`/api/proposals/${token}/events`, "POST", { ...event, id: randomUUID() }, 2);
    await api(`/api/proposals/${token}/events`, "POST", { ...event, id: randomUUID(), kind: "page", target: "appraisal" }, 2);
    await api(`/api/proposals/${token}/events`, "POST", { ...event, id: randomUUID(), kind: "agreement", target: link.id }, 2);
    await api(`/api/proposals/${token}/events`, "POST", { ...event, id: randomUUID(), kind: "document", target: randomUUID() }, 2);
    const bot = await fetch(`${origin}/api/proposals/${token}/events`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "User-Agent": "Slackbot 1.0" }, body: JSON.stringify({ ...event, id: randomUUID(), session: randomUUID() }) }); expect(bot.status).toBe(204);
    const activity = await json(`${root}/activity`); expect(activity.opens).toBe(1); expect(activity.items).toHaveLength(3); expect(activity.items.find((item: {kind:string}) => item.kind === "agreement").label).toBe(link.label);
    const list = await json("/api/str/appraisals"); expect(list.counts.published).toBe(1); expect(list.rows[0].proposal_opens).toBe(1);
    const appraisal = check(await admin.from("str_appraisals").select("*").eq("report_id", reportId).single());
    await json(`/api/str/appraisals/${reportId}`, "PATCH", { recipient: { mode: "named", name: "Alex QA", email: "private-new@example.com", phone: "0412345678" }, expected_updated_at: appraisal.updated_at });
    expect((await api(`${root}/publish`, "POST", { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint })).status).toBe(409);
    workspace = await json(root); expect(workspace.data!.recipient!.displayName).toBe("Alex QA");
    const second = (await json(`${root}/publish`, "POST", { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint })).version; expect(second.id).not.toBe(first.id);
    expect(await (await api(first.path, "GET", undefined, 2)).text()).toContain("Jordan QA");
    expect(await (await api(second.path, "GET", undefined, 2)).text()).toContain("Alex QA");
    if (process.env.STR_PDF_TEST === "1") {
      const pdfResult = await json(`${root}/pdf`, "POST", { versionId: second.id }); expect(pdfResult.status).toBe("ready");
      paths.push({ bucket: "proposal-pdfs", path: `${agencyId}/${reportId}/${second.id}.pdf` });
      const pdf = await api(`/api/proposals/${second.path.split("/").pop()}/pdf`, "GET", undefined, 2); expect(pdf.status).toBe(200);
      const buffer = Buffer.from(await pdf.arrayBuffer()); expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
      if (process.env.STR_HAVEN_TEST === "1") expect(buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length, "Havenly's PDF must retain its two-page layout").toBe(2);
      mkdirSync("tmp/pdfs", { recursive: true }); writeFileSync("tmp/pdfs/proposal-integration-qa.pdf", buffer);
    }
    await json(`${root}/revoke`, "POST", { versionId: first.id, linkId: first.link_id });
    expect((await api(first.path, "GET", undefined, 2)).status).toBe(404);
    expect((await api(`/api/proposals/${token}/attachments/${attachment.id}`, "GET", undefined, 2)).status).toBe(404);
    expect((await api(second.path, "GET", undefined, 2)).status).toBe(200);
    const regenerated = (await json(`${root}/publish`, "POST", { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint })).version; expect(regenerated.id).toBe(second.id);
    await json(`${root}/revoke`, "POST", { versionId: second.id, linkId: second.link_id });
    const replacement = (await json(`${root}/publish`, "POST", { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint })).version;
    expect(replacement.id).toBe(second.id); expect(replacement.path).not.toBe(second.path);
    expect((await api(second.path, "GET", undefined, 2)).status).toBe(404);
    expect((await api(replacement.path, "GET", undefined, 2)).status).toBe(200);
    check(await admin.from("agent_profiles").update({ name: "Edited after publication" }).eq("id", agentIds[0]));
    const frozenContacts = await (await api(`${replacement.path}?page=next-steps`, "GET", undefined, 2)).text();
    expect(frozenContacts).toContain("Alex Adviser"); expect(frozenContacts).not.toContain("Edited after publication");
    // Access must remain fresh after multiple visits have warmed the immutable snapshot.
    check(await admin.from("digital_proposal_versions").update({ revoked_at: new Date().toISOString() }).eq("id", replacement.id));
    expect((await api(replacement.path, "GET", undefined, 2)).status).toBe(404);
    check(await admin.from("digital_proposal_versions").update({ revoked_at: null }).eq("id", replacement.id));
    expect((await api(replacement.path, "GET", undefined, 2)).status).toBe(200);
    check(await admin.from("listings").update({ status: "archived" }).eq("id", listingId));
    expect((await api(replacement.path, "GET", undefined, 2)).status).toBe(404);
    expect((await api(`/api/proposals/${replacement.path.split("/").pop()}/pdf`, "GET", undefined, 2)).status).toBe(404);
    await json(`/api/str/appraisals/${reportId}`, "DELETE");
    expect((await api(second.path, "GET", undefined, 2)).status).toBe(404);
    expect((await api(`/api/proposals/${second.path.split("/").pop()}/pdf`, "GET", undefined, 2)).status).toBe(404);
  } finally {
    if (usesR2Storage()) {
      // Only this test's generated agency prefix, including mirrored render assets.
      const config = r2Configuration(), client = r2Client();
      for (const [Bucket, buckets] of [[config.publicBucket, ["report-assets", "report-pdfs"]], [config.privateBucket, ["proposal-pdfs", "proposal-documents"]]] as const) {
        for (const bucket of buckets) {
          let ContinuationToken: string | undefined;
          do {
            const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: `${bucket}/${agencyId}/`, ContinuationToken }));
            for (const object of page.Contents ?? []) await client.send(new DeleteObjectCommand({ Bucket, Key: object.Key! }));
            ContinuationToken = page.NextContinuationToken;
          } while (ContinuationToken);
        }
      }
    }
    for (const { bucket, path } of paths) await admin.storage.from(bucket).remove([path]);
    // Branded PDFs mirror print assets under disposable version folders.
    const folders = await admin.storage.from("report-assets").list(agencyId);
    for (const folder of folders.data ?? []) {
      for (const kind of ["pdf-images", "pdf-assets"]) {
        const prefix = `${agencyId}/${folder.name}/${kind}`;
        const files = await admin.storage.from("report-assets").list(prefix);
        if (files.data?.length) await admin.storage.from("report-assets").remove(files.data.map(file => `${prefix}/${file.name}`));
      }
    }
    await admin.from("agencies").delete().in("id", [agencyId, otherAgencyId]);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }
}, 300_000);
