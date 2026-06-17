-- Belle Property Group managed-delivery template grants (shadow agency md-belle)

insert into public.account_template_grants (agency_id, template_id, product, is_default)
select a.id, 'belle-property-str', 'str', true
from public.agencies a
where a.slug = 'md-belle'
on conflict (agency_id, template_id) do nothing;

insert into public.account_template_grants (agency_id, template_id, product, is_default)
select a.id, 'belle-property-lease-appraisal', 'lease', true
from public.agencies a
where a.slug = 'md-belle'
on conflict (agency_id, template_id) do nothing;

insert into public.account_template_grants (agency_id, template_id, product, is_default)
select a.id, 'sales-brochure-belle-2pg', 'sales_brochure', true
from public.agencies a
where a.slug = 'md-belle'
on conflict (agency_id, template_id) do nothing;
