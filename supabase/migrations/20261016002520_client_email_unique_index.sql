-- Phase 2: a true constraint for every unmerged email, even archived clients.
-- Existing duplicates must be explicitly reviewed/merged before this migration.
-- Failure rolls back; never automatically select a person or discard their data.
create unique index agency_contacts_agency_normalized_email_key
  on public.agency_contacts(agency_id,lower(btrim(email)))
  where merged_into_contact_id is null and nullif(btrim(email),'') is not null;
