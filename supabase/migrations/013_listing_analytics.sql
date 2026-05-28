-- Page view events for listing landing pages.
-- Inserts are done via admin client (API route) so public can't write directly.

create table listing_page_views (
  id          uuid        primary key default gen_random_uuid(),
  listing_id  uuid        not null references listings(id) on delete cascade,
  agency_id   uuid        not null references agencies(id) on delete cascade,
  referrer    text,
  created_at  timestamptz not null default now()
);

create index listing_page_views_listing_id_idx on listing_page_views (listing_id);
create index listing_page_views_created_at_idx on listing_page_views (created_at);

-- Agencies can read their own views; inserts go through the API (admin client).
alter table listing_page_views enable row level security;

create policy "agencies can read their own page views"
  on listing_page_views for select
  using (
    agency_id in (
      select agency_id from agency_members where user_id = auth.uid()
    )
  );
