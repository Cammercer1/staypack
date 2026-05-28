-- Keep old agency slugs working after "Report link name" changes.
alter table public.agencies
  add column if not exists slug_aliases text[] not null default '{}';

comment on column public.agencies.slug_aliases is
  'Previous slugs; public routes match these and redirect to the current slug.';
