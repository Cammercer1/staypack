alter table public.agencies
  add column if not exists heading_font_family text not null default 'fraunces',
  add column if not exists body_font_family text not null default 'inter',
  add column if not exists heading_font_file_url text,
  add column if not exists body_font_file_url text;

update public.agencies
set
  heading_font_family = coalesce(nullif(heading_font_family, ''), font_family, 'fraunces'),
  body_font_family = coalesce(nullif(body_font_family, ''), font_family, 'inter'),
  heading_font_file_url = coalesce(heading_font_file_url, font_file_url),
  body_font_file_url = coalesce(body_font_file_url, font_file_url);
