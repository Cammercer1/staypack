-- EMPTY disposable PostgreSQL 17 only. Never run this fixture on Supabase.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
-- Sentinels verify that cache migration/operations never rewrite existing data.
create table public.reports (id int primary key, final_report_json jsonb, original_estimate_json jsonb);
create table public.str_calculator_leads (id int primary key, original_estimate_json jsonb);
create table public.billing_accounts (id int primary key, metering_enabled boolean);
insert into public.reports values (1, '{"published":"unchanged"}', '{"historical":"unchanged"}');
insert into public.str_calculator_leads values (1, '{"historical":"unchanged"}');
insert into public.billing_accounts values (1, false);
