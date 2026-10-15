\set ON_ERROR_STOP on
begin;
set local role service_role;
do $$
declare
  v_key text := repeat('a', 64);
  v_owner uuid := '10000000-0000-4000-8000-000000000001';
  v_other uuid := '10000000-0000-4000-8000-000000000002';
  v_result jsonb;
  v_completed jsonb;
begin
  v_result := public.claim_airroi_calculator_cache(v_key, v_owner);
  assert v_result->>'status' = 'claimed', 'First request did not acquire lease';
  v_result := public.claim_airroi_calculator_cache(v_key, v_other);
  assert v_result->>'status' = 'pending', 'Second request acquired an active lease';
  assert not (v_result ? 'response'), 'Pending requests must not expose stale data';
  assert not public.fail_airroi_calculator_cache(v_key, v_other), 'Other worker released lease';
  begin
    perform public.complete_airroi_calculator_cache(v_key, v_other, '{"revenue":123}');
    raise exception 'Other worker completed lease';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.complete_airroi_calculator_cache(v_key, v_owner, '{}');
    raise exception 'Empty response was cached';
  exception when invalid_parameter_value then null; end;
  v_completed := public.complete_airroi_calculator_cache(v_key, v_owner,
    '{"revenue":123,"id":"1000000000000000001"}', 'provider-request-1');
  assert (v_completed->>'expires_at')::timestamptz - (v_completed->>'fetched_at')::timestamptz
    = interval '720 hours', 'TTL is not exactly 30 days';
  v_result := public.claim_airroi_calculator_cache(v_key, v_other);
  assert v_result->>'status' = 'hit' and v_result->'response'->>'revenue' = '123';
  assert v_result->'response'->>'id' = '1000000000000000001', 'Long listing ID changed';
  assert v_result->>'request_id' = 'provider-request-1';
  assert v_result->>'fetched_at' = v_completed->>'fetched_at'
    and v_result->>'expires_at' = v_completed->>'expires_at', 'Hit extended cache TTL';
  v_result := public.complete_airroi_calculator_cache(v_key, v_owner, '{"revenue":999}');
  assert v_result = v_completed, 'Completion replay was not idempotent';
  assert (select response->>'revenue' = '123' and fetch_count = 1 and hit_count = 1
    from public.airroi_calculator_cache where request_key = v_key), 'Completion replay rewrote response';

  -- Expired data is unavailable; a new owner supersedes the old completion.
  update public.airroi_calculator_cache set fetched_at = now() - interval '721 hours',
    expires_at = now() - interval '1 hour' where request_key = v_key;
  v_result := public.claim_airroi_calculator_cache(v_key, v_other);
  assert v_result->>'status' = 'claimed' and not (v_result ? 'response');
  assert (select response is null from public.airroi_calculator_cache where request_key = v_key),
    'Expired payload was retained during replacement fetch';
  begin
    perform public.complete_airroi_calculator_cache(v_key, v_owner, '{"revenue":456}');
    raise exception 'Old worker overwrote replacement';
  exception when sqlstate 'PT409' then null; end;

  -- Failures produce no result and bound repeated paid attempts.
  assert public.fail_airroi_calculator_cache(v_key, v_other);
  v_result := public.claim_airroi_calculator_cache(v_key, v_owner);
  assert v_result->>'status' = 'cooldown';
  update public.airroi_calculator_cache set retry_after = clock_timestamp() - interval '1 second'
    where request_key = v_key;
  v_result := public.claim_airroi_calculator_cache(v_key, v_owner);
  assert v_result->>'status' = 'claimed';
  assert (select fetch_count = 3 and failure_count = 1 from public.airroi_calculator_cache where request_key = v_key);

  -- An abandoned lease is recoverable, and its old owner cannot finish later.
  update public.airroi_calculator_cache set lease_expires_at = clock_timestamp() - interval '1 second'
    where request_key = v_key;
  begin
    perform public.complete_airroi_calculator_cache(v_key, v_owner, '{"revenue":456}');
    raise exception 'Expired lease completed';
  exception when sqlstate 'PT409' then null; end;
  v_result := public.claim_airroi_calculator_cache(v_key, v_other);
  assert v_result->>'status' = 'claimed';
  assert not public.fail_airroi_calculator_cache(v_key, v_owner), 'Stale worker released replacement';
  perform public.complete_airroi_calculator_cache(v_key, v_other, '{"revenue":789}');

  -- Purge removes expired data, but leaves valid results and active work alone.
  perform public.claim_airroi_calculator_cache(repeat('b', 64), v_owner);
  perform public.complete_airroi_calculator_cache(repeat('b', 64), v_owner, '{"revenue":10}');
  update public.airroi_calculator_cache set fetched_at = now() - interval '721 hours',
    expires_at = now() - interval '1 hour' where request_key = repeat('b', 64);
  perform public.claim_airroi_calculator_cache(repeat('c', 64), v_owner);
  perform public.claim_airroi_calculator_cache(repeat('d', 64), v_owner);
  update public.airroi_calculator_cache set lease_expires_at = now() - interval '25 hours',
    updated_at = now() - interval '25 hours' where request_key = repeat('d', 64);
  assert public.purge_airroi_calculator_cache(1) = 1, 'Cleanup ignored batch limit';
  assert public.purge_airroi_calculator_cache(1000) = 1, 'Cleanup missed expired/abandoned data';
  assert public.purge_airroi_calculator_cache() = 0, 'Cleanup deleted fresh data';
  assert (select count(*) = 2 from public.airroi_calculator_cache);
end;
$$;
reset role;
do $$ declare v_role text; v_signature text; begin
  assert (select relrowsecurity from pg_class where oid = 'public.airroi_calculator_cache'::regclass);
  foreach v_role in array array['anon', 'authenticated'] loop
    assert not has_table_privilege(v_role, 'public.airroi_calculator_cache', 'SELECT');
    assert not has_table_privilege(v_role, 'public.airroi_calculator_cache', 'INSERT');
    assert not has_table_privilege(v_role, 'public.airroi_calculator_cache', 'UPDATE');
    assert not has_table_privilege(v_role, 'public.airroi_calculator_cache', 'DELETE');
    foreach v_signature in array array[
      'public.claim_airroi_calculator_cache(text,uuid)',
      'public.complete_airroi_calculator_cache(text,uuid,jsonb,text)',
      'public.fail_airroi_calculator_cache(text,uuid)',
      'public.purge_airroi_calculator_cache(integer)'
    ] loop
      assert not has_function_privilege(v_role, v_signature, 'EXECUTE');
      assert (select not prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = v_signature::regprocedure),
        'Cache RPC must be SECURITY INVOKER with an empty search_path';
    end loop;
  end loop;
  assert (select final_report_json = '{"published":"unchanged"}' and original_estimate_json = '{"historical":"unchanged"}' from public.reports where id = 1);
  assert (select original_estimate_json = '{"historical":"unchanged"}' from public.str_calculator_leads where id = 1);
  assert (select not metering_enabled from public.billing_accounts where id = 1), 'Billing was enabled';
end $$;
set local role anon;
do $$ begin
  begin
    perform public.claim_airroi_calculator_cache(repeat('a', 64), gen_random_uuid());
    raise exception 'Anonymous caller accessed cache RPC';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$ begin
  begin
    perform count(*) from public.airroi_calculator_cache;
    raise exception 'Authenticated caller read provider cache';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo AirROI calculator cache SQL assertions passed
