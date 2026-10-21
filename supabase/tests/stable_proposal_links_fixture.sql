-- Synthetic migration/backfill fixture. Disposable Docker database ONLY.
insert into public.digital_proposal_drafts(report_id,agency_id,draft_json,revision)
  values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"version":1,"fixture":"A"}',1);
insert into public.digital_proposal_versions(id,agency_id,report_id,draft_revision,share_token,final_report_json,content_hash,source_fingerprint,created_at,pdf_status,pdf_path) values
 ('72000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,repeat('b',64),'{"version":1,"fixture":"A"}',repeat('b',64),repeat('b',64),'2026-10-19','ready','unchanged-A.pdf'),
 ('72000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,repeat('c',64),'{"version":1,"fixture":"B"}',repeat('c',64),repeat('c',64),'2026-10-20','ready','unchanged-B.pdf');
-- The newest issued token belongs to the older snapshot: adoption must match the visible URL.
insert into public.digital_proposal_links(id,agency_id,report_id,version_id,token,created_at) values
 ('73000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',repeat('b',64),'2026-10-21'),
 ('73000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002',repeat('c',64),'2026-10-20');
insert into public.digital_proposal_events(id,agency_id,report_id,version_id,link_id,session_id,kind,target) values
 ('74000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','open','proposal');
