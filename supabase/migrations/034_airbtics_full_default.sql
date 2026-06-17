-- STR estimates now use the full Airbtics endpoint by default.
-- Keep "summary" allowed for historical report rows, but stop creating new
-- draft reports/agencies with summary preselected.

alter table public.reports
  alter column airbtics_tier set default 'full';

alter table public.agencies
  alter column default_airbtics_tier set default 'full';

update public.agencies
set default_airbtics_tier = 'full'
where default_airbtics_tier = 'summary';

update public.reports
set airbtics_tier = 'full'
where airbtics_tier = 'summary'
  and airbtics_report_id is null;

comment on column public.reports.airbtics_tier is
  'Airbtics endpoint used for the estimate. New STR estimates use full; summary is historical only.';

comment on column public.agencies.default_airbtics_tier is
  'Historical agency preference. STR estimates now default to full Airbtics data.';
