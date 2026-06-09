-- Long-term rental appraisal for sale listings (investor collateral, distinct from lease brochure).
alter table public.collateral_items
  drop constraint if exists collateral_items_type_check;

alter table public.collateral_items
  add constraint collateral_items_type_check check (type in (
    'str_report',
    'sales_brochure',
    'rental_brochure',
    'lease_appraisal',
    'social_posts',
    'investor_snapshot',
    'agent_business_card'
  ));
