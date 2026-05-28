-- Collateral template defaults (agency-wide) and document storage for print items.

alter table public.agencies
  add column if not exists collateral_template_defaults jsonb not null default '{}'::jsonb;

alter table public.collateral_items
  add column if not exists document_json jsonb,
  add column if not exists qr_code_url text,
  add column if not exists generated_at timestamptz,
  add column if not exists published_at timestamptz;

create index if not exists collateral_items_public_slug_idx
  on public.collateral_items (agency_id, public_slug)
  where public_slug is not null;
