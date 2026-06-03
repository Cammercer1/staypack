-- Store STR + lease report references per delivered property.

alter table public.delivery_tenant_properties
  add column if not exists delivery_reports jsonb;

comment on column public.delivery_tenant_properties.delivery_reports is
  'Published report links keyed by deliverable (str, lease_appraisal).';
