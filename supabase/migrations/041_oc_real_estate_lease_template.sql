-- Make the bespoke OC Real Estate long-term rental appraisal the only lease
-- template available to the OC brand group. Existing non-OC accounts retain
-- the default platform_plus_grants catalogue and their current wizard flow.

update public.agency_group_template_grants grants
set is_default = false
where grants.product = 'lease'
  and grants.agency_group_id in (
    select a.agency_group_id
    from public.agencies a
    where a.id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
      and a.agency_group_id is not null
  );

insert into public.agency_group_template_grants (
  agency_group_id,
  template_id,
  product,
  is_default
)
select
  a.agency_group_id,
  'oc-real-estate-lease-appraisal',
  'lease',
  true
from public.agencies a
where a.id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and a.agency_group_id is not null
on conflict (agency_group_id, template_id)
do update set
  product = excluded.product,
  is_default = excluded.is_default;

insert into public.agency_group_product_settings (
  agency_group_id,
  product,
  catalog_mode
)
select
  a.agency_group_id,
  'lease',
  'grants_only'
from public.agencies a
where a.id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and a.agency_group_id is not null
on conflict (agency_group_id, product)
do update set catalog_mode = excluded.catalog_mode;

-- Office settings take precedence over the parent group, so pin the existing
-- OC workspace while future OC offices inherit the group configuration above.
insert into public.agency_product_settings (agency_id, product, catalog_mode)
values (
  'e143cd2f-9fa4-456c-b382-c31ba56bf654',
  'lease',
  'grants_only'
)
on conflict (agency_id, product)
do update set catalog_mode = excluded.catalog_mode;

update public.account_template_grants grants
set is_default = false
where grants.agency_id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and grants.product = 'lease';

-- Fallback for an ungrouped OC demo workspace.
insert into public.account_template_grants (
  agency_id,
  template_id,
  product,
  is_default
)
select
  a.id,
  'oc-real-estate-lease-appraisal',
  'lease',
  true
from public.agencies a
where a.id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and a.agency_group_id is null
on conflict (agency_id, template_id)
do update set
  product = excluded.product,
  is_default = excluded.is_default;
