-- Shared appraisal workspace. Retain the original storage name so deployed STR
-- writers, report IDs, links and recipient RPCs remain compatible. New readers use
-- the security-invoker appraisals view; there is only one customer record per report.
alter table public.str_appraisals
  add column kind text not null default 'str' check(kind in ('str','lease','sales')),
  add column inputs_json jsonb check(inputs_json is null or jsonb_typeof(inputs_json)='object'),
  add column input_revision integer not null default 0 check(input_revision>=0),
  add column document_json jsonb check(document_json is null or jsonb_typeof(document_json)='object'),
  add column document_revision integer;
create index appraisals_agency_kind on public.str_appraisals(agency_id,kind,updated_at desc);
create view public.appraisals with (security_invoker=true) as select * from public.str_appraisals;
revoke all on public.appraisals from public,anon,authenticated;
grant select on public.appraisals to authenticated,service_role;

alter table public.digital_proposal_assignments
  add column kind text not null default 'str' check(kind in ('str','lease','sales')),
  drop constraint digital_proposal_assignments_pkey,
  add primary key(agency_id,kind);

-- Register known legacy appraisal products without changing their published JSON.
insert into public.str_appraisals(report_id,agency_id,kind,source,inputs_json,document_json,document_revision,created_at,updated_at)
select r.id,r.agency_id,
  case when coalesce(r.template_id,'') like '%lease-appraisal%' or r.final_report_json->>'version'='lease_appraisal_v1'
    or exists(select 1 from public.collateral_items c where c.report_id=r.id and c.type='lease_appraisal') then 'lease' else 'sales' end,
  'legacy',jsonb_build_object('version',1,'listing',to_jsonb(l)),r.final_report_json,case when r.final_report_json is not null then 0 end,r.created_at,r.updated_at
from public.reports r join public.listings l on l.id=r.listing_id and l.agency_id=r.agency_id where r.listing_id is not null and (
  coalesce(r.template_id,'') like '%lease-appraisal%' or coalesce(r.template_id,'') like '%sales-appraisal%'
  or r.final_report_json->>'version' in ('lease_appraisal_v1','sales_appraisal_v1')
  or exists(select 1 from public.collateral_items c where c.report_id=r.id and c.type in ('lease_appraisal','sales_appraisal'))
) on conflict(report_id) do nothing;

create function public.register_other_appraisal() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_kind text;
begin
  v_kind:=case when new.template_id like '%lease-appraisal%' or new.final_report_json->>'version'='lease_appraisal_v1' then 'lease'
    when new.template_id like '%sales-appraisal%' or new.final_report_json->>'version'='sales_appraisal_v1' then 'sales' end;
  if v_kind is not null and new.listing_id is not null then
    insert into public.str_appraisals(report_id,agency_id,kind,source,inputs_json,document_json,document_revision)
    select new.id,new.agency_id,v_kind,'legacy',jsonb_build_object('version',1,'listing',to_jsonb(l)),new.final_report_json,case when new.final_report_json is not null then 0 end
      from public.listings l where l.id=new.listing_id and l.agency_id=new.agency_id
    on conflict(report_id) do update set document_json=excluded.document_json,document_revision=0
      where public.str_appraisals.source='legacy' and public.str_appraisals.document_json is null and excluded.document_json is not null;
  end if;
  return new;
end; $$;
create trigger reports_register_other_appraisal after insert or update of template_id,final_report_json on public.reports
  for each row execute function public.register_other_appraisal();
revoke all on function public.register_other_appraisal() from public,anon,authenticated;

create function public.create_appraisal(p_agency_id uuid,p_listing_id uuid,p_report_id uuid,p_kind text,p_template_id text,p_recipient jsonb,p_inputs jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_appraisal public.str_appraisals; v_listing uuid;
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise exception 'Agency access required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('lease','sales') or p_template_id is null or p_template_id not like ('%' || case when p_kind='lease' then 'lease-appraisal' else 'sales-appraisal' end || '%')
    then raise exception 'Invalid appraisal type or template' using errcode='22023'; end if;
  if p_inputs is null or p_inputs->>'version' is distinct from '1' or jsonb_typeof(p_inputs->'listing') is distinct from 'object' then raise exception 'Invalid appraisal inputs' using errcode='22023'; end if;
  if not exists(select 1 from public.listings where id=p_listing_id and agency_id=p_agency_id and status<>'archived') then raise exception 'Active property not found' using errcode='PT404'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_report_id::text,0));
  select * into v_appraisal from public.str_appraisals where report_id=p_report_id and agency_id=p_agency_id;
  if found then
    select listing_id into v_listing from public.reports where id=p_report_id and agency_id=p_agency_id;
    if v_listing<>p_listing_id or v_appraisal.kind<>p_kind or v_appraisal.recipient_mode is distinct from p_recipient->>'mode'
      or (v_appraisal.recipient_mode='named' and (v_appraisal.recipient_name is distinct from btrim(p_recipient->>'name')
        or v_appraisal.recipient_email is distinct from nullif(p_recipient->>'email','') or v_appraisal.recipient_phone is distinct from nullif(p_recipient->>'phone','')))
    then raise exception 'This request already created a different appraisal.' using errcode='PT409'; end if;
    return p_report_id;
  end if;
  insert into public.reports(id,agency_id,listing_id,created_by,template_id,status) values(p_report_id,p_agency_id,p_listing_id,auth.uid(),p_template_id,'draft');
  insert into public.str_appraisals(report_id,agency_id,kind,inputs_json,source) values(p_report_id,p_agency_id,p_kind,p_inputs,'manual')
    on conflict(report_id) do update set inputs_json=excluded.inputs_json,source='manual' returning * into v_appraisal;
  perform public.save_str_appraisal_recipient(p_agency_id,p_report_id,p_recipient,v_appraisal.updated_at);
  -- The first property source stays stable; subsequent customer appraisals never replace it.
  insert into public.collateral_items(listing_id,agency_id,type,status,report_id)
    values(p_listing_id,p_agency_id,case when p_kind='lease' then 'lease_appraisal' else 'sales_appraisal' end,'draft',p_report_id)
    on conflict(listing_id,type) do nothing;
  return p_report_id;
end; $$;

create function public.save_appraisal_inputs(p_agency_id uuid,p_report_id uuid,p_expected_updated_at timestamptz,p_inputs jsonb)
returns public.str_appraisals language plpgsql security invoker set search_path='' as $$
declare v_appraisal public.str_appraisals;
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise exception 'Agency access required' using errcode='42501'; end if;
  perform 1 from public.reports r join public.listings l on l.id=r.listing_id and l.agency_id=r.agency_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived' for update of r,l;
  if not found then raise exception 'Active appraisal not found' using errcode='PT404'; end if;
  select * into v_appraisal from public.str_appraisals where report_id=p_report_id and agency_id=p_agency_id and kind in ('lease','sales') for update;
  if not found then raise exception 'Appraisal not found' using errcode='PT404'; end if;
  if p_expected_updated_at is null or v_appraisal.updated_at<>p_expected_updated_at then raise exception 'This appraisal changed. Reload before saving.' using errcode='PT409'; end if;
  if p_inputs is null or p_inputs->>'version' is distinct from '1' or jsonb_typeof(p_inputs->'listing') is distinct from 'object' then raise exception 'Invalid appraisal inputs' using errcode='22023'; end if;
  if v_appraisal.inputs_json is distinct from p_inputs then
    update public.str_appraisals set inputs_json=p_inputs,input_revision=input_revision+1
      where report_id=p_report_id returning * into v_appraisal;
  end if;
  return v_appraisal;
end; $$;

create function public.save_appraisal_document(p_agency_id uuid,p_report_id uuid,p_expected_updated_at timestamptz,p_document jsonb)
returns public.str_appraisals language plpgsql security invoker set search_path='' as $$
declare v_appraisal public.str_appraisals;
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise exception 'Agency access required' using errcode='42501'; end if;
  perform 1 from public.reports r join public.listings l on l.id=r.listing_id and l.agency_id=r.agency_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived' for update of r,l;
  if not found then raise exception 'Active appraisal not found' using errcode='PT404'; end if;
  select * into v_appraisal from public.str_appraisals where report_id=p_report_id and agency_id=p_agency_id and kind in ('lease','sales') for update;
  if not found then raise exception 'Appraisal not found' using errcode='PT404'; end if;
  if p_expected_updated_at is null or v_appraisal.updated_at<>p_expected_updated_at then raise exception 'This appraisal changed. Reload before generating.' using errcode='PT409'; end if;
  if p_document is null or p_document->>'version' is distinct from v_appraisal.kind || '_appraisal_v1' then raise exception 'Invalid appraisal document' using errcode='22023'; end if;
  update public.str_appraisals set document_json=p_document,document_revision=input_revision where report_id=p_report_id returning * into v_appraisal;
  -- Initialise a property's first brochure source once. Never rewrite an existing
  -- legacy/public report or switch the collateral pointer on proposal edits.
  update public.reports r set final_report_json=p_document,status='generated'
    where r.id=p_report_id and r.final_report_json is null and r.status<>'published'
      and exists(select 1 from public.collateral_items c where c.report_id=r.id and c.type in ('lease_appraisal','sales_appraisal'));
  return v_appraisal;
end; $$;

revoke all on function public.create_appraisal(uuid,uuid,uuid,text,text,jsonb,jsonb),public.save_appraisal_inputs(uuid,uuid,timestamptz,jsonb),public.save_appraisal_document(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.create_appraisal(uuid,uuid,uuid,text,text,jsonb,jsonb),public.save_appraisal_inputs(uuid,uuid,timestamptz,jsonb),public.save_appraisal_document(uuid,uuid,timestamptz,jsonb) to authenticated,service_role;

create or replace function public.publish_digital_proposal_v2(p_agency_id uuid,p_report_id uuid,p_revision integer,p_snapshot jsonb,p_token text,
  p_content_hash text,p_source_fingerprint text,p_assignment_version integer,
  p_report_updated timestamptz,p_listing_updated timestamptz,p_appraisal_updated timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_version public.digital_proposal_versions; v_link public.digital_proposal_links; v_revision integer; v_assignment integer;
begin
  perform 1 from public.reports r join public.str_appraisals a on a.report_id=r.id join public.listings l on l.id=r.listing_id
    where r.id=p_report_id and r.agency_id=p_agency_id and r.status<>'archived' and l.status<>'archived'
    and (a.kind='str' or (a.document_json is not null and a.document_revision=a.input_revision))
    and r.updated_at=p_report_updated and l.updated_at=p_listing_updated and a.updated_at=p_appraisal_updated for update of r,l,a;
  if not found then raise exception 'The appraisal changed. Reload the preview before publishing.' using errcode='PT409'; end if;
  select version into v_assignment from public.digital_proposal_assignments where agency_id=p_agency_id and kind=(select kind from public.str_appraisals where report_id=p_report_id) for share;
  if coalesce(v_assignment,1)<>p_assignment_version then raise exception 'The brand design changed. Reload the preview.' using errcode='PT409'; end if;
  select revision into v_revision from public.digital_proposal_drafts where report_id=p_report_id and agency_id=p_agency_id for update;
  if v_revision is null or v_revision<>p_revision then raise exception 'Save the latest draft before publishing.' using errcode='PT409'; end if;
  select * into v_version from public.digital_proposal_versions where report_id=p_report_id and content_hash=p_content_hash;
  if not found then
    insert into public.digital_proposal_versions(report_id,agency_id,draft_revision,share_token,final_report_json,content_hash,source_fingerprint)
      values(p_report_id,p_agency_id,p_revision,p_token,p_snapshot,p_content_hash,p_source_fingerprint) returning * into v_version;
  end if;
  if v_version.revoked_at is not null then raise exception 'This publication was archived. Save a new revision before republishing.' using errcode='PT409'; end if;
  select * into v_link from public.digital_proposal_links where version_id=v_version.id and revoked_at is null order by created_at desc limit 1;
  if not found then
    insert into public.digital_proposal_links(agency_id,report_id,version_id,token) values(p_agency_id,p_report_id,v_version.id,p_token) returning * into v_link;
  end if;
  return jsonb_build_object('id',v_version.id,'draft_revision',v_version.draft_revision,'created_at',v_version.created_at,
    'revoked_at',v_link.revoked_at,'link_id',v_link.id,'share_token',v_link.token,'pdf_status',v_version.pdf_status,'source_fingerprint',v_version.source_fingerprint);
end; $$;

create or replace function public.list_appraisals(
  p_agency_id uuid, p_search text default '', p_status text default 'all',
  p_listing_id uuid default null, p_page integer default 1, p_page_size integer default 20, p_kind text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with scoped as (
    select a.report_id,a.agency_id,a.kind,a.contact_id,a.recipient_mode,a.recipient_name,a.source,a.created_at,a.updated_at, state.status,
      case when state.status='archived' then 'Archived'
        when published.id is not null and (coalesce(d.revision,0)<>published.draft_revision or greatest(r.updated_at,a.updated_at,case when a.kind='str' then l.updated_at end,coalesce(assignment.updated_at,'epoch'::timestamptz))>published.created_at) then 'Published · changes to share'
        when published.id is not null then 'Published'
        when d.report_id is not null and (a.kind='str' or a.document_revision=a.input_revision) then 'Ready to share' else 'Draft' end as proposal_status,
      coalesce(activity.opens,0) as proposal_opens, activity.last_opened,
      r.status as legacy_status, r.updated_at as report_updated_at,
      greatest(a.updated_at,r.updated_at) as activity_at,
      jsonb_build_object('id',r.id,'listing_id',r.listing_id,'status',state.status,'updated_at',r.updated_at,'pdf_url',r.pdf_url,
        'listing',jsonb_build_object('id',l.id,'property_address',l.property_address,'hero_image_url',l.hero_image_url,'suburb',l.suburb,'status',l.status)) as report
    from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
    join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
    left join public.digital_proposal_drafts d on d.report_id=r.id
    left join public.digital_proposal_assignments assignment on assignment.agency_id=a.agency_id and assignment.kind=a.kind
    left join lateral (select v.* from public.digital_proposal_versions v where v.report_id=r.id and v.revoked_at is null
      and exists(select 1 from public.digital_proposal_links k where k.version_id=v.id and k.revoked_at is null)
      order by v.created_at desc limit 1) published on true
    left join lateral (select count(*) filter(where e.kind='open') as opens,max(e.created_at) filter(where e.kind='open') as last_opened
      from public.digital_proposal_events e where e.agency_id=a.agency_id and e.report_id=r.id) activity on true
    cross join lateral (select case when r.status='archived' or l.status='archived' then 'archived'
      when published.id is not null then 'published' when r.status='failed' then 'failed'
      when d.report_id is not null and (a.kind='str' or a.document_revision=a.input_revision) then 'generated' else 'draft' end as status) state
    where a.agency_id=p_agency_id and (p_kind is null or a.kind=p_kind) and (p_listing_id is null or l.id=p_listing_id)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(a.recipient_name,'') || ' ' || coalesce(l.property_address,'') || ' ' || coalesce(l.suburb,'')))>0)
  ), filtered as (
    select * from scoped where
      (p_status='all' and status<>'archived') or (p_status='draft' and status in ('draft','scraped','estimated'))
      or (p_status='ready' and status='generated') or (p_status in ('published','failed','archived') and status=p_status)
  ), paged as (
    select * from filtered order by activity_at desc,report_id
    limit least(greatest(p_page_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),100)
  ) select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(p)-'status'-'report_updated_at'-'activity_at' order by activity_at desc,report_id) from paged p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'counts',(select jsonb_build_object('draft',count(*) filter(where status in ('draft','scraped','estimated')),
      'ready',count(*) filter(where status='generated'),'published',count(*) filter(where status='published'),
      'failed',count(*) filter(where status='failed'),'archived',count(*) filter(where status='archived')) from scoped)
  );
$$;

revoke all on function public.list_appraisals(uuid,text,text,uuid,integer,integer,text) from public,anon;
grant execute on function public.list_appraisals(uuid,text,text,uuid,integer,integer,text) to authenticated,service_role;
create or replace function public.list_str_appraisals(p_agency_id uuid,p_search text default '',p_status text default 'all',p_listing_id uuid default null,p_page integer default 1,p_page_size integer default 20)
returns jsonb language sql stable security invoker set search_path='' as $$
 select public.list_appraisals(p_agency_id,p_search,p_status,p_listing_id,p_page,p_page_size,'str');
$$;

create or replace function public.attach_prospect_brand(p_brand_id uuid, p_agency_id uuid, p_owner_id uuid,
  p_agency_brand jsonb, p_presets jsonb, p_assignment jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_brand public.prospect_brands;
begin
  select * into v_brand from public.prospect_brands
    where id=p_brand_id and owner_user_id=p_owner_id for update;
  if not found or not exists(select 1 from public.prospect_operators where user_id=p_owner_id) then
    raise exception 'Prospect not found' using errcode='PT404';
  end if;
  if v_brand.converted_agency_id is not null then
    if v_brand.converted_agency_id=p_agency_id then return; end if;
    raise exception 'Brand is already attached to an account' using errcode='PT409';
  end if;
  perform id from public.agencies where id=p_agency_id for update;
  if not found or not exists(select 1 from public.agency_members where agency_id=p_agency_id) then
    raise exception 'Create the customer account before attaching branding' using errcode='PT409';
  end if;
  if exists(select 1 from public.digital_proposal_assignments where agency_id=p_agency_id and kind='str') then
    raise exception 'This account already has a proposal design; review it before replacing branding' using errcode='PT409';
  end if;
  update public.agencies set
    name=p_agency_brand->>'name', website_url=p_agency_brand->>'website_url',
    logo_url=p_agency_brand->>'logo_url', logo_dark_url=p_agency_brand->>'logo_dark_url',
    logo_light_url=p_agency_brand->>'logo_light_url', phone=p_agency_brand->>'phone', email=p_agency_brand->>'email',
    primary_colour=p_agency_brand->>'primary_colour', secondary_colour=p_agency_brand->>'secondary_colour',
    accent_colour=p_agency_brand->>'accent_colour', text_colour=p_agency_brand->>'text_colour',
    background_colour=p_agency_brand->>'background_colour',
    heading_font_family=p_agency_brand->>'heading_font_family', body_font_family=p_agency_brand->>'body_font_family',
    str_management_presets=p_presets, updated_at=now()
    where id=p_agency_id;
  insert into public.digital_proposal_assignments(agency_id,name,version,defaults)
    values(p_agency_id,p_assignment->>'name',(p_assignment->>'version')::integer,p_assignment->'defaults');
  update public.prospect_brands set converted_agency_id=p_agency_id,updated_at=now() where id=p_brand_id;
end; $$;
