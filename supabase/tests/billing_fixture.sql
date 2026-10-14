-- EMPTY disposable PostgreSQL only. Never run this fixture against Supabase.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.agencies(id uuid primary key,name text);
create table public.agency_members(agency_id uuid,user_id uuid,role text);
create table public.reports(id uuid primary key,agency_id uuid,status text default 'draft',published_at timestamptz);
create table public.digital_proposal_versions(id uuid primary key,report_id uuid,agency_id uuid);
grant select on public.agency_members to authenticated;
alter table public.reports enable row level security;
create policy report_members on public.reports for all to authenticated
  using (exists(select 1 from public.agency_members m where m.agency_id=reports.agency_id and m.user_id=(select auth.uid())))
  with check (exists(select 1 from public.agency_members m where m.agency_id=reports.agency_id and m.user_id=(select auth.uid())));
grant select,update on public.reports to authenticated;
grant all on all tables in schema public to service_role;
insert into public.agencies values('20000000-0000-4000-8000-000000000001','Billing test A'),('20000000-0000-4000-8000-000000000002','Billing test B');
insert into public.agency_members values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','owner'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member');
