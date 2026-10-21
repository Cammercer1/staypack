-- Disposable database ONLY. Check the key shape used by PostgREST addM2MRels,
-- historical data preservation, and the event FK after rebinding its target.
begin;
do $$
declare pk smallint[]; identifier smallint; rejected boolean;
begin
  select conkey into pk from pg_constraint
    where conrelid='public.digital_proposal_link_versions'::regclass and contype='p';
  select attnum into identifier from pg_attribute
    where attrelid='public.digital_proposal_link_versions'::regclass and attname='id';
  assert pk=array[identifier], 'History must have a sole surrogate primary key';
  assert not exists(select 1 from pg_constraint
    where conrelid='public.digital_proposal_link_versions'::regclass and contype='f' and conkey<@pk),
    'PostgREST must not infer a second link-to-version relationship from the history primary key';
  assert exists(select 1 from pg_constraint event_fk join pg_constraint membership_key on membership_key.conindid=event_fk.conindid
    where event_fk.conrelid='public.digital_proposal_events'::regclass and event_fk.conname='proposal_event_served_version'
      and event_fk.contype='f' and event_fk.convalidated and event_fk.confdeltype='c'
      and membership_key.conrelid='public.digital_proposal_link_versions'::regclass
      and membership_key.conname='proposal_link_version_scope' and membership_key.contype='u'),
    'Event membership FK must reference the same scoped unique key, with cascading delete';
  assert (select rows from public.proposal_link_history_api_baseline where name='history')=
    (select coalesce(jsonb_agg(to_jsonb(h)-'id' order by agency_id,report_id,version_id,link_id),'[]'::jsonb) from public.digital_proposal_link_versions h),
    'Every original history row is preserved';
  assert (select rows from public.proposal_link_history_api_baseline where name='links')=
    (select coalesce(jsonb_agg(to_jsonb(k) order by id),'[]'::jsonb) from public.digital_proposal_links k), 'Links and tokens are unchanged';
  assert (select rows from public.proposal_link_history_api_baseline where name='versions')=
    (select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]'::jsonb) from public.digital_proposal_versions v), 'Snapshots and PDF paths are unchanged';
  assert (select rows from public.proposal_link_history_api_baseline where name='events')=
    (select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]'::jsonb) from public.digital_proposal_events e), 'Historical events are unchanged';
  rejected:=false;
  begin
    insert into public.digital_proposal_link_versions(agency_id,report_id,version_id,link_id)
      select agency_id,report_id,version_id,link_id from public.digital_proposal_link_versions limit 1;
  exception when unique_violation then rejected:=true; end;
  assert rejected, 'Duplicate membership remains rejected despite surrogate IDs';
  assert (select relrowsecurity from pg_class where oid='public.digital_proposal_link_versions'::regclass), 'History RLS remains enabled';
  assert not has_table_privilege('anon','public.digital_proposal_link_versions','select');
  assert has_table_privilege('authenticated','public.digital_proposal_link_versions','select');
  assert not has_table_privilege('authenticated','public.digital_proposal_link_versions','insert');
  assert not has_table_privilege('authenticated','public.digital_proposal_link_versions','update');
  assert not has_table_privilege('authenticated','public.digital_proposal_link_versions','delete');
end $$;
rollback;
