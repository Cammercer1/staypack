alter table public.agencies
  add column if not exists report_template_id text not null default 'classic';

alter table public.reports
  add column if not exists template_id text;
