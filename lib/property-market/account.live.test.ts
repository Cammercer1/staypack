import { expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { newListingPayload, valuesFromListing } from "@/lib/listings/newListingDraft";
vi.mock("server-only", () => ({}));
// Opt-in: real country settings, RLS and provider requests using disposable accounts.
it.skipIf(process.env.COUNTRY_INTEGRATION_TEST !== "1")("routes country-scoped property discovery, saves and account changes through authenticated APIs", async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}});
  const origin = process.env.STAGING_BASE_URL ?? "http://localhost:3000";
  const agencies: string[] = [], users: string[] = [];
  const check = <T extends { data: unknown; error: {message:string} | null }>(r:T): NonNullable<T["data"]> => { if (r.error) throw new Error(r.error.message); return r.data as NonNullable<T["data"]>; };
  async function actor(agencyId:string, role:"owner"|"member") {
    const email=`country-${randomUUID()}@example.com`, password=`${randomUUID()}Aa1!`;
    const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user!; users.push(user.id);
    check(await admin.from("agency_members").insert({agency_id:agencyId,user_id:user.id,role}));
    const cookies:{name:string;value:string}[]=[];
    const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>cookies,setAll:next=>{cookies.splice(0,cookies.length,...next);}}});
    check(await client.auth.signInWithPassword({email,password}));
    return {client,api:async(path:string,method="POST",body?:unknown) => {
      const response=await fetch(`${origin}${path}`,{method,redirect:"manual",headers:{"Content-Type":"application/json",Origin:origin,Cookie:cookies.map(c=>`${c.name}=${c.value}`).join("; "),"User-Agent":"Mozilla/5.0 Safari/605.1"},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    }};
  }
  try {
    const au=check(await admin.from("agencies").insert({name:"Country integration AU",slug:`country-${randomUUID()}`}).select("*").single()); agencies.push(au.id);
    const us=check(await admin.from("agencies").insert({name:"Country integration US",slug:`country-${randomUUID()}`,country_code:"US"}).select("*").single()); agencies.push(us.id);
    expect(au.country_code).toBe("AU");
    const auOwner=await actor(au.id,"owner"),usOwner=await actor(us.id,"owner"),member=await actor(us.id,"member");
    const settings={settings_section:"details",name:us.name,slug:us.slug,website_url:"",email:"",phone:"",country_code:"US"};
    expect((await member.api("/api/agencies","PATCH",{...settings,country_code:"AU"})).status).toBe(400);
    expect(check(await member.client.from("agencies").update({country_code:"AU"}).eq("id",us.id).select("id"))).toEqual([]);
    expect(check(await auOwner.client.from("agencies").update({country_code:"AU"}).eq("id",us.id).select("id"))).toEqual([]);
    expect((await usOwner.api("/api/agencies","PATCH",settings)).body.agency.country_code).toBe("US");
    expect((await usOwner.api("/api/agencies","PATCH",{...settings,country_code:"NZ"})).status).toBe(400);
    for(const a of [auOwner,usOwner]) {
      expect((await a.api("/api/listings/lookup","POST",{action:"search",country:a===auOwner?"US":"AU",query:"545 Westbourne Drive"})).status).toBe(400);
      expect((await a.api("/api/listings/address-suggestions","POST",{action:"suggest",country:a===auOwner?"US":"AU",input:"545 Westbourne",sessionToken:randomUUID()})).status).toBe(400);
    }
    const found=await usOwner.api("/api/listings/lookup","POST",{action:"search",query:"545 Westbourne Drive, West Hollywood CA 90048"});
    expect(found.status,JSON.stringify(found.body)).toBe(200);
    expect(found.body.candidates.length).toBeGreaterThan(0);
    expect(found.body.candidates.every((c:{country:string;source:string})=>c.country==="US"&&c.source==="google")).toBe(true);
    expect((await auOwner.api("/api/listings/lookup","POST",{action:"select",candidate:found.body.candidates[0]})).status).toBe(400);
    const selected=await usOwner.api("/api/listings/lookup","POST",{action:"select",candidate:found.body.candidates[0]});
    expect(selected.status,JSON.stringify(selected.body)).toBe(200);
    expect(selected.body.draft.country).toBe("United States");
    expect(selected.body.draft.scraped_listing_json?.usProperty?.zpid).toBeTruthy();
    const payload=newListingPayload(selected.body.draft,valuesFromListing(selected.body.draft),[]);
    expect((await auOwner.api("/api/listings","POST",payload)).status).toBe(400);
    const saved=await usOwner.api("/api/listings","POST",{...payload,country:"US"});
    expect(saved.status,JSON.stringify(saved.body)).toBeLessThan(300);
    const id=saved.body.listing?.id ?? saved.body.id;
    expect(id).toBeTruthy();
    expect(saved.body.listing.country).toBe("United States");
    expect((await usOwner.api(`/api/listings/${id}`,"PATCH",{country:"Australia"})).status).toBe(400);
    const auSearch=await auOwner.api("/api/listings/lookup","POST",{action:"search",query:"18/8-12 Ascot Street Kensington NSW 2033"});
    expect(auSearch.status).toBe(200);
    expect(auSearch.body.candidates.some((c:{source:string})=>c.source==="domain"),JSON.stringify(auSearch.body)).toBe(true);
    // Change the account via the same settings endpoint; old properties are not rewritten.
    expect((await usOwner.api("/api/agencies","PATCH",{...settings,country_code:"AU"})).body.agency.country_code).toBe("AU");
    expect(check(await admin.from("listings").select("country").eq("id",id).single()).country).toBe("United States");
    expect((await usOwner.api("/api/properties","GET")).body.properties ?? []).toEqual([]);
    expect((await usOwner.api("/api/listings/lookup","POST",{action:"select",candidate:found.body.candidates[0]})).status).toBe(400);
  } finally {
    for(const id of agencies) check(await admin.from("agencies").delete().eq("id",id));
    for(const id of users) check(await admin.auth.admin.deleteUser(id));
  }
},180000);
