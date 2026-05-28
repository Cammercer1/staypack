-- Track how a listing page view was recorded (QR redirect vs direct visit).

alter table listing_page_views
  add column if not exists source text not null default 'direct';

alter table listing_page_views
  drop constraint if exists listing_page_views_source_check;

alter table listing_page_views
  add constraint listing_page_views_source_check
  check (source in ('direct', 'qr'));

create index if not exists listing_page_views_source_idx
  on listing_page_views (source);
