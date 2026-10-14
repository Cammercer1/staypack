-- Run after the calculator migration. All fixtures roll back; no customer data is changed.
begin;
insert into public.agencies(id,name,slug) values
 ('10000000-0000-4000-8000-000000000001','Calculator test A','calculator-test-a'),
 ('10000000-0000-4000-8000-000000000002','Calculator test B','calculator-test-b');
insert into public.str_calculator_widgets(id,agency_id,public_token,enabled) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',false);
set local role service_role;
do $$
declare r jsonb; duplicate jsonb; i integer;
  payload jsonb := '{"address":"12 Test Street, Sydney NSW 2000","bedrooms":2,"email":"qa@example.com","country":"AU","consent":true}';
begin
  r := public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','hash','client',payload,'v1','Consent');
  duplicate := public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','hash','client',payload,'v1','Consent');
  assert r->>'fresh'='true' and duplicate->>'fresh'='false' and r->>'id'=duplicate->>'id', 'Replay must return the original enquiry';
  begin
    perform public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','changed','client',payload,'v1','Consent');
    raise exception 'Expected conflict';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000002',gen_random_uuid(),'hash','client',payload,'v1','Consent');
    raise exception 'Expected paused calculator rejection';
  exception when sqlstate 'PT404' then null; end;
  for i in 1..4 loop
    perform public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'hash','client',payload,'v1','Consent');
  end loop;
  begin
    perform public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'hash','client',payload,'v1','Consent');
    raise exception 'Expected client rate limit';
  exception when sqlstate 'PT429' then null; end;
end;
$$;
do $$
declare r jsonb; saved public.str_calculator_leads%rowtype;
  payload jsonb := '{"address":"12 Test Street, Sydney NSW 2000","bedrooms":2,"email":"qa@example.com","phone":" 0412 345 678 ","country":"AU","consent":true}';
begin
  update public.str_calculator_widgets set ask_phone=true where public_token='30000000-0000-4000-8000-000000000001';
  r := public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'phone','phone-client',payload,'v2','Contact consent');
  select * into saved from public.str_calculator_leads where id=(r->>'id')::uuid;
  assert saved.phone='0412 345 678' and saved.input_json->>'phone'=saved.phone, 'Enabled phone must be saved in the lead and original input';
  r := public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'no-phone','phone-client',payload - 'phone','v2','Contact consent');
  select * into saved from public.str_calculator_leads where id=(r->>'id')::uuid;
  assert saved.phone is null, 'Enabled phone must remain optional';
  update public.str_calculator_widgets set ask_phone=false where public_token='30000000-0000-4000-8000-000000000001';
  r := public.reserve_str_calculator_lead('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'disabled-phone','phone-client',payload,'v2','Email consent');
  select * into saved from public.str_calculator_leads where id=(r->>'id')::uuid;
  assert saved.phone is null and not (saved.input_json ? 'phone'), 'Disabled phone must not be retained';
end;
$$;
reset role;
set local role anon;
do $$ begin
  begin perform id from public.str_calculator_leads; raise exception 'Anonymous lead access allowed'; exception when insufficient_privilege then null; end;
  begin perform id from public.str_calculator_widgets; raise exception 'Anonymous settings access allowed'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_str_calculator_lead(null,null,null,null,null,null,null); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  assert (select count(id)=0 from public.str_calculator_leads), 'Unrelated users must see no leads';
  assert (select count(id)=0 from public.str_calculator_widgets), 'Unrelated users must see no widgets';
  begin perform original_estimate_json from public.str_calculator_leads; raise exception 'Raw provider data exposed'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_str_calculator_lead(null,null,null,null,null,null,null); raise exception 'Customer RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
