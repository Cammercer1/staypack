\set ON_ERROR_STOP on
begin;
insert into public.billing_accounts(id,agency_id,livemode,stripe_customer_id,stripe_subscription_id,plan,status,metering_enabled)
values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',false,'cus_test','sub_test',
  '{"calculatorEventName":"calculator","reportEventName":"report"}','active',true);
insert into public.billing_accounts(id,agency_id,livemode) values
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',false);
insert into public.reports(id,agency_id) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
-- Publication and retries produce one event, even through both publishing paths.
update public.reports set status='published',published_at=now() where id='40000000-0000-4000-8000-000000000001';
update public.reports set status='published',published_at=now() where id='40000000-0000-4000-8000-000000000001';
insert into public.digital_proposal_versions values('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
do $$ begin
  assert (select count(*)=1 from public.billing_usage_events),'Publication must be counted exactly once';
end $$;
-- The digital-first path and revisions count once too.
insert into public.reports(id,agency_id) values('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
insert into public.digital_proposal_versions values('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
insert into public.digital_proposal_versions values('60000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
update public.reports set status='published',published_at=now() where id='40000000-0000-4000-8000-000000000002';
do $$ begin assert (select count(*)=2 from public.billing_usage_events),'Digital publication must count once'; end $$;

-- Failed parent transactions leave no billable event.
savepoint publication;
insert into public.reports(id,agency_id) values('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001');
update public.reports set status='published' where id='40000000-0000-4000-8000-000000000003';
rollback to publication;
do $$ begin assert (select count(*)=2 from public.billing_usage_events),'Rolled-back publication was billed'; end $$;

-- Unenrolled agencies and retries of successful calculator results.
select public.record_billing_usage('20000000-0000-4000-8000-000000000002',false,'calculator','result-a');
select public.record_billing_usage('20000000-0000-4000-8000-000000000001',false,'calculator','result-a');
select public.record_billing_usage('20000000-0000-4000-8000-000000000001',false,'calculator','result-a');
do $$ begin assert (select count(*)=3 from public.billing_usage_events),'Duplicate calculator result or unenrolled agency billed'; end $$;

-- Different periods use inclusive start/exclusive end, without a REST row cap.
update public.billing_usage_events set occurred_at='2026-10-01T00:00:00Z' where kind='calculator';
update public.billing_usage_events set occurred_at='2026-11-01T00:00:00Z' where kind='report';
do $$ declare totals jsonb; begin
  totals:=public.billing_usage_totals('50000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01');
  assert totals->>'calculators'='1' and totals->>'reports'='0','Billing period boundaries incorrect';
end $$;

-- Claims exclude already leased rows and live mode cannot claim test usage.
do $$ declare n integer; begin
  select count(*) into n from public.claim_billing_usage(true,'70000000-0000-4000-8000-000000000001'); assert n=0;
  select count(*) into n from public.claim_billing_usage(false,'70000000-0000-4000-8000-000000000001'); assert n=3;
  select count(*) into n from public.claim_billing_usage(false,'70000000-0000-4000-8000-000000000002'); assert n=0;
end $$;
-- Both environments cannot meter the same agency.
do $$ begin
  begin
    insert into public.billing_accounts(agency_id,livemode,metering_enabled) values('20000000-0000-4000-8000-000000000001',true,true);
    raise exception 'Double metering was allowed';
  exception when unique_violation then null; end;
end $$;
-- Billing writes and RPCs are unavailable to browser roles, even an owner.
do $$ declare a public.billing_accounts; b public.billing_accounts; begin
  a:=public.begin_billing_checkout('50000000-0000-4000-8000-000000000002','{"id":"plan-a"}');
  b:=public.begin_billing_checkout('50000000-0000-4000-8000-000000000002','{"id":"plan-a"}');
  assert a.checkout_attempt=b.checkout_attempt,'Checkout retries created different attempts';
  assert public.claim_billing_sync(a.id,'70000000-0000-4000-8000-000000000001');
  assert not public.claim_billing_sync(a.id,'70000000-0000-4000-8000-000000000002'),'Concurrent sync acquired same account';
  perform public.finish_billing_sync(a.id,'70000000-0000-4000-8000-000000000001','evt_test','sub_second','active',
    '{"id":"plan-a","reportEventName":"report","calculatorEventName":"calculator"}','2026-10-01','2026-11-01',false);
  assert (select metering_enabled and status='active' from public.billing_accounts where id=a.id),'Verified active subscription did not enable metering';
  assert (select count(*)=1 from public.billing_webhook_events where stripe_event_id='evt_test');
end $$;
do $$ begin
  assert not has_table_privilege('authenticated','public.billing_accounts','UPDATE');
  assert not has_table_privilege('authenticated','public.billing_usage_events','INSERT');
  assert not has_function_privilege('authenticated','public.record_billing_usage(uuid,boolean,text,text)','EXECUTE');
  assert not has_function_privilege('anon','public.begin_billing_checkout(uuid,jsonb)','EXECUTE');
  assert not has_schema_privilege('authenticated','billing_private','USAGE');
  assert (select bool_and(relrowsecurity) from pg_class where oid in ('public.billing_accounts'::regclass,'public.billing_usage_events'::regclass,'public.billing_webhook_events'::regclass));
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin assert (select count(*)=1 from public.billing_accounts); assert (select count(*)=3 from public.billing_usage_events); end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin assert (select count(*)=1 from public.billing_accounts); assert (select count(*)=0 from public.billing_usage_events); end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin assert (select count(*)=0 from public.billing_accounts); assert (select count(*)=0 from public.billing_usage_events); end $$;
reset role;
-- Ordinary team members can publish without gaining permission to forge usage.
insert into public.reports(id,agency_id) values('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
update public.reports set status='published',published_at=now() where id='40000000-0000-4000-8000-000000000004';
reset role;
do $$ begin assert (select count(*)=4 from public.billing_usage_events),'Member publication failed to write trusted usage'; end $$;
rollback;
\echo Billing SQL assertions passed
