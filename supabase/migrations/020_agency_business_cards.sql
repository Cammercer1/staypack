-- Allow agency-scoped collateral such as reusable agent business cards.
alter table public.collateral_items
  alter column listing_id drop not null;

create index if not exists collateral_items_agency_type_idx
  on public.collateral_items (agency_id, type, created_at);
