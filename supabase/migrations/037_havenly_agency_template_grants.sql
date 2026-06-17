-- Grant Haven templates to the live Havenly agency and make them the defaults.

update public.account_template_grants
set is_default = false
where agency_id = '55e0a778-9604-4725-975f-657cb83b17e2'
  and product in ('str', 'lease');

insert into public.account_template_grants (agency_id, template_id, product, is_default)
values (
  '55e0a778-9604-4725-975f-657cb83b17e2',
  'haven-properties-str',
  'str',
  true
)
on conflict (agency_id, template_id) do update
set product = excluded.product,
    is_default = excluded.is_default;

insert into public.account_template_grants (agency_id, template_id, product, is_default)
values (
  '55e0a778-9604-4725-975f-657cb83b17e2',
  'haven-properties-lease-appraisal',
  'lease',
  true
)
on conflict (agency_id, template_id) do update
set product = excluded.product,
    is_default = excluded.is_default;

update public.agencies
set report_template_id = 'haven-properties-str'
where id = '55e0a778-9604-4725-975f-657cb83b17e2';
