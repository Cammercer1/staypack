create index proposal_events_scope on public.digital_proposal_events(agency_id,report_id,version_id,link_id);
-- Targets are interpreted within the immutable version that the visitor viewed.
create or replace function public.proposal_activity_summary(p_agency_id uuid,p_report_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('opens',count(*) filter(where kind='open'),'sessions',count(distinct session_id),
    'lastOpened',max(created_at) filter(where kind='open'),
    'items',coalesce((select jsonb_agg(t) from (
      select version_id as "versionId",kind,target,count(*) as count,max(created_at) as "lastSeen" from public.digital_proposal_events
      where agency_id=p_agency_id and report_id=p_report_id group by version_id,kind,target order by max(created_at) desc limit 100
    ) t),'[]'::jsonb))
  from public.digital_proposal_events where agency_id=p_agency_id and report_id=p_report_id;
$$;
