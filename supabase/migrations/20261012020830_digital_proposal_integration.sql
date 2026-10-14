-- Account-owned design assignments. Writes are restricted to the onboarding service.
create table public.digital_proposal_assignments (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  name text not null check(length(name) between 1 and 120),
  version integer not null check(version > 0),
  defaults jsonb not null check(jsonb_typeof(defaults)='object'),
  updated_at timestamptz not null default now()
);
alter table public.digital_proposal_assignments enable row level security;
revoke all on public.digital_proposal_assignments from public,anon,authenticated;
grant select on public.digital_proposal_assignments to authenticated;
grant all on public.digital_proposal_assignments to service_role;
create policy proposal_assignment_read on public.digital_proposal_assignments for select to authenticated using(public.is_agency_member(agency_id));

alter table public.digital_proposal_versions
  add column content_hash text,
  add column source_fingerprint text,
  add column pdf_status text not null default 'pending' check(pdf_status in ('pending','generating','ready','failed')),
  add column pdf_path text,
  add column pdf_started_at timestamptz,
  add constraint proposal_version_scope unique(agency_id,report_id,id),
  drop constraint digital_proposal_versions_report_id_draft_revision_key;
create unique index proposal_version_content on public.digital_proposal_versions(report_id,content_hash) where content_hash is not null;

create table public.digital_proposal_links (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null, report_id uuid not null, version_id uuid not null,
  token text not null unique check(token ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(), revoked_at timestamptz,
  foreign key(agency_id,report_id,version_id) references public.digital_proposal_versions(agency_id,report_id,id) on delete cascade,
  unique(agency_id,report_id,version_id,id)
);
create index proposal_links_version on public.digital_proposal_links(agency_id,report_id,version_id);
insert into public.digital_proposal_links(agency_id,report_id,version_id,token,created_at,revoked_at)
  select agency_id,report_id,id,share_token,created_at,revoked_at from public.digital_proposal_versions;
alter table public.digital_proposal_links enable row level security;
revoke all on public.digital_proposal_links from public,anon,authenticated;
grant select on public.digital_proposal_links to authenticated;
grant all on public.digital_proposal_links to service_role;
create policy proposal_links_read on public.digital_proposal_links for select to authenticated using(public.is_agency_member(agency_id));

create table public.digital_proposal_events (
  id uuid primary key, agency_id uuid not null, report_id uuid not null, version_id uuid not null, link_id uuid not null,
  session_id uuid not null, kind text not null check(kind in ('open','page','comparison','comparable','pdf','document','action','agreement')),
  target text not null check(length(target) between 1 and 100), created_at timestamptz not null default now(),
  foreign key(agency_id,report_id,version_id,link_id) references public.digital_proposal_links(agency_id,report_id,version_id,id) on delete cascade,
  unique(link_id,session_id,kind,target)
);
create index proposal_events_report_time on public.digital_proposal_events(agency_id,report_id,created_at desc);
create index proposal_events_link_time on public.digital_proposal_events(link_id,created_at desc);
alter table public.digital_proposal_events enable row level security;
revoke all on public.digital_proposal_events from public,anon,authenticated;
grant select on public.digital_proposal_events to authenticated;
grant all on public.digital_proposal_events to service_role;
create policy proposal_events_read on public.digital_proposal_events for select to authenticated using(public.is_agency_member(agency_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('proposal-pdfs','proposal-pdfs',false,20971520,array['application/pdf']);

-- A repeated save with identical content does not create a new revision.
create or replace function public.save_digital_proposal(p_agency_id uuid,p_report_id uuid,p_revision integer,p_draft jsonb)
returns public.digital_proposal_drafts language plpgsql security invoker set search_path='' as $$
declare v_draft public.digital_proposal_drafts;
begin
  perform 1 from public.reports r join public.str_appraisals a on a.report_id=r.id join public.listings l on l.id=r.listing_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived' for update of r;
  if not found then raise exception 'Active appraisal not found' using errcode='PT404'; end if;
  select * into v_draft from public.digital_proposal_drafts where report_id=p_report_id for update;
  if found then
    if v_draft.revision<>p_revision then raise exception 'This draft changed in another session. Reload before saving.' using errcode='PT409'; end if;
    if v_draft.draft_json=p_draft then return v_draft; end if;
    update public.digital_proposal_drafts set draft_json=p_draft,revision=revision+1,updated_at=now()
      where report_id=p_report_id returning * into v_draft;
  else
    if p_revision<>0 then raise exception 'Reload before saving this draft.' using errcode='PT409'; end if;
    insert into public.digital_proposal_drafts(report_id,agency_id,draft_json) values(p_report_id,p_agency_id,p_draft) returning * into v_draft;
  end if;
  return v_draft;
end; $$;

create function public.publish_digital_proposal_v2(p_agency_id uuid,p_report_id uuid,p_revision integer,p_snapshot jsonb,p_token text,
  p_content_hash text,p_source_fingerprint text,p_assignment_version integer,
  p_report_updated timestamptz,p_listing_updated timestamptz,p_appraisal_updated timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_version public.digital_proposal_versions; v_link public.digital_proposal_links; v_revision integer; v_assignment integer;
begin
  perform 1 from public.reports r join public.str_appraisals a on a.report_id=r.id join public.listings l on l.id=r.listing_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived'
    and r.updated_at=p_report_updated and l.updated_at=p_listing_updated and a.updated_at=p_appraisal_updated for update of r,l,a;
  if not found then raise exception 'The appraisal changed. Reload the preview before publishing.' using errcode='PT409'; end if;
  select version into v_assignment from public.digital_proposal_assignments where agency_id=p_agency_id for share;
  if coalesce(v_assignment,1)<>p_assignment_version then raise exception 'The brand design changed. Reload the preview.' using errcode='PT409'; end if;
  select revision into v_revision from public.digital_proposal_drafts where report_id=p_report_id and agency_id=p_agency_id for update;
  if v_revision is null or v_revision<>p_revision then raise exception 'Save the latest draft before publishing.' using errcode='PT409'; end if;
  select * into v_version from public.digital_proposal_versions where report_id=p_report_id and content_hash=p_content_hash;
  if not found then
    insert into public.digital_proposal_versions(report_id,agency_id,draft_revision,share_token,final_report_json,content_hash,source_fingerprint)
      values(p_report_id,p_agency_id,p_revision,p_token,p_snapshot,p_content_hash,p_source_fingerprint) returning * into v_version;
  end if;
  if v_version.revoked_at is not null then raise exception 'This publication was archived. Save a new revision before republishing.' using errcode='PT409'; end if;
  select * into v_link from public.digital_proposal_links where version_id=v_version.id and revoked_at is null order by created_at desc limit 1;
  if not found then
    insert into public.digital_proposal_links(agency_id,report_id,version_id,token) values(p_agency_id,p_report_id,v_version.id,p_token) returning * into v_link;
  end if;
  return jsonb_build_object('id',v_version.id,'draft_revision',v_version.draft_revision,'created_at',v_version.created_at,
    'revoked_at',v_link.revoked_at,'link_id',v_link.id,'share_token',v_link.token,'pdf_status',v_version.pdf_status,'source_fingerprint',v_version.source_fingerprint);
end; $$;
revoke all on function public.publish_digital_proposal_v2(uuid,uuid,integer,jsonb,text,text,text,integer,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.publish_digital_proposal_v2(uuid,uuid,integer,jsonb,text,text,text,integer,timestamptz,timestamptz,timestamptz) to service_role;

-- Service-validated events; bounded per link and deduplicated per anonymous session/target.
create function public.record_proposal_event(p_token text,p_id uuid,p_session uuid,p_kind text,p_target text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_link public.digital_proposal_links;
begin
  select l.* into v_link from public.digital_proposal_links l join public.digital_proposal_versions v on v.id=l.version_id
    join public.reports r on r.id=l.report_id join public.listings p on p.id=r.listing_id
    where l.token=p_token and l.revoked_at is null and v.revoked_at is null and r.status<>'archived' and p.status<>'archived' for update of l;
  if not found then return; end if;
  if (select count(*) from public.digital_proposal_events where link_id=v_link.id and created_at>now()-interval '1 minute')>=500 then return; end if;
  insert into public.digital_proposal_events(id,agency_id,report_id,version_id,link_id,session_id,kind,target)
    values(p_id,v_link.agency_id,v_link.report_id,v_link.version_id,v_link.id,p_session,p_kind,p_target) on conflict do nothing;
end; $$;
revoke all on function public.record_proposal_event(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_proposal_event(text,uuid,uuid,text,text) to service_role;

create function public.proposal_activity_summary(p_agency_id uuid,p_report_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('opens',count(*) filter(where kind='open'),'sessions',count(distinct session_id),
    'lastOpened',max(created_at) filter(where kind='open'),
    'items',coalesce((select jsonb_agg(t) from (
      select kind,target,count(*) as count,max(created_at) as "lastSeen" from public.digital_proposal_events
      where agency_id=p_agency_id and report_id=p_report_id group by kind,target order by max(created_at) desc limit 100
    ) t),'[]'::jsonb))
  from public.digital_proposal_events where agency_id=p_agency_id and report_id=p_report_id;
$$;
revoke all on function public.proposal_activity_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.proposal_activity_summary(uuid,uuid) to service_role;

-- Dashboard status follows digital publication; legacy PDF status is kept separately.
create or replace function public.list_str_appraisals(
  p_agency_id uuid, p_search text default '', p_status text default 'all',
  p_listing_id uuid default null, p_page integer default 1, p_page_size integer default 20
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with scoped as (
    select a.*, state.status,
      case when state.status='archived' then 'Archived'
        when published.id is not null and (coalesce(d.revision,0)<>published.draft_revision or greatest(r.updated_at,a.updated_at,l.updated_at,coalesce(assignment.updated_at,'epoch'::timestamptz))>published.created_at) then 'Published · changes to share'
        when published.id is not null then 'Published'
        when d.report_id is not null then 'Ready to share' else 'Draft' end as proposal_status,
      coalesce(activity.opens,0) as proposal_opens, activity.last_opened,
      r.status as legacy_status, r.updated_at as report_updated_at,
      greatest(a.updated_at,r.updated_at) as activity_at,
      jsonb_build_object('id',r.id,'listing_id',r.listing_id,'status',state.status,'updated_at',r.updated_at,'pdf_url',r.pdf_url,
        'listing',jsonb_build_object('id',l.id,'property_address',l.property_address,'hero_image_url',l.hero_image_url,'suburb',l.suburb,'status',l.status)) as report
    from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
    join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
    left join public.digital_proposal_drafts d on d.report_id=r.id
    left join public.digital_proposal_assignments assignment on assignment.agency_id=a.agency_id
    left join lateral (select v.* from public.digital_proposal_versions v where v.report_id=r.id and v.revoked_at is null
      and exists(select 1 from public.digital_proposal_links k where k.version_id=v.id and k.revoked_at is null)
      order by v.created_at desc limit 1) published on true
    left join lateral (select count(*) filter(where e.kind='open') as opens,max(e.created_at) filter(where e.kind='open') as last_opened
      from public.digital_proposal_events e where e.agency_id=a.agency_id and e.report_id=r.id) activity on true
    cross join lateral (select case when r.status='archived' or l.status='archived' then 'archived'
      when published.id is not null then 'published' when r.status='failed' then 'failed'
      when d.report_id is not null then 'generated' else 'draft' end as status) state
    where a.agency_id=p_agency_id and (p_listing_id is null or l.id=p_listing_id)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(a.recipient_name,'') || ' ' || coalesce(l.property_address,'') || ' ' || coalesce(l.suburb,'')))>0)
  ), filtered as (
    select * from scoped where
      (p_status='all' and status<>'archived') or (p_status='draft' and status in ('draft','scraped','estimated'))
      or (p_status='ready' and status='generated') or (p_status in ('published','failed','archived') and status=p_status)
  ), paged as (
    select * from filtered order by activity_at desc,report_id
    limit least(greatest(p_page_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),100)
  ) select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(p)-'status'-'report_updated_at'-'activity_at' order by activity_at desc,report_id) from paged p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'counts',(select jsonb_build_object('draft',count(*) filter(where status in ('draft','scraped','estimated')),
      'ready',count(*) filter(where status='generated'),'published',count(*) filter(where status='published'),
      'failed',count(*) filter(where status='failed'),'archived',count(*) filter(where status='archived')) from scoped)
  );
$$;
