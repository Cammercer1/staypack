-- Cover the composite report foreign key and agency-scoped draft lookup together.
create index digital_proposal_drafts_agency_report_idx on public.digital_proposal_drafts(agency_id,report_id);
drop index public.digital_proposal_drafts_agency_idx;
