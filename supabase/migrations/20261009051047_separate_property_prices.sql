-- Advertised prices and agent appraisal choices are independent of source API evidence.
alter table public.listings
  add column if not exists advertised_sale_price text,
  add column if not exists advertised_weekly_rent text,
  add column if not exists appraisal_overrides_json jsonb not null default '{}'::jsonb;

-- Classify legacy asking prices by their saved purpose, never by document type.
update public.listings set advertised_sale_price = display_price
where listing_purpose = 'sale' and advertised_sale_price is null
  and nullif(trim(display_price), '') is not null
  and display_price !~* '(per[[:space:]]*week|/wk|weekly|\mpw\M)';
update public.listings set advertised_weekly_rent = display_price
where listing_purpose = 'lease' and advertised_weekly_rent is null
  and nullif(trim(display_price), '') is not null;

comment on column public.listings.appraisal_overrides_json is
  'User-entered lease/sales appraisal ranges. Raw AVMs and automated comparable results stay in scraped_listing_json.';
