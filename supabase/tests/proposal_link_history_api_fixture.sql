-- Synthetic data checksums for the compatibility migration. Disposable DB ONLY.
create table public.proposal_link_history_api_baseline as
select 'history'::text as name, coalesce(jsonb_agg(to_jsonb(h) order by agency_id,report_id,version_id,link_id),'[]'::jsonb) as rows
  from public.digital_proposal_link_versions h
union all
select 'links',coalesce(jsonb_agg(to_jsonb(k) order by id),'[]'::jsonb) from public.digital_proposal_links k
union all
select 'versions',coalesce(jsonb_agg(to_jsonb(v) order by id),'[]'::jsonb) from public.digital_proposal_versions v
union all
select 'events',coalesce(jsonb_agg(to_jsonb(e) order by id),'[]'::jsonb) from public.digital_proposal_events e;
