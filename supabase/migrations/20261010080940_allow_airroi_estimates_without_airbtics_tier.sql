-- AirROI stores provider, cost and request metadata in str_enrichment_json.
-- Airbtics-specific fields apply only to historical Airbtics estimates.
-- Preserve existing values and the summary/full check for those historical rows.
set local lock_timeout = '5s';

alter table public.reports
  alter column airbtics_tier drop not null,
  alter column airbtics_tier drop default;

comment on column public.reports.airbtics_tier is
  'Historical Airbtics endpoint (summary/full), not the current STR provider. AirROI does not require a value. Current provider metadata is in str_enrichment_json.';
