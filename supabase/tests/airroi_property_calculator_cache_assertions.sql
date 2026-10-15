-- Run after the cache fixture and both cache migrations in disposable PG17 only.
\set ON_ERROR_STOP on
begin;
set local role service_role;
create function pg_temp.cache_key(p_label text) returns text language sql immutable as $$
  select repeat(md5(p_label), 2)
$$;
create function pg_temp.property_claim(p_label text, p_property text, p_input jsonb,
  p_owner uuid default '10000000-0000-4000-8000-000000000001', p_legacy text default null)
returns jsonb language sql as $$
  select public.claim_airroi_property_calculator_cache(
    pg_temp.cache_key(p_label), pg_temp.cache_key(coalesce(p_legacy, 'legacy-' || p_label)),
    p_owner, pg_temp.cache_key(p_property), pg_temp.cache_key('config'), p_input)
$$;

do $$
declare
  v_input jsonb := '{"latitude":-33.9,"longitude":151.2,"bedrooms":3,"bathrooms":1.5,"accommodates":6,"radiusM":2000,"currency":"AUD"}';
  v_near jsonb;
  v_far jsonb;
  v_result jsonb;
  v_complete jsonb;
  v_variant jsonb;
  v_owner uuid := '10000000-0000-4000-8000-000000000001';
  v_other uuid := '10000000-0000-4000-8000-000000000002';
  v_case record;
begin
  v_near := v_input || '{"latitude":-33.8997}'::jsonb; -- 33.4m north
  v_far := v_input || '{"latitude":-33.8994}'::jsonb; -- 66.7m from original, 33.4m from prior hit
  v_result := pg_temp.property_claim('anchor', 'unit-1', v_input);
  assert v_result->>'status' = 'claimed' and v_result->'provider_input' = v_input;
  v_result := pg_temp.property_claim('near', 'unit-1', v_near, v_other);
  assert v_result->>'status' = 'pending' and v_result->>'request_key' = pg_temp.cache_key('anchor');
  assert v_result->'provider_input' = v_input, 'Pending reuse moved provider anchor';
  v_complete := public.complete_airroi_calculator_cache(pg_temp.cache_key('anchor'), v_owner,
    '{"revenue":123,"comps":[{"id":"123456789123456789","photos":["https://example.com/photo"]}]}', 'original-request');
  v_result := pg_temp.property_claim('near', 'unit-1', v_near, v_other);
  assert v_result->>'status' = 'hit' and v_result->>'request_key' = pg_temp.cache_key('anchor');
  assert v_result->'provider_input' = v_input, 'Hit moved provider anchor';
  assert v_result->>'request_id' = 'original-request';
  assert v_result->'response'->'comps'->0->>'id' = '123456789123456789', 'Comparable evidence changed';
  assert v_result->>'fetched_at' = v_complete->>'fetched_at'
    and v_result->>'expires_at' = v_complete->>'expires_at', 'Fuzzy hit extended TTL';
  assert (select fetch_count = 1 and hit_count = 1 from public.airroi_calculator_cache
    where request_key = pg_temp.cache_key('anchor'));
  v_result := pg_temp.property_claim('far', 'unit-1', v_far);
  assert v_result->>'status' = 'claimed' and v_result->'provider_input' = v_far,
    'Coordinates walked beyond original 50m anchor';
  assert v_result->>'request_key' = pg_temp.cache_key('far');

  -- Identity, including units, is mandatory even at identical coordinates.
  v_result := pg_temp.property_claim('unit-2', 'unit-2', v_input);
  assert v_result->>'status' = 'claimed', 'Different unit reused the other property';
  v_result := pg_temp.property_claim('neighbor', 'neighbor', v_near);
  assert v_result->>'status' = 'claimed', 'Nearby different address reused another property';

  -- Deliberately keep configuration_key unchanged: effective values must still match.
  for v_case in select * from (values
    ('bedrooms', '4'::jsonb), ('bathrooms', '2'::jsonb), ('accommodates', '8'::jsonb),
    ('radiusM', '1500'::jsonb), ('currency', '"USD"'::jsonb)
  ) as cases(field, value) loop
    v_variant := jsonb_set(v_near, array[v_case.field], v_case.value);
    v_result := pg_temp.property_claim('different-' || v_case.field, 'unit-1', v_variant);
    assert v_result->>'status' = 'claimed', 'Mismatched effective input reused cache: ' || v_case.field;
    assert v_result->'provider_input' = v_variant;
  end loop;
  begin
    perform pg_temp.property_claim('anchor', 'wrong-property', v_input);
    raise exception 'An exact key collision crossed property identities';
  exception when invalid_parameter_value then null; end;
  begin
    perform pg_temp.property_claim('anchor', 'unit-1', v_input || '{"bathrooms":7}'::jsonb);
    raise exception 'An exact key collision crossed configurations';
  exception when invalid_parameter_value then null; end;

  -- The 50m cutoff uses physical distance, not a coordinate rounding bucket.
  v_variant := v_input || '{"latitude":0,"longitude":0}'::jsonb;
  perform pg_temp.property_claim('threshold', 'threshold-property', v_variant);
  v_result := pg_temp.property_claim('threshold-inside', 'threshold-property',
    v_variant || jsonb_build_object('latitude', degrees(49.9 / 6371000)));
  assert v_result->>'status' = 'pending', '49.9m offset missed';
  v_result := pg_temp.property_claim('threshold-outside', 'threshold-property',
    v_variant || jsonb_build_object('latitude', degrees(50.1 / 6371000)));
  assert v_result->>'status' = 'claimed', '50.1m offset reused original anchor';

  -- Longitude must also work across the date line.
  v_variant := v_input || '{"latitude":0,"longitude":179.9999}'::jsonb;
  perform pg_temp.property_claim('date-line', 'date-line-property', v_variant);
  v_result := pg_temp.property_claim('date-line-near', 'date-line-property',
    v_variant || '{"longitude":-179.9999}'::jsonb);
  assert v_result->>'status' = 'pending', 'Near coordinates across the date line missed';

  -- Active failures coalesce too; expiry creates a new lease with CURRENT input.
  perform pg_temp.property_claim('failure', 'failure-property', v_input);
  assert public.fail_airroi_calculator_cache(pg_temp.cache_key('failure'), v_owner);
  v_result := pg_temp.property_claim('failure-near', 'failure-property', v_near);
  assert v_result->>'status' = 'cooldown' and v_result->'provider_input' = v_input;
  update public.airroi_calculator_cache set retry_after = clock_timestamp() - interval '1 second'
    where request_key = pg_temp.cache_key('failure');
  v_result := pg_temp.property_claim('failure-near', 'failure-property', v_near);
  assert v_result->>'status' = 'claimed' and v_result->'provider_input' = v_near;
  assert v_result->>'request_key' = pg_temp.cache_key('failure-near');

  perform pg_temp.property_claim('expired', 'expired-property', v_input);
  perform public.complete_airroi_calculator_cache(pg_temp.cache_key('expired'), v_owner, '{"revenue":12}');
  update public.airroi_calculator_cache set fetched_at = now() - interval '721 hours',
    expires_at = now() - interval '1 hour' where request_key = pg_temp.cache_key('expired');
  v_result := pg_temp.property_claim('expired-near', 'expired-property', v_near);
  assert v_result->>'status' = 'claimed' and v_result->'provider_input' = v_near and not (v_result ? 'response');
  assert v_result->>'request_key' = pg_temp.cache_key('expired-near');
  v_result := pg_temp.property_claim('expired', 'expired-property', v_far);
  assert v_result->>'status' = 'pending', 'Fresh replacement lease did not coalesce nearby work';

  -- A v1 exact cache can be adopted once without replacing any evidence or time.
  perform public.claim_airroi_calculator_cache(pg_temp.cache_key('legacy-ready'), v_owner);
  v_complete := public.complete_airroi_calculator_cache(pg_temp.cache_key('legacy-ready'), v_owner, '{"revenue":77}');
  v_result := pg_temp.property_claim('adoption', 'legacy-unit-1', v_input, v_other, 'legacy-ready');
  assert v_result->>'status' = 'hit' and v_result->>'request_key' = pg_temp.cache_key('legacy-ready');
  assert v_result->'provider_input' = v_input and v_result->>'fetched_at' = v_complete->>'fetched_at'
    and v_result->>'expires_at' = v_complete->>'expires_at';
  v_result := pg_temp.property_claim('adoption-other-unit', 'legacy-unit-2', v_input, v_other, 'legacy-ready');
  assert v_result->>'status' = 'claimed', 'Different unit adopted already-owned legacy data';
  v_result := pg_temp.property_claim('adoption-near', 'legacy-unit-1', v_near);
  assert v_result->>'status' = 'hit' and v_result->'provider_input' = v_input;
  v_result := public.claim_airroi_calculator_cache(pg_temp.cache_key('legacy-ready'), v_other);
  assert v_result->>'status' = 'hit', 'Old deployed RPC lost compatibility';

  perform public.claim_airroi_calculator_cache(pg_temp.cache_key('legacy-pending'), v_owner);
  v_result := pg_temp.property_claim('adopt-pending', 'legacy-pending-property', v_input, v_other, 'legacy-pending');
  assert v_result->>'status' = 'pending';
  perform public.complete_airroi_calculator_cache(pg_temp.cache_key('legacy-pending'), v_owner, '{"revenue":88}');
  v_result := pg_temp.property_claim('adopt-pending-near', 'legacy-pending-property', v_near);
  assert v_result->>'status' = 'hit' and v_result->'response'->>'revenue' = '88';

  perform public.claim_airroi_calculator_cache(pg_temp.cache_key('legacy-expired'), v_owner);
  perform public.complete_airroi_calculator_cache(pg_temp.cache_key('legacy-expired'), v_owner, '{"revenue":99}');
  update public.airroi_calculator_cache set fetched_at = now() - interval '721 hours',
    expires_at = now() - interval '1 hour' where request_key = pg_temp.cache_key('legacy-expired');
  v_result := pg_temp.property_claim('ignore-expired-legacy', 'legacy-expired-property', v_input, v_other, 'legacy-expired');
  assert v_result->>'status' = 'claimed' and v_result->>'request_key' = pg_temp.cache_key('ignore-expired-legacy');
  assert (select property_key is null from public.airroi_calculator_cache where request_key = pg_temp.cache_key('legacy-expired'));

  -- Do not retain an address/contact payload if a service caller passes one.
  begin
    perform pg_temp.property_claim('invalid', 'unit-1', v_input || '{"email":"person@example.com"}'::jsonb);
    raise exception 'Contact data was stored in shared cache';
  exception when invalid_parameter_value then null; end;
  begin
    perform pg_temp.property_claim('invalid', 'unit-1', v_input || '{"latitude":91}'::jsonb);
    raise exception 'Invalid latitude was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform pg_temp.property_claim('invalid', 'unit-1', v_input || '{"bathrooms":null}'::jsonb);
    raise exception 'Null configuration was accepted';
  exception when invalid_parameter_value then null; end;
end $$;

reset role;
do $$ declare v_role text; begin
  foreach v_role in array array['anon','authenticated'] loop
    assert not has_function_privilege(v_role,
      'public.claim_airroi_property_calculator_cache(text,text,uuid,text,text,jsonb)', 'EXECUTE');
    assert not has_table_privilege(v_role, 'public.airroi_calculator_cache', 'SELECT');
  end loop;
  assert has_function_privilege('service_role',
    'public.claim_airroi_property_calculator_cache(text,text,uuid,text,text,jsonb)', 'EXECUTE');
  assert (select not prosecdef and proconfig = array['search_path=""'] from pg_proc where oid =
    'public.claim_airroi_property_calculator_cache(text,text,uuid,text,text,jsonb)'::regprocedure);
  assert (select final_report_json = '{"published":"unchanged"}' and original_estimate_json = '{"historical":"unchanged"}' from public.reports where id = 1);
  assert (select original_estimate_json = '{"historical":"unchanged"}' from public.str_calculator_leads where id = 1);
  assert (select not metering_enabled from public.billing_accounts where id = 1);
end $$;
set local role anon;
do $$ begin
  begin
    perform public.claim_airroi_property_calculator_cache(repeat('a',64),repeat('b',64),gen_random_uuid(),repeat('c',64),repeat('d',64),'{}');
    raise exception 'Browser caller executed property cache RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo Property calculator cache SQL assertions passed
