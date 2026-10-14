-- Disposable local database only. No real records.
begin;
set local role service_role;
select public.save_digital_proposal('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',0,'{"test":1}');
do $$ begin
  begin
    perform public.save_digital_proposal('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',0,'{"test":2}');
    raise exception 'stale write was accepted';
  exception when sqlstate 'PT409' then null; end;
end $$;
select public.publish_digital_proposal(r.agency_id,r.id,1,'{"frozen":true}',repeat('a',64),r.updated_at,l.updated_at,a.updated_at)
from public.reports r join public.listings l on l.id=r.listing_id join public.str_appraisals a on a.report_id=r.id where r.id='40000000-0000-4000-8000-000000000001';
select public.publish_digital_proposal(r.agency_id,r.id,1,'{"frozen":false}',repeat('b',64),r.updated_at,l.updated_at,a.updated_at)
from public.reports r join public.listings l on l.id=r.listing_id join public.str_appraisals a on a.report_id=r.id where r.id='40000000-0000-4000-8000-000000000001';
do $$ begin
  if (select count(*) from public.digital_proposal_versions)<>1 then raise exception 'publish not idempotent'; end if;
  if (select final_report_json->>'frozen' from public.digital_proposal_versions limit 1)<>'true' then raise exception 'snapshot changed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.digital_proposal_drafts) or exists(select 1 from public.digital_proposal_versions) then raise exception 'cross-agency leak'; end if;
  if has_function_privilege('authenticated','public.publish_digital_proposal(uuid,uuid,integer,jsonb,text,timestamptz,timestamptz,timestamptz)','execute') then raise exception 'client can bypass snapshot builder'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.reports set status='archived' where id='40000000-0000-4000-8000-000000000001';
update public.reports set status='draft' where id='40000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.digital_proposal_versions where revoked_at is null) then raise exception 'restored appraisal reactivated share link'; end if;
  begin
    update public.digital_proposal_versions set revoked_at=null;
    raise exception 'member reactivated revoked link';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.digital_proposal_versions','select') then raise exception 'anonymous direct snapshot access'; end if;
  if (select public from storage.buckets where id='proposal-documents') then raise exception 'documents bucket is public'; end if;
end $$;
rollback;
