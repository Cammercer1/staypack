-- Keep the historical membership table from becoming an implicit PostgREST
-- many-to-many relationship between links and versions. Older app releases
-- embed their existing direct relationship without a foreign-key hint.
-- The scoped unique key and event foreign key retain the same data guarantees.
alter table public.digital_proposal_link_versions
  add column id uuid not null default gen_random_uuid(),
  add constraint proposal_link_version_scope unique(agency_id,report_id,version_id,link_id);

alter table public.digital_proposal_events
  drop constraint proposal_event_served_version;

alter table public.digital_proposal_link_versions
  drop constraint digital_proposal_link_versions_pkey,
  add constraint digital_proposal_link_versions_pkey primary key(id);

alter table public.digital_proposal_events
  add constraint proposal_event_served_version foreign key(agency_id,report_id,version_id,link_id)
    references public.digital_proposal_link_versions(agency_id,report_id,version_id,link_id) on delete cascade;

notify pgrst, 'reload schema';
