-- Simulate an operator reviewing exact IDs before the unique constraint is added.
set role service_role;
do $$
declare agency uuid := '20000000-0000-4000-8000-000000000001'; first_id uuid := '70000000-0000-4000-8000-000000000001';
 second_id uuid := '70000000-0000-4000-8000-000000000002'; third_id uuid := '70000000-0000-4000-8000-000000000003'; result jsonb;
begin
 begin
  perform public.merge_agency_clients(agency,second_id,first_id,now()-interval '1 day',now());
  raise exception 'Allowed stale merge';
 exception when sqlstate 'PT409' then null; end;
 result := public.merge_agency_clients(agency,third_id,second_id,
  (select updated_at from public.agency_contacts where id=third_id),(select updated_at from public.agency_contacts where id=second_id));
 assert result->>'alreadyMerged'='false';
 result := public.merge_agency_clients(agency,second_id,first_id,
  (select updated_at from public.agency_contacts where id=second_id),(select updated_at from public.agency_contacts where id=first_id));
 assert result->>'alreadyMerged'='false';
 assert (select bool_and(merged_into_contact_id=first_id) from public.agency_contacts where id in(second_id,third_id)), 'Merge did not flatten earlier aliases';
 result := public.merge_agency_clients(agency,second_id,first_id,null,null);
 assert result->>'alreadyMerged'='true', 'Retry did not preserve the completed merge';
end $$;
reset role;
