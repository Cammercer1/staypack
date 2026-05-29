-- Default new agencies/reports to the minimalist light template.
alter table if exists public.agencies
  alter column report_template_id set default 'minimalist-light';

alter table if exists public.reports
  alter column template_id set default 'minimalist-light';
