alter table public.agencies
  add column if not exists text_colour text not null default '#002e36',
  add column if not exists background_colour text not null default '#f9f5ea',
  add column if not exists font_file_url text;

update public.agencies
set
  text_colour = coalesce(nullif(text_colour, ''), primary_colour, '#002e36'),
  background_colour = coalesce(nullif(background_colour, ''), secondary_colour, '#f9f5ea');
