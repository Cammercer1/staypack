-- Minimal dependency fixture for an EMPTY, disposable PostgreSQL 17 database.
-- Never run this file on a Supabase project. Apply the workspace migration after it.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to public;
create table public.agencies(id uuid primary key,name text);
create table public.agency_members(agency_id uuid,user_id uuid);
create function public.is_agency_member(target_agency_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.agency_members where agency_id=target_agency_id and user_id=auth.uid())
$$;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table public.listings(id uuid primary key,agency_id uuid,status text default 'active',property_address text,suburb text,hero_image_url text);
create table public.reports(id uuid primary key default gen_random_uuid(),agency_id uuid,listing_id uuid,created_by uuid,template_id text,status text default 'draft',final_report_json jsonb,pdf_url text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.collateral_items(id uuid primary key default gen_random_uuid(),agency_id uuid,listing_id uuid,type text,status text,report_id uuid,unique(listing_id,type));
alter table public.reports enable row level security;
alter table public.listings enable row level security;
alter table public.collateral_items enable row level security;
create policy reports_members on public.reports for all to authenticated using(public.is_agency_member(agency_id)) with check(public.is_agency_member(agency_id));
create policy listings_members on public.listings for all to authenticated using(public.is_agency_member(agency_id)) with check(public.is_agency_member(agency_id));
create policy collateral_members on public.collateral_items for all to authenticated using(public.is_agency_member(agency_id)) with check(public.is_agency_member(agency_id));
grant all on all tables in schema public to authenticated,service_role;

insert into auth.users values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.agencies values ('20000000-0000-4000-8000-000000000001','Test agency A'),('20000000-0000-4000-8000-000000000002','Test agency B');
insert into public.agency_members values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
insert into public.listings(id,agency_id,property_address) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','24 Beach Road'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','7 Second Street');
insert into public.reports(id,agency_id,listing_id,template_id,final_report_json,status) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','classic-detailed','{"version":"standard_2_page_v1","fixture":"unchanged"}','published'),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',null,null,'draft'),
('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',null,null,'draft');
insert into public.collateral_items(agency_id,listing_id,type,report_id,status) values
('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','lease_appraisal','40000000-0000-4000-8000-000000000002','draft');
