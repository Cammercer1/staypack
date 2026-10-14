// Creates and removes its own QA identities; sends no email and makes no paid estimate calls.
// Run inside the app container: node scripts/verify-str-calculator.mjs
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.CALCULATOR_TEST_URL || "http://localhost:3000";
assert(url && key && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Supabase test credentials required");
const admin = createClient(url, key, { auth: { persistSession: false } });
const agencies = [randomUUID(), randomUUID()];
const users = [];
const sessions = [];
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const hash = value => createHmac("sha256", key).update(`str-calculator:${value}`).digest("hex");
async function identity(agencyId, role) {
  const email = `calculator-qa-${randomUUID()}@example.com`, password = `${randomUUID()}Aa1!`;
  const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  users.push(user.id);
  check(await admin.from("agency_members").insert({ agency_id: agencyId, user_id: user.id, role }));
  const cookies = [];
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => { cookies.splice(0, cookies.length, ...values); } } });
  check(await client.auth.signInWithPassword({ email, password }));
  sessions.push(client);
  return { client, cookie: cookies.map(c => `${c.name}=${c.value}`).join("; ") };
}
async function settings(identity, body) {
  const response = await fetch(`${base}/api/marketing/str-calculator`, { method: "PUT", headers: { Cookie: identity.cookie, "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "manual" });
  return { status: response.status, body: await response.json() };
}
try {
  for (const [index, id] of agencies.entries()) check(await admin.from("agencies").insert({ id, name: `Calculator QA ${index}`, slug: `calculator-qa-${id}`, primary_colour: "#095b42" }));
  const owner = await identity(agencies[0], "owner");
  const member = await identity(agencies[0], "member");
  const outsider = await identity(agencies[1], "owner");
  assert.equal((await settings(member, { enabled: true, country: "AU" })).status, 403);
  const activated = await settings(owner, { enabled: true, country: "AU" });
  assert.equal(activated.status, 200, JSON.stringify(activated.body));
  const widget = activated.body.widget;
  assert.equal(widget.ask_phone, false, "Phone collection must start disabled");
  const phoneSettings = await settings(owner, { enabled: true, country: "AU", ask_phone: true });
  assert.equal(phoneSettings.status, 200);
  assert.equal(phoneSettings.body.widget.ask_phone, true);
  const saved = await settings(owner, { enabled: true, country: "AU" });
  assert.equal(saved.body.widget.public_token, widget.public_token, "Saving settings must preserve the embed URL");
  assert.equal(saved.body.widget.ask_phone, true, "Older settings clients must not reset phone collection");
  assert.equal(check(await outsider.client.from("str_calculator_widgets").select("id")).length, 0);
  const embed = await fetch(`${base}/embed/str-calculator/${widget.public_token}`);
  assert.equal(embed.status, 200); assert.match(await embed.text(), /Calculator QA 0/);
  assert(!embed.headers.get("x-frame-options"), "Embed cannot be blocked by frame headers");
  // Next dev replaces page Cache-Control with no-cache; production uses no-store.
  assert.match(embed.headers.get("cache-control"), /no-store|no-cache/);

  const input = { address: "12 Test Street, Sydney NSW 2000", bedrooms: 3, bathrooms: 1.5, email: "qa@example.com", consent: true, phone: "0412 345 678" };
  const requestId = randomUUID();
  const lead = check(await admin.rpc("reserve_str_calculator_lead", { p_token: widget.public_token, p_request_id: requestId, p_input_hash: hash(JSON.stringify({ ...input, country: "AU" })), p_client_hash: hash(`${widget.id}:local`), p_input: { ...input, country: "AU", guests: 6, radiusM: 2000 }, p_consent_version: "str-calculator-v1", p_consent_text: "QA consent" }));
  assert.equal(check(await admin.from("str_calculator_leads").select("input_json").eq("id", lead.id).single()).input_json.bathrooms, 1.5);
  assert.equal(check(await admin.from("str_calculator_leads").select("phone,input_json").eq("id", lead.id).single()).input_json.phone, input.phone);
  const estimate = { annualRevenue: 62400, monthlyRevenue: 5200, nightlyRate: 260, occupancyRate: 65.8, currency: "AUD", address: input.address, bedrooms: 3, bathrooms: 1.5, guests: 6 };
  check(await admin.from("str_calculator_leads").update({ status: "estimated", estimate_json: estimate, original_estimate_json: { private: true } }).eq("id", lead.id));
  const submission = await fetch(`${base}/api/str-calculator/${widget.public_token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId, website: "" }) });
  assert.equal(submission.status, 200);
  assert.match(submission.headers.get("cache-control"), /no-store/);
  assert.deepEqual((await submission.json()).estimate, estimate);
  const changedBathrooms = await fetch(`${base}/api/str-calculator/${widget.public_token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, bathrooms: 2, requestId, website: "" }) });
  assert.equal(changedBathrooms.status, 409, "A changed bathroom count cannot replay a previous estimate");
  const memberLeads = check(await member.client.from("str_calculator_leads").select("id,email,phone,estimate_json"));
  assert.equal(memberLeads.length, 1);
  assert.equal(memberLeads[0].phone, input.phone);
  assert.equal(check(await outsider.client.from("str_calculator_leads").select("id,email,phone")).length, 0);
  assert((await member.client.from("str_calculator_leads").select("original_estimate_json")).error);
  assert((await member.client.from("str_calculator_leads").insert({ agency_id: agencies[0] })).error);
  assert((await outsider.client.from("str_calculator_widgets").update({ enabled: false }).eq("id", widget.id).select("id")).data.length === 0);
  const dashboard = await fetch(`${base}/marketing/str-calculator`, { headers: { Cookie: owner.cookie } });
  assert.equal(dashboard.status, 200); const html = await dashboard.text();
  for (const href of ["/create", "/appraisals", "/appraisals/rental", "/appraisals/sales", "/short-term-rentals", "/brochures", "/social", "/marketing/str-calculator"]) {
    assert(html.includes(`href="${href}"`), `Production navigation must retain ${href}`);
  }
  assert.match(html, /qa@example.com/); assert.match(html, /12 Test Street/);
  assert.match(html, /aria-current="page"[^>]*>.*?Leads/);
  assert.doesNotMatch(html, /id="calculator-embed-code"/);
  const setup = await fetch(`${base}/marketing/str-calculator?tab=setup`, { headers: { Cookie: owner.cookie } });
  assert.equal(setup.status, 200); const setupHtml = await setup.text();
  assert.match(setupHtml, /id="calculator-embed-code"/);
  assert.doesNotMatch(setupHtml, /id="calculator-leads-heading"/);
  assert.match(html, /0412 345 678/);
  assert(!html.includes('"private":true'), "Raw estimate must not appear in client data");
  assert.equal((await settings(owner, { enabled: true, country: "AU", ask_phone: false })).body.widget.ask_phone, false);
  const ignoredPhone = check(await admin.rpc("reserve_str_calculator_lead", { p_token: widget.public_token, p_request_id: randomUUID(), p_input_hash: "phone-disabled", p_client_hash: "phone-disabled-client", p_input: { ...input, country: "AU" }, p_consent_version: "str-calculator-v2", p_consent_text: "QA consent" }));
  const ignored = check(await admin.from("str_calculator_leads").select("phone,input_json").eq("id", ignoredPhone.id).single());
  assert.equal(ignored.phone, null);
  assert(!Object.hasOwn(ignored.input_json, "phone"), "Disabled phone must not be retained");
  assert.equal((await settings(owner, { enabled: false, country: "AU" })).status, 200);
  const paused = await fetch(`${base}/api/str-calculator/${widget.public_token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId, website: "" }) });
  assert.equal(paused.status, 404);
  const pausedEmbed = await fetch(`${base}/embed/str-calculator/${widget.public_token}`);
  assert.match(await pausedEmbed.text(), /Calculator unavailable/);
  const anonymous = await fetch(`${base}/marketing/str-calculator`, { redirect: "manual" });
  assert.equal(anonymous.status, 307);
  console.log("PASS: admin settings, optional phone persistence and disabled-field stripping, stable embed URL, public rendering, no-store/frame headers, retry response, lead capture, tenant isolation, raw-data privacy, dashboard, pause and anonymous protection. No paid calls.");
} finally {
  for (const client of sessions) await client.auth.signOut({ scope: "global" });
  for (const id of agencies) check(await admin.from("agencies").delete().eq("id", id));
  for (const id of users) check(await admin.auth.admin.deleteUser(id));
}
