-- Property identity is a server-created hash, including the unit and country.
-- Existing cache rows remain exact-coordinate entries until safely adopted.
-- Reports, leads, saved evidence, navigation and billing are not changed.
alter table public.airroi_calculator_cache
  add column property_key text,
  add column configuration_key text,
  add column provider_input jsonb,
  add constraint airroi_calculator_cache_property_shape_check check (
    (property_key is null and configuration_key is null and provider_input is null)
    or (property_key is not null and property_key ~ '^[a-f0-9]{64}$'
      and configuration_key is not null and configuration_key ~ '^[a-f0-9]{64}$'
      and provider_input is not null and jsonb_typeof(provider_input) = 'object'
      and provider_input ?& array['latitude','longitude','bedrooms','bathrooms','accommodates','radiusM','currency']
      and provider_input - array['latitude','longitude','bedrooms','bathrooms','accommodates','radiusM','currency'] = '{}'::jsonb
      and jsonb_typeof(provider_input->'latitude') = 'number'
      and jsonb_typeof(provider_input->'longitude') = 'number'
      and jsonb_typeof(provider_input->'bedrooms') = 'number'
      and jsonb_typeof(provider_input->'bathrooms') = 'number'
      and jsonb_typeof(provider_input->'accommodates') = 'number'
      and jsonb_typeof(provider_input->'radiusM') = 'number'
      and jsonb_typeof(provider_input->'currency') = 'string'
      and (provider_input->>'latitude')::numeric between -90 and 90
      and (provider_input->>'longitude')::numeric between -180 and 180
      and (provider_input->>'bedrooms')::numeric >= 0
      and (provider_input->>'bathrooms')::numeric >= 0
      and (provider_input->>'accommodates')::numeric > 0
      and (provider_input->>'radiusM')::numeric > 0
      and provider_input->>'currency' in ('AUD','USD'))
  );

create index airroi_calculator_cache_property_configuration_idx
  on public.airroi_calculator_cache (property_key, configuration_key)
  where property_key is not null;

comment on column public.airroi_calculator_cache.property_key is
  'Server-only hash of a complete normalized property address, including country and unit. Never inferred from proximity alone.';
comment on column public.airroi_calculator_cache.provider_input is
  'Original effective provider coordinates and configuration. Immutable while a result/lease/cooldown is reused; no addresses or contact details.';

create function public.claim_airroi_property_calculator_cache(
  p_request_key text,
  p_legacy_request_key text,
  p_lease_owner uuid,
  p_property_key text,
  p_configuration_key text,
  p_input jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.airroi_calculator_cache;
  v_result jsonb;
  v_now timestamptz;
begin
  if p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$'
    or p_legacy_request_key is null or p_legacy_request_key !~ '^[a-f0-9]{64}$'
    or p_request_key = p_legacy_request_key
    or p_lease_owner is null
    or p_property_key is null or p_property_key !~ '^[a-f0-9]{64}$'
    or p_configuration_key is null or p_configuration_key !~ '^[a-f0-9]{64}$'
    or p_input is null or jsonb_typeof(p_input) <> 'object'
    or not (p_input ?& array['latitude','longitude','bedrooms','bathrooms','accommodates','radiusM','currency'])
    or p_input - array['latitude','longitude','bedrooms','bathrooms','accommodates','radiusM','currency'] <> '{}'::jsonb
    or jsonb_typeof(p_input->'latitude') <> 'number'
    or jsonb_typeof(p_input->'longitude') <> 'number'
    or jsonb_typeof(p_input->'bedrooms') <> 'number'
    or jsonb_typeof(p_input->'bathrooms') <> 'number'
    or jsonb_typeof(p_input->'accommodates') <> 'number'
    or jsonb_typeof(p_input->'radiusM') <> 'number'
    or jsonb_typeof(p_input->'currency') <> 'string' then
    raise exception using errcode = '22023', message = 'Invalid property calculator cache request';
  end if;
  if (p_input->>'latitude')::numeric not between -90 and 90
    or (p_input->>'longitude')::numeric not between -180 and 180
    or (p_input->>'bedrooms')::numeric < 0 or (p_input->>'bathrooms')::numeric < 0
    or (p_input->>'accommodates')::numeric <= 0 or (p_input->>'radiusM')::numeric <= 0
    or p_input->>'currency' not in ('AUD','USD') then
    raise exception using errcode = '22023', message = 'Invalid property calculator cache inputs';
  end if;

  -- Coordinate variants share one short transaction lock. Paid HTTP calls run
  -- after the RPC commits; the normal durable lease coordinates their workers.
  perform pg_advisory_xact_lock(hashtextextended('airroi-property:' || p_property_key || ':' || p_configuration_key, 0));
  v_now := clock_timestamp();
  select * into v_row from public.airroi_calculator_cache c
    where c.property_key = p_property_key and c.configuration_key = p_configuration_key
      -- Check the effective values too, rather than relying only on a supplied hash.
      and c.provider_input - array['latitude','longitude'] = p_input - array['latitude','longitude']
      and ((c.state = 'ready' and c.expires_at > v_now)
        or (c.state = 'pending' and c.lease_expires_at > v_now)
        or (c.state = 'cooldown' and c.retry_after > v_now))
      -- Haversine distance, always against the ORIGINAL provider anchor. A hit
      -- never moves that anchor, so repeated nearby requests cannot walk it.
      and 12742000 * asin(sqrt(least(1::double precision,
        power(sin(radians(((c.provider_input->>'latitude')::double precision - (p_input->>'latitude')::double precision) / 2)), 2)
        + cos(radians((p_input->>'latitude')::double precision))
          * cos(radians((c.provider_input->>'latitude')::double precision))
          * power(sin(radians(((c.provider_input->>'longitude')::double precision - (p_input->>'longitude')::double precision) / 2)), 2)
      ))) <= 50
    order by case c.state when 'ready' then 0 when 'pending' then 1 else 2 end,
      c.created_at, c.request_key
    limit 1 for update;

  -- Before rollout, exact v1 rows had no property identity. The service caller
  -- supplies the existing v1 hash of these exact effective inputs. Only one
  -- property may adopt that row; a row lock also serializes different units
  -- at identical coordinates, whose property advisory locks are different.
  if not found then
    select * into v_row from public.airroi_calculator_cache c
      where c.request_key = p_legacy_request_key and c.property_key is null
      for update;
    v_now := clock_timestamp();
    if found and ((v_row.state = 'ready' and v_row.expires_at > v_now)
      or (v_row.state = 'pending' and v_row.lease_expires_at > v_now)
      or (v_row.state = 'cooldown' and v_row.retry_after > v_now)) then
      update public.airroi_calculator_cache set property_key = p_property_key,
        configuration_key = p_configuration_key, provider_input = p_input
        where request_key = v_row.request_key returning * into v_row;
    else
      v_row := null;
    end if;
  end if;

  v_now := clock_timestamp();
  if v_row.request_key is not null then
    if v_row.state = 'ready' and v_row.expires_at > v_now then
      update public.airroi_calculator_cache set hit_count = hit_count + 1, updated_at = v_now
        where request_key = v_row.request_key;
      return jsonb_build_object('status', 'hit', 'response', v_row.response,
        'fetched_at', v_row.fetched_at, 'expires_at', v_row.expires_at, 'request_id', v_row.request_id,
        'request_key', v_row.request_key, 'provider_input', v_row.provider_input);
    elsif v_row.state = 'pending' and v_row.lease_expires_at > v_now then
      return jsonb_build_object('status', 'pending', 'retry_at', v_row.lease_expires_at,
        'request_key', v_row.request_key, 'provider_input', v_row.provider_input);
    elsif v_row.state = 'cooldown' and v_row.retry_after > v_now then
      return jsonb_build_object('status', 'cooldown', 'retry_at', v_row.retry_after,
        'request_key', v_row.request_key, 'provider_input', v_row.provider_input);
    end if;
  end if;

  -- Expired fuzzy entries are not re-leased with their old coordinate key.
  -- Claim the caller's property-specific exact key and retain the current anchor.
  v_result := public.claim_airroi_calculator_cache(p_request_key, p_lease_owner);
  select * into strict v_row from public.airroi_calculator_cache
    where request_key = p_request_key for update;
  if v_row.property_key is not null and (v_row.property_key <> p_property_key
    or v_row.configuration_key <> p_configuration_key or v_row.provider_input <> p_input) then
    raise exception using errcode = '22023', message = 'Property calculator cache key mismatch';
  end if;
  if v_result->>'status' = 'claimed' and v_row.lease_owner = p_lease_owner then
    update public.airroi_calculator_cache set property_key = p_property_key,
      configuration_key = p_configuration_key, provider_input = p_input
      where request_key = p_request_key returning * into v_row;
  elsif v_row.property_key is null then
    raise exception using errcode = '22023', message = 'Property calculator cache metadata missing';
  end if;
  return v_result || jsonb_build_object('request_key', v_row.request_key, 'provider_input', v_row.provider_input);
end;
$$;

revoke all on function public.claim_airroi_property_calculator_cache(text,text,uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_airroi_property_calculator_cache(text,text,uuid,text,text,jsonb)
  to service_role;
