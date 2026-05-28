-- Extend the collateral_items type check to include rental_brochure and social_posts.
alter table public.collateral_items
  drop constraint if exists collateral_items_type_check;

alter table public.collateral_items
  add constraint collateral_items_type_check check (type in (
    'str_report',
    'sales_brochure',
    'rental_brochure',
    'social_posts',
    'investor_snapshot',
    'agent_business_card'
  ));
