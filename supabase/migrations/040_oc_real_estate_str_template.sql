-- Make the bespoke OC Real Estate STR appraisal the only STR template available
-- to the OC brand group, while retaining an office-level fallback for an
-- ungrouped demo account.

update public.agency_group_template_grants grants
set is_default = false
where grants.product = 'str'
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
  'oc-real-estate-str',
  'str',
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
  'str',
  'grants_only'
from public.agencies a
where a.id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and a.agency_group_id is not null
on conflict (agency_group_id, product)
do update set catalog_mode = excluded.catalog_mode;

-- An office setting takes precedence over its group, so pin this existing OC
-- workspace too. Future OC offices inherit the group setting above.
insert into public.agency_product_settings (agency_id, product, catalog_mode)
values (
  'e143cd2f-9fa4-456c-b382-c31ba56bf654',
  'str',
  'grants_only'
)
on conflict (agency_id, product)
do update set catalog_mode = excluded.catalog_mode;

update public.account_template_grants grants
set is_default = false
where grants.agency_id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and grants.product = 'str';

insert into public.account_template_grants (
  agency_id,
  template_id,
  product,
  is_default
)
select
  a.id,
  'oc-real-estate-str',
  'str',
  true
from public.agencies a
where a.id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and a.agency_group_id is null
on conflict (agency_id, template_id)
do update set
  product = excluded.product,
  is_default = excluded.is_default;

update public.agencies
set report_template_id = 'oc-real-estate-str'
where id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654';

-- Existing OC STR reports open in the approved template immediately. Rebuilds
-- continue to preserve original inputs, overrides, and buyer-facing report JSON.
update public.reports
set
  template_id = 'oc-real-estate-str',
  final_report_json = case
    when final_report_json is null then null
    else jsonb_set(
      final_report_json,
      '{template_id}',
      to_jsonb('oc-real-estate-str'::text),
      true
    )
  end,
  updated_at = now()
where agency_id = 'e143cd2f-9fa4-456c-b382-c31ba56bf654'
  and coalesce(final_report_json->'sales_enrichment', 'null'::jsonb) = 'null'::jsonb
  and coalesce(final_report_json->'ltr_enrichment', 'null'::jsonb) = 'null'::jsonb;
