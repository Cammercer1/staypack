-- Run against the disposable fixture after the STR workspace migration.
begin;
do $$ begin
  assert (select count(*) from public.str_appraisals)=1, 'Backfill must exclude lease and unknown drafts';
  assert (select final_report_json->>'fixture' from public.reports where id='40000000-0000-4000-8000-000000000001')='unchanged';
  assert not has_table_privilege('anon','public.str_appraisals','select');
  assert not has_table_privilege('anon','public.agency_contacts','select');
  assert not has_function_privilege('anon','public.create_str_appraisal(uuid,uuid,uuid,text,jsonb,text)','execute');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.create_str_appraisal('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','classic-detailed','{"mode":"named","name":"Alex Owner","email":"alex@example.test","phone":"0400 000 001","phone_e164":"+61400000001"}');
-- Identical retry returns the same report and customer.
select public.create_str_appraisal('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','classic-detailed','{"mode":"named","name":"Alex Owner","email":"alex@example.test","phone":"0400 000 001","phone_e164":"+61400000001"}');
select public.create_str_appraisal('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','classic-detailed','{"mode":"named","name":"Priya Owner"}');
do $$ declare result jsonb; c uuid; a public.str_appraisals; begin
  assert (select count(*) from public.str_appraisals)=3;
  assert (select count(*) from public.agency_contacts)=2, 'Retry duplicated customer';
  assert (select report_id from public.collateral_items where type='str_report')='40000000-0000-4000-8000-000000000001', 'Customer changed brochure source';
  result := public.list_str_appraisals('20000000-0000-4000-8000-000000000001','Alex');
  assert (result->>'total')::int=1;
  result := public.list_str_appraisals('20000000-0000-4000-8000-000000000001','Beach','draft',null,1,1);
  assert (result->>'total')::int=2 and jsonb_array_length(result->'rows')=1;
  assert (result->'counts'->>'published')::int=1;
  result := public.list_str_appraisals('20000000-0000-4000-8000-000000000001','%');
  assert (result->>'total')::int=0, 'Search must be literal';
  select * into a from public.str_appraisals where report_id='50000000-0000-4000-8000-000000000001';
  c := a.contact_id;
  update public.agency_contacts set name='Changed contact' where id=c;
  assert (select recipient_name from public.str_appraisals where report_id=a.report_id)='Alex Owner', 'Snapshot changed with contact';
  begin
    perform public.save_str_appraisal_recipient(a.agency_id,a.report_id,'{"mode":"named","name":"Changed"}',a.updated_at-interval '1 second');
    raise exception 'Expected concurrency rejection';
  exception when sqlstate 'PT409' then null; end;
  perform public.save_str_appraisal_recipient(a.agency_id,a.report_id,'{"mode":"general","name":"must disappear","email":"hidden@example.test"}',a.updated_at);
  assert (select recipient_name is null and recipient_email is null and contact_id is null from public.str_appraisals where report_id=a.report_id);
  assert (select count(*) from public.reports where final_report_json::text like '%alex@example.test%')=0;
  begin
    perform public.create_str_appraisal(a.agency_id,'30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','classic-detailed','{"mode":"general"}');
    raise exception 'Expected property agency rejection';
  exception when raise_exception then if sqlerrm='Expected property agency rejection' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare result jsonb; begin
  assert (select count(*) from public.str_appraisals)=0;
  assert (select count(*) from public.agency_contacts)=0;
  result := public.list_str_appraisals('20000000-0000-4000-8000-000000000001');
  assert (result->>'total')::int=0, 'RPC leaked another agency';
  begin
    perform public.create_str_appraisal('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','classic-detailed','{"mode":"general"}');
    raise exception 'Expected agency rejection';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin
    insert into public.str_appraisals(report_id,agency_id) values ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
    raise exception 'Expected same-agency foreign key rejection';
  exception when foreign_key_violation then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.reports(id,agency_id,listing_id,template_id) values
('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','classic-detailed');
do $$ begin
  assert exists(select 1 from public.str_appraisals where report_id='60000000-0000-4000-8000-000000000001'), 'Old application writer was not registered';
end $$;
rollback;
