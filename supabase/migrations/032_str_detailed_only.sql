-- STR reports: drop light template variants; canonical IDs are *-detailed only.

update public.agencies
set report_template_id = replace(report_template_id, '-light', '-detailed')
where report_template_id like '%-light';

update public.reports
set template_id = replace(template_id, '-light', '-detailed')
where template_id like '%-light';

update public.agencies
set report_template_id = 'classic-detailed'
where report_template_id = 'classic';

update public.reports
set template_id = 'classic-detailed'
where template_id = 'classic';

update public.account_template_grants
set template_id = replace(template_id, '-light', '-detailed')
where template_id like '%-light';

alter table public.agencies
  alter column report_template_id set default 'minimalist-detailed';

alter table public.reports
  alter column template_id set default 'minimalist-detailed';

comment on column public.agencies.report_template_id is
  'Default report template variant id, e.g. minimalist-detailed or classic-detailed.';
