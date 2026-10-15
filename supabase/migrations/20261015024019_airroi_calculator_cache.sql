-- Shared, server-only provider responses. No report, lead, publication or billing
-- records are backfilled, updated or deleted by this migration or its cleanup.
create table public.airroi_calculator_cache (
  request_key text primary key check (request_key ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('pending', 'ready', 'cooldown')),
  response jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  request_id text,
  lease_owner uuid,
  lease_expires_at timestamptz,
  completed_lease_owner uuid,
  retry_after timestamptz,
  hit_count bigint not null default 0 check (hit_count >= 0),
  fetch_count bigint not null default 0 check (fetch_count >= 0),
  failure_count bigint not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint airroi_calculator_cache_record_shape_check check (
    (state = 'ready' and response is not null and jsonb_typeof(response) = 'object' and response <> '{}'::jsonb
      and fetched_at is not null and expires_at is not null and expires_at = fetched_at + interval '720 hours'
      and completed_lease_owner is not null and lease_owner is null
      and lease_expires_at is null and retry_after is null)
    or (state = 'pending' and response is null and fetched_at is null and expires_at is null
      and request_id is null and completed_lease_owner is null and lease_owner is not null
      and lease_expires_at is not null and retry_after is null)
    or (state = 'cooldown' and response is null and fetched_at is null and expires_at is null
      and request_id is null and completed_lease_owner is null and lease_owner is null
      and lease_expires_at is null and retry_after is not null)
  )
);
create index airroi_calculator_cache_expiry_idx
  on public.airroi_calculator_cache (expires_at) where state = 'ready';
create index airroi_calculator_cache_abandoned_idx
  on public.airroi_calculator_cache (updated_at) where state <> 'ready';
alter table public.airroi_calculator_cache enable row level security;
revoke all on public.airroi_calculator_cache from public, anon, authenticated;
grant select, insert, update, delete on public.airroi_calculator_cache to service_role;

comment on table public.airroi_calculator_cache is
  'Server-only raw AirROI calculator responses; fixed 30-day TTL, independent of historical reports and leads. No contact details or agency overrides.';

create function public.claim_airroi_calculator_cache(p_request_key text, p_lease_owner uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.airroi_calculator_cache;
  v_now timestamptz;
begin
  if p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$' or p_lease_owner is null then
    raise exception using errcode = '22023', message = 'Invalid calculator cache request';
  end if;
  -- INSERT + row lock also serializes the first request across server processes.
  -- The lock is released when this RPC returns, before any external HTTP call.
  loop
    v_now := clock_timestamp();
    insert into public.airroi_calculator_cache (
      request_key, state, lease_owner, lease_expires_at, fetch_count
    ) values (p_request_key, 'pending', p_lease_owner, v_now + interval '60 seconds', 1)
    on conflict (request_key) do nothing
    returning * into v_row;
    if found then
      return jsonb_build_object('status', 'claimed', 'retry_at', v_row.lease_expires_at);
    end if;

    select * into v_row from public.airroi_calculator_cache
      where request_key = p_request_key for update;
    -- Cleanup can remove an expired row between INSERT and SELECT.
    exit when found;
  end loop;
  v_now := clock_timestamp();

  if v_row.state = 'ready' and v_row.expires_at > v_now then
    update public.airroi_calculator_cache set hit_count = hit_count + 1, updated_at = v_now
      where request_key = p_request_key;
    return jsonb_build_object('status', 'hit', 'response', v_row.response,
      'fetched_at', v_row.fetched_at, 'expires_at', v_row.expires_at, 'request_id', v_row.request_id);
  end if;
  if v_row.state = 'pending' and v_row.lease_expires_at > v_now then
    return jsonb_build_object('status', 'pending', 'retry_at', v_row.lease_expires_at);
  end if;
  if v_row.state = 'cooldown' and v_row.retry_after > v_now then
    return jsonb_build_object('status', 'cooldown', 'retry_at', v_row.retry_after);
  end if;

  -- Expired provider data is discarded before a replacement fetch is leased.
  update public.airroi_calculator_cache set state = 'pending', response = null,
    fetched_at = null, expires_at = null, request_id = null, completed_lease_owner = null,
    lease_owner = p_lease_owner, lease_expires_at = v_now + interval '60 seconds',
    retry_after = null, fetch_count = fetch_count + 1, updated_at = v_now
    where request_key = p_request_key;
  return jsonb_build_object('status', 'claimed', 'retry_at', v_now + interval '60 seconds');
end;
$$;

create function public.complete_airroi_calculator_cache(
  p_request_key text, p_lease_owner uuid, p_response jsonb, p_request_id text default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.airroi_calculator_cache;
  v_now timestamptz;
begin
  if p_response is null or jsonb_typeof(p_response) <> 'object' or p_response = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Invalid calculator cache response';
  end if;
  select * into v_row from public.airroi_calculator_cache
    where request_key = p_request_key for update;
  v_now := clock_timestamp();
  -- Replaying a completion after a network interruption is safe and never
  -- changes the stored response or extends the original expiry.
  if found and v_row.state = 'ready' and v_row.completed_lease_owner = p_lease_owner
    and v_row.expires_at > v_now then
    return jsonb_build_object('status', 'completed', 'fetched_at', v_row.fetched_at,
      'expires_at', v_row.expires_at);
  end if;
  if not found or v_row.state <> 'pending' or v_row.lease_owner is distinct from p_lease_owner
    or v_row.lease_expires_at <= v_now then
    raise exception using errcode = 'PT409', message = 'Calculator cache lease is no longer owned';
  end if;
  update public.airroi_calculator_cache set state = 'ready', response = p_response,
    fetched_at = v_now, expires_at = v_now + interval '720 hours', request_id = p_request_id,
    completed_lease_owner = p_lease_owner, lease_owner = null, lease_expires_at = null,
    retry_after = null, updated_at = v_now where request_key = p_request_key;
  return jsonb_build_object('status', 'completed', 'fetched_at', v_now,
    'expires_at', v_now + interval '720 hours');
end;
$$;

create function public.fail_airroi_calculator_cache(p_request_key text, p_lease_owner uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- A stale worker cannot release the replacement worker's lease. A cooldown
  -- bounds retries when the provider has failed or the paid call timed out.
  update public.airroi_calculator_cache set state = 'cooldown', lease_owner = null,
    lease_expires_at = null, retry_after = clock_timestamp() + interval '30 seconds',
    failure_count = failure_count + 1, updated_at = clock_timestamp()
    where request_key = p_request_key and state = 'pending' and lease_owner = p_lease_owner;
  return found;
end;
$$;

create function public.purge_airroi_calculator_cache(p_limit integer default 1000)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_deleted integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'Invalid calculator cache cleanup limit';
  end if;
  with expired as (
    select request_key from public.airroi_calculator_cache
    where (state = 'ready' and expires_at <= v_now)
      or (state <> 'ready' and updated_at <= v_now - interval '24 hours'
        and coalesce(lease_expires_at, retry_after) <= v_now)
    order by coalesce(expires_at, updated_at), request_key
    for update skip locked limit p_limit
  )
  delete from public.airroi_calculator_cache c using expired e where c.request_key = e.request_key;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.claim_airroi_calculator_cache(text, uuid) from public, anon, authenticated;
revoke all on function public.complete_airroi_calculator_cache(text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.fail_airroi_calculator_cache(text, uuid) from public, anon, authenticated;
revoke all on function public.purge_airroi_calculator_cache(integer) from public, anon, authenticated;
grant execute on function public.claim_airroi_calculator_cache(text, uuid) to service_role;
grant execute on function public.complete_airroi_calculator_cache(text, uuid, jsonb, text) to service_role;
grant execute on function public.fail_airroi_calculator_cache(text, uuid) to service_role;
grant execute on function public.purge_airroi_calculator_cache(integer) to service_role;
