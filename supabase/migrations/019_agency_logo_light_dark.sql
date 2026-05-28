-- Light logo (for dark backgrounds) and dark logo (for light backgrounds).
alter table public.agencies
  add column if not exists logo_light_url text,
  add column if not exists logo_dark_url text;

comment on column public.agencies.logo_light_url is
  'Logo asset for dark/coloured backgrounds (typically white or light mark).';
comment on column public.agencies.logo_dark_url is
  'Logo asset for light backgrounds (typically full-colour or dark mark).';

-- Existing logo_url was used on light report backgrounds.
update public.agencies
set logo_dark_url = logo_url
where logo_url is not null
  and (logo_dark_url is null or logo_dark_url = '');
