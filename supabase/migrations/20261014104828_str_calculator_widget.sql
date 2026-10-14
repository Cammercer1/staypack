-- Opt-in public calculators. Public visitors only use the server endpoint;
-- neither settings nor leads are directly exposed to anonymous Data API clients.
create table public.str_calculator_widgets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default false,
  country text not null default 'AU' check (country in ('AU','US')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id)
);
create trigger str_calculator_widgets_updated before update on public.str_calculator_widgets
  for each row execute function public.set_updated_at();

create table public.str_calculator_leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  widget_id uuid not null,
  request_id uuid not null,
  input_hash text not null,
  client_hash text not null,
  address text not null check (length(address) between 10 and 300),
  bedrooms integer not null check (bedrooms between 0 and 10),
  email text not null check (length(email) between 3 and 254),
  country text not null check (country in ('AU','US')),
  input_json jsonb not null,
  original_estimate_json jsonb,
  estimate_json jsonb,
  status text not null default 'processing' check (status in ('processing','estimated','failed')),
  consent_version text not null,
  consent_text text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (agency_id, widget_id) references public.str_calculator_widgets(agency_id,id) on delete cascade,
  unique (widget_id,request_id),
  check ((status='estimated') = (estimate_json is not null))
);
create index str_calculator_leads_agency_date on public.str_calculator_leads(agency_id, created_at desc);
create index str_calculator_leads_widget_date on public.str_calculator_leads(widget_id, created_at desc);
create index str_calculator_leads_client_date on public.str_calculator_leads(widget_id, client_hash, created_at desc);

alter table public.str_calculator_widgets enable row level security;
alter table public.str_calculator_leads enable row level security;
revoke all on public.str_calculator_widgets, public.str_calculator_leads from anon, authenticated;
grant select, insert, update on public.str_calculator_widgets to authenticated;
grant select (id,agency_id,widget_id,address,bedrooms,email,country,status,estimate_json,created_at,completed_at,consent_at,consent_text,consent_version)
  on public.str_calculator_leads to authenticated;
grant all on public.str_calculator_widgets, public.str_calculator_leads to service_role;
create policy calculator_widgets_read on public.str_calculator_widgets for select to authenticated
  using (public.is_agency_member(agency_id));
create policy calculator_widgets_create on public.str_calculator_widgets for insert to authenticated
  with check (public.is_agency_admin(agency_id));
create policy calculator_widgets_update on public.str_calculator_widgets for update to authenticated
  using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));
create policy calculator_leads_read on public.str_calculator_leads for select to authenticated
  using (public.is_agency_member(agency_id));

-- Service-only, security INVOKER. Serializing on the widget makes limits and
-- request-id replay protection reliable across concurrent serverless instances.
create function public.reserve_str_calculator_lead(
  p_token uuid, p_request_id uuid, p_input_hash text, p_client_hash text,
  p_input jsonb, p_consent_version text, p_consent_text text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  w public.str_calculator_widgets%rowtype;
  l public.str_calculator_leads%rowtype;
begin
  select * into w from public.str_calculator_widgets where public_token=p_token for update;
  if not found or not w.enabled then raise sqlstate 'PT404' using message='Calculator unavailable'; end if;
  if p_input->>'country' is distinct from w.country then
    raise sqlstate 'PT409' using message='Calculator country changed';
  end if;
  select * into l from public.str_calculator_leads where widget_id=w.id and request_id=p_request_id;
  if found then
    if l.input_hash <> p_input_hash then raise sqlstate 'PT409' using message='Request already used'; end if;
    return jsonb_build_object('id',l.id,'fresh',false,'status',l.status,'estimate',l.estimate_json,'created_at',l.created_at);
  end if;
  if (select count(*) from public.str_calculator_leads where widget_id=w.id and created_at > now()-interval '24 hours') >= 100
    or (select count(*) from public.str_calculator_leads where widget_id=w.id and client_hash=p_client_hash and created_at > now()-interval '1 hour') >= 5 then
    raise sqlstate 'PT429' using message='Calculator request limit reached';
  end if;
  if p_input->>'consent' is distinct from 'true' then raise exception 'Consent is required'; end if;
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,consent_version,consent_text)
    values(w.agency_id,w.id,p_request_id,p_input_hash,p_client_hash,p_input->>'address',(p_input->>'bedrooms')::integer,
      p_input->>'email',w.country,p_input,p_consent_version,p_consent_text) returning * into l;
  return jsonb_build_object('id',l.id,'fresh',true,'status',l.status,'estimate',null,'created_at',l.created_at);
end;
$$;
revoke all on function public.reserve_str_calculator_lead(uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reserve_str_calculator_lead(uuid,uuid,text,text,jsonb,text,text) to service_role;
