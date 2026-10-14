-- Phone collection is opt-in per account; visitors can always leave it blank.
alter table public.str_calculator_widgets add column ask_phone boolean not null default false;
alter table public.str_calculator_leads add column phone text
  check (phone is null or length(phone) between 7 and 32);
-- The existing agency-member RLS policy still limits who can read this column.
grant select (phone) on public.str_calculator_leads to authenticated;

create or replace function public.reserve_str_calculator_lead(
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
  -- Re-check the saved setting under the widget lock before retaining contact data.
  if not w.ask_phone or nullif(btrim(p_input->>'phone'),'') is null then
    p_input := p_input - 'phone';
  else
    p_input := jsonb_set(p_input, '{phone}', to_jsonb(btrim(p_input->>'phone')));
  end if;
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,phone,country,input_json,consent_version,consent_text)
    values(w.agency_id,w.id,p_request_id,p_input_hash,p_client_hash,p_input->>'address',(p_input->>'bedrooms')::integer,
      p_input->>'email',p_input->>'phone',w.country,p_input,p_consent_version,p_consent_text) returning * into l;
  return jsonb_build_object('id',l.id,'fresh',true,'status',l.status,'estimate',null,'created_at',l.created_at);
end;
$$;
revoke all on function public.reserve_str_calculator_lead(uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reserve_str_calculator_lead(uuid,uuid,text,text,jsonb,text,text) to service_role;
