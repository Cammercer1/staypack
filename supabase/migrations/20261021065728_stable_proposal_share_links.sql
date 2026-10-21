-- One deliberately adopted link follows publication; every served version remains immutable.
-- Existing tokens are unchanged until their report is explicitly published again.
alter table public.digital_proposal_links
  add column is_primary boolean not null default false,
  add column published_revision integer check(published_revision > 0),
  add column published_source_fingerprint text,
  add column updated_at timestamptz not null default now(),
  add constraint proposal_link_scope unique(agency_id,report_id,id),
  add constraint proposal_primary_publication_receipt check(not is_primary or (published_revision is not null and published_source_fingerprint is not null));
create unique index proposal_active_primary_link on public.digital_proposal_links(agency_id,report_id)
  where is_primary and revoked_at is null;
create index proposal_primary_link_history on public.digital_proposal_links(agency_id,report_id,created_at desc) where is_primary;

create table public.digital_proposal_link_versions (
  agency_id uuid not null, report_id uuid not null, link_id uuid not null, version_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(agency_id,report_id,version_id,link_id),
  foreign key(agency_id,report_id,link_id) references public.digital_proposal_links(agency_id,report_id,id) on delete cascade,
  foreign key(agency_id,report_id,version_id) references public.digital_proposal_versions(agency_id,report_id,id) on delete cascade
);
create index proposal_link_versions_link on public.digital_proposal_link_versions(link_id,version_id);
alter table public.digital_proposal_link_versions enable row level security;
revoke all on public.digital_proposal_link_versions from public,anon,authenticated;
grant select on public.digital_proposal_link_versions to authenticated;
grant all on public.digital_proposal_link_versions to service_role;
create policy proposal_link_versions_read on public.digital_proposal_link_versions for select to authenticated using(public.is_agency_member(agency_id));
insert into public.digital_proposal_link_versions(agency_id,report_id,link_id,version_id,created_at)
  select agency_id,report_id,id,version_id,created_at from public.digital_proposal_links;

-- Historical events reference membership, never the mutable primary pointer.
do $$ declare v_constraint text; begin
  for v_constraint in select conname from pg_constraint
    where conrelid='public.digital_proposal_events'::regclass and confrelid='public.digital_proposal_links'::regclass and contype='f'
  loop execute format('alter table public.digital_proposal_events drop constraint %I',v_constraint); end loop;
end $$;
alter table public.digital_proposal_events
  add constraint proposal_event_served_version foreign key(agency_id,report_id,version_id,link_id)
    references public.digital_proposal_link_versions(agency_id,report_id,version_id,link_id) on delete cascade,
  drop constraint digital_proposal_events_link_id_session_id_kind_target_key,
  add constraint proposal_event_version_session unique(link_id,version_id,session_id,kind,target);

create function public.preserve_proposal_link_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.id,new.agency_id,new.report_id,new.token) is distinct from (old.id,old.agency_id,old.report_id,old.token)
    or (old.revoked_at is not null and (new.revoked_at is distinct from old.revoked_at or new.version_id<>old.version_id))
    or (old.is_primary and not new.is_primary)
    or (new.version_id<>old.version_id and not new.is_primary) then
    raise exception 'Issued proposal links cannot be reassigned or restored.' using errcode='PT409';
  end if;
  return new;
end; $$;
create trigger proposal_link_identity before update on public.digital_proposal_links for each row execute function public.preserve_proposal_link_identity();

-- Also covers legacy publishers during a rolling deployment.
create function public.record_proposal_link_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.digital_proposal_link_versions(agency_id,report_id,link_id,version_id)
    values(new.agency_id,new.report_id,new.id,new.version_id) on conflict do nothing;
  return new;
end; $$;
create trigger proposal_link_version after insert or update of version_id on public.digital_proposal_links for each row execute function public.record_proposal_link_version();

-- Existing archive triggers run as the authenticated actor, who cannot update links.
-- This narrowly scoped trigger only revokes links whose current version was revoked.
create schema if not exists proposal_private;
revoke all on schema proposal_private from public,anon,authenticated;
create function proposal_private.revoke_links_for_archived_proposal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update public.digital_proposal_links set revoked_at=new.revoked_at
      where agency_id=new.agency_id and report_id=new.report_id and version_id=new.id and revoked_at is null;
  end if;
  return new;
end; $$;
create trigger proposal_version_revoke_links after update of revoked_at on public.digital_proposal_versions
  for each row execute function proposal_private.revoke_links_for_archived_proposal();
-- Previously archived versions must not become candidates when this migration is installed.
update public.digital_proposal_links k set revoked_at=v.revoked_at
  from public.digital_proposal_versions v where v.id=k.version_id and v.revoked_at is not null and k.revoked_at is null;
revoke all on function public.preserve_proposal_link_identity(),public.record_proposal_link_version(),proposal_private.revoke_links_for_archived_proposal() from public,anon,authenticated;

create function public.publish_digital_proposal_v3(p_agency_id uuid,p_report_id uuid,p_revision integer,p_snapshot jsonb,p_token text,
  p_content_hash text,p_source_fingerprint text,p_assignment_version integer,
  p_report_updated timestamptz,p_listing_updated timestamptz,p_appraisal_updated timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_version public.digital_proposal_versions; v_link public.digital_proposal_links; v_revision integer; v_assignment integer;
begin
  perform 1 from public.reports r join public.str_appraisals a on a.report_id=r.id and a.agency_id=r.agency_id
    join public.listings l on l.id=r.listing_id and l.agency_id=r.agency_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived'
    and (a.kind='str' or (a.document_json is not null and a.document_revision=a.input_revision))
    and r.updated_at=p_report_updated and l.updated_at=p_listing_updated and a.updated_at=p_appraisal_updated for update of r,l,a;
  if not found then raise exception 'The appraisal changed. Reload the preview before publishing.' using errcode='PT409'; end if;
  select version into v_assignment from public.digital_proposal_assignments where agency_id=p_agency_id and kind=(select kind from public.str_appraisals where report_id=p_report_id) for share;
  if coalesce(v_assignment,1)<>p_assignment_version then raise exception 'The brand design changed. Reload the preview.' using errcode='PT409'; end if;
  select revision into v_revision from public.digital_proposal_drafts where report_id=p_report_id and agency_id=p_agency_id for update;
  if v_revision is null or v_revision<>p_revision then raise exception 'Save the latest draft before publishing.' using errcode='PT409'; end if;
  -- Choose before inserting the new version: the most recently issued existing URL is adopted once.
  select * into v_link from public.digital_proposal_links where agency_id=p_agency_id and report_id=p_report_id
    and is_primary and revoked_at is null for update;
  if not found and not exists(select 1 from public.digital_proposal_links where agency_id=p_agency_id and report_id=p_report_id and is_primary) then
    select k.* into v_link from public.digital_proposal_links k join public.digital_proposal_versions v on v.id=k.version_id
      where k.agency_id=p_agency_id and k.report_id=p_report_id and k.revoked_at is null and v.revoked_at is null
      order by k.created_at desc,k.id desc limit 1 for update of k;
  end if;
  select * into v_version from public.digital_proposal_versions where agency_id=p_agency_id and report_id=p_report_id and content_hash=p_content_hash;
  if not found then
    insert into public.digital_proposal_versions(report_id,agency_id,draft_revision,share_token,final_report_json,content_hash,source_fingerprint)
      values(p_report_id,p_agency_id,p_revision,p_token,p_snapshot,p_content_hash,p_source_fingerprint) returning * into v_version;
  end if;
  if v_version.revoked_at is not null then raise exception 'This publication was archived. Save a new revision before republishing.' using errcode='PT409'; end if;
  if v_link.id is null then
    insert into public.digital_proposal_links(agency_id,report_id,version_id,token,is_primary,published_revision,published_source_fingerprint)
      values(p_agency_id,p_report_id,v_version.id,p_token,true,p_revision,p_source_fingerprint) returning * into v_link;
  else
    update public.digital_proposal_links set version_id=v_version.id,is_primary=true,published_revision=p_revision,
      published_source_fingerprint=p_source_fingerprint,updated_at=clock_timestamp() where id=v_link.id returning * into v_link;
  end if;
  return jsonb_build_object('id',v_version.id,'draft_revision',v_version.draft_revision,'created_at',v_version.created_at,
    'revoked_at',v_link.revoked_at,'link_id',v_link.id,'share_token',v_link.token,'pdf_status',v_version.pdf_status,'source_fingerprint',v_version.source_fingerprint,
    'share_link',jsonb_build_object('id',v_link.id,'token',v_link.token,'version_id',v_version.id,'draft_revision',v_link.published_revision,
      'source_fingerprint',v_link.published_source_fingerprint,'created_at',v_link.created_at,'updated_at',v_link.updated_at,'revoked_at',v_link.revoked_at));
end; $$;
revoke all on function public.publish_digital_proposal_v3(uuid,uuid,integer,jsonb,text,text,text,integer,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.publish_digital_proposal_v3(uuid,uuid,integer,jsonb,text,text,text,integer,timestamptz,timestamptz,timestamptz) to service_role;

-- The server supplies the exact rendered version, even if publication advanced meanwhile.
create function public.record_proposal_event_v2(p_token text,p_version_id uuid,p_id uuid,p_session uuid,p_kind text,p_target text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_link public.digital_proposal_links;
begin
  select k.* into v_link from public.digital_proposal_links k
    join public.digital_proposal_link_versions h on h.link_id=k.id and h.agency_id=k.agency_id and h.report_id=k.report_id and h.version_id=p_version_id
    join public.digital_proposal_versions v on v.id=h.version_id and v.agency_id=h.agency_id and v.report_id=h.report_id
    join public.reports r on r.id=k.report_id and r.agency_id=k.agency_id
    join public.listings l on l.id=r.listing_id and l.agency_id=k.agency_id
    where k.token=p_token and k.revoked_at is null and v.revoked_at is null and r.status<>'archived' and l.status<>'archived' for update of k;
  if not found then return; end if;
  if (select count(*) from public.digital_proposal_events where link_id=v_link.id and created_at>now()-interval '1 minute')>=500 then return; end if;
  insert into public.digital_proposal_events(id,agency_id,report_id,version_id,link_id,session_id,kind,target)
    values(p_id,v_link.agency_id,v_link.report_id,p_version_id,v_link.id,p_session,p_kind,p_target) on conflict do nothing;
end; $$;
revoke all on function public.record_proposal_event_v2(text,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_proposal_event_v2(text,uuid,uuid,uuid,text,text) to service_role;

-- Dashboard readiness uses the publication receipt, including A -> B -> A snapshot reuse.
create or replace function public.list_appraisals(
  p_agency_id uuid, p_search text default '', p_status text default 'all',
  p_listing_id uuid default null, p_page integer default 1, p_page_size integer default 20, p_kind text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with scoped as (
    select a.report_id,a.agency_id,a.kind,a.contact_id,a.recipient_mode,a.recipient_name,a.source,a.created_at,a.updated_at, state.status,
      case when state.status='archived' then 'Archived'
        when published.id is not null and (coalesce(d.revision,0)<>published.draft_revision or greatest(r.updated_at,a.updated_at,case when a.kind='str' then l.updated_at end,coalesce(assignment.updated_at,'epoch'::timestamptz))>published.created_at) then 'Published · changes to share'
        when published.id is not null then 'Published'
        when d.report_id is not null and (a.kind='str' or a.document_revision=a.input_revision) then 'Ready to share' else 'Draft' end as proposal_status,
      coalesce(activity.opens,0) as proposal_opens, activity.last_opened,
      r.status as legacy_status, r.updated_at as report_updated_at,
      greatest(a.updated_at,r.updated_at) as activity_at,
      jsonb_build_object('id',r.id,'listing_id',r.listing_id,'status',state.status,'updated_at',r.updated_at,'pdf_url',r.pdf_url,
        'listing',jsonb_build_object('id',l.id,'property_address',l.property_address,'hero_image_url',l.hero_image_url,'suburb',l.suburb,'status',l.status)) as report
    from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
    join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
    left join public.digital_proposal_drafts d on d.report_id=r.id
    left join public.digital_proposal_assignments assignment on assignment.agency_id=a.agency_id and assignment.kind=a.kind
    left join lateral (select v.id,coalesce(k.published_revision,v.draft_revision) as draft_revision,
        case when k.is_primary then k.updated_at else v.created_at end as created_at
      from public.digital_proposal_links k join public.digital_proposal_versions v on v.id=k.version_id
      where k.report_id=r.id and v.revoked_at is null and k.revoked_at is null
        and (k.is_primary or not exists(select 1 from public.digital_proposal_links primary_link where primary_link.report_id=r.id and primary_link.is_primary))
      order by k.is_primary desc,k.created_at desc,k.id desc limit 1) published on true
    left join lateral (select count(*) filter(where e.kind='open') as opens,max(e.created_at) filter(where e.kind='open') as last_opened
      from public.digital_proposal_events e where e.agency_id=a.agency_id and e.report_id=r.id) activity on true
    cross join lateral (select case when r.status='archived' or l.status='archived' then 'archived'
      when published.id is not null then 'published' when r.status='failed' then 'failed'
      when d.report_id is not null and (a.kind='str' or a.document_revision=a.input_revision) then 'generated' else 'draft' end as status) state
    where a.agency_id=p_agency_id and (p_kind is null or a.kind=p_kind) and (p_listing_id is null or l.id=p_listing_id)
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
