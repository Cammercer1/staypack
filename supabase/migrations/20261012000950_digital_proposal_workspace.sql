-- Additive proposal workspace. Existing report JSON, PDFs and public URLs are untouched.
create table public.digital_proposal_drafts (
  report_id uuid primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  draft_json jsonb not null check (jsonb_typeof(draft_json) = 'object'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, report_id) references public.reports(agency_id, id) on delete cascade
);
create index digital_proposal_drafts_agency_idx on public.digital_proposal_drafts(agency_id);

create table public.digital_proposal_attachments (
  id uuid primary key,
  report_id uuid not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  storage_path text not null unique,
  byte_size integer not null check (byte_size between 1 and 4194304),
  created_at timestamptz not null default now(),
  foreign key (agency_id, report_id) references public.reports(agency_id, id) on delete cascade
);
create index digital_proposal_attachments_report_idx on public.digital_proposal_attachments(agency_id,report_id);

create table public.digital_proposal_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  draft_revision integer not null,
  share_token text not null unique check (share_token ~ '^[a-f0-9]{64}$'),
  final_report_json jsonb not null check (jsonb_typeof(final_report_json) = 'object'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(report_id,draft_revision),
  foreign key (agency_id, report_id) references public.reports(agency_id, id) on delete cascade
);
create index digital_proposal_versions_agency_report_idx on public.digital_proposal_versions(agency_id,report_id);

alter table public.digital_proposal_drafts enable row level security;
alter table public.digital_proposal_attachments enable row level security;
alter table public.digital_proposal_versions enable row level security;
revoke all on public.digital_proposal_drafts,public.digital_proposal_attachments,public.digital_proposal_versions from public,anon,authenticated;
grant select on public.digital_proposal_drafts,public.digital_proposal_attachments,public.digital_proposal_versions to authenticated;
grant all on public.digital_proposal_drafts,public.digital_proposal_attachments,public.digital_proposal_versions to service_role;
create policy proposal_drafts_read on public.digital_proposal_drafts for select to authenticated using (public.is_agency_member(agency_id));
create policy proposal_attachments_read on public.digital_proposal_attachments for select to authenticated using (public.is_agency_member(agency_id));
create policy proposal_versions_read on public.digital_proposal_versions for select to authenticated using (public.is_agency_member(agency_id));
-- Only revocation is writable by members, including the archive trigger below.
grant update(revoked_at) on public.digital_proposal_versions to authenticated;
create policy proposal_versions_revoke on public.digital_proposal_versions for update to authenticated
  using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id) and revoked_at is not null);

-- Storage is server mediated after agency or live share-link access checks.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('proposal-documents','proposal-documents',false,4194304,array['application/pdf']);

create function public.save_digital_proposal(p_agency_id uuid,p_report_id uuid,p_revision integer,p_draft jsonb)
returns public.digital_proposal_drafts language plpgsql security invoker set search_path='' as $$
declare v_draft public.digital_proposal_drafts;
begin
  perform 1 from public.reports r join public.str_appraisals a on a.report_id=r.id
    join public.listings l on l.id=r.listing_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived' for update of r;
  if not found then raise exception 'Active appraisal not found' using errcode='PT404'; end if;
  select * into v_draft from public.digital_proposal_drafts where report_id=p_report_id for update;
  if found then
    if v_draft.revision<>p_revision then raise exception 'This draft changed in another session. Reload before saving.' using errcode='PT409'; end if;
    update public.digital_proposal_drafts set draft_json=p_draft,revision=revision+1,updated_at=now()
      where report_id=p_report_id returning * into v_draft;
  else
    if p_revision<>0 then raise exception 'Reload before saving this draft.' using errcode='PT409'; end if;
    insert into public.digital_proposal_drafts(report_id,agency_id,draft_json) values(p_report_id,p_agency_id,p_draft) returning * into v_draft;
  end if;
  return v_draft;
end;
$$;

create function public.publish_digital_proposal(p_agency_id uuid,p_report_id uuid,p_revision integer,p_snapshot jsonb,p_token text,
  p_report_updated timestamptz,p_listing_updated timestamptz,p_appraisal_updated timestamptz)
returns public.digital_proposal_versions language plpgsql security invoker set search_path='' as $$
declare v_version public.digital_proposal_versions; v_revision integer;
begin
  perform 1 from public.reports r join public.str_appraisals a on a.report_id=r.id join public.listings l on l.id=r.listing_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived'
    and r.updated_at=p_report_updated and l.updated_at=p_listing_updated and a.updated_at=p_appraisal_updated for update of r,l,a;
  if not found then raise exception 'The appraisal changed. Reload the preview before publishing.' using errcode='PT409'; end if;
  select revision into v_revision from public.digital_proposal_drafts where report_id=p_report_id and agency_id=p_agency_id for update;
  if v_revision is null or v_revision<>p_revision then raise exception 'Save the latest draft before publishing.' using errcode='PT409'; end if;
  select * into v_version from public.digital_proposal_versions where report_id=p_report_id and draft_revision=p_revision;
  if found then return v_version; end if;
  insert into public.digital_proposal_versions(report_id,agency_id,draft_revision,share_token,final_report_json)
    values(p_report_id,p_agency_id,p_revision,p_token,p_snapshot) returning * into v_version;
  return v_version;
end;
$$;
revoke all on function public.save_digital_proposal(uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.publish_digital_proposal(uuid,uuid,integer,jsonb,text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.save_digital_proposal(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.publish_digital_proposal(uuid,uuid,integer,jsonb,text,timestamptz,timestamptz,timestamptz) to service_role;

create function public.revoke_archived_proposals() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='archived' and old.status is distinct from new.status then
    if tg_table_name='reports' then
      update public.digital_proposal_versions set revoked_at=now() where report_id=new.id and revoked_at is null;
    else
      update public.digital_proposal_versions set revoked_at=now() where report_id in (select id from public.reports where listing_id=new.id) and revoked_at is null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.revoke_archived_proposals() from public,anon,authenticated;
create trigger reports_revoke_proposals after update of status on public.reports for each row execute function public.revoke_archived_proposals();
create trigger listings_revoke_proposals after update of status on public.listings for each row execute function public.revoke_archived_proposals();
