-- Light vs detailed template variants (classic-light, classic-detailed).

update public.agencies
set report_template_id = 'classic-light'
where report_template_id = 'classic';

update public.reports
set template_id = 'classic-light'
where template_id = 'classic' or template_id is null;

alter table public.agencies
  alter column report_template_id set default 'classic-light';

comment on column public.agencies.report_template_id is
  'Default report template variant id, e.g. classic-light or classic-detailed.';

comment on column public.reports.template_id is
  'Report template variant id. Overrides agency default for this report.';
