-- Preserve profiles and listing references when an agent leaves the agency.
alter table public.agent_profiles add column if not exists archived_at timestamptz;
-- Preserve the oldest existing default if an older installation has several.
with ranked as (
  select id, row_number() over (partition by agency_id order by created_at, id) as position
  from public.agent_profiles where is_default
)
update public.agent_profiles set is_default = false
where id in (select id from ranked where position > 1);
create unique index if not exists agent_profiles_one_active_default
  on public.agent_profiles (agency_id) where is_default and archived_at is null;
alter table public.agent_profiles add constraint agent_profiles_archived_not_default
  check (archived_at is null or not is_default);

-- One transaction for clearing a previous default and saving the new one.
-- Invoker rights preserve existing RLS; the agency check also covers empty inserts.
create or replace function public.manage_agent_profile(
  target_agency uuid, target_id uuid, operation text, values_json jsonb default '{}', expected_updated_at timestamptz default null
) returns public.agent_profiles
language plpgsql security invoker set search_path = '' as $$
declare result public.agent_profiles;
begin
  if not public.is_agency_admin(target_agency) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_agency::text, 0));
  if operation not in ('create', 'save', 'archive', 'restore', 'default') then
    raise exception 'Unknown agent action';
  end if;
  if operation <> 'create' then
    select * into result from public.agent_profiles where id = target_id and agency_id = target_agency for update;
    if not found then raise exception 'Agent not found'; end if;
    if expected_updated_at is not null and result.updated_at <> expected_updated_at then
      raise exception 'This profile changed elsewhere. Close and reopen it before saving.' using errcode = '40001';
    end if;
    if result.archived_at is not null and operation in ('save', 'default') then
      raise exception 'Restore this agent before editing or setting a default';
    end if;
  end if;
  if operation in ('create', 'save') then
    if nullif(btrim(values_json->>'name'), '') is null then raise exception 'Name is required'; end if;
    if coalesce((values_json->>'is_default')::boolean, false) then
      update public.agent_profiles set is_default = false where agency_id = target_agency and is_default and id is distinct from target_id;
    end if;
    if operation = 'create' then
      insert into public.agent_profiles (agency_id,name,email,phone,role_title,photo_url,is_default)
      values (target_agency,btrim(values_json->>'name'),nullif(btrim(values_json->>'email'),''),nullif(btrim(values_json->>'phone'),''),nullif(btrim(values_json->>'role_title'),''),nullif(values_json->>'photo_url',''),coalesce((values_json->>'is_default')::boolean,false)) returning * into result;
    else
      update public.agent_profiles set name=btrim(values_json->>'name'), email=nullif(btrim(values_json->>'email'),''), phone=nullif(btrim(values_json->>'phone'),''), role_title=nullif(btrim(values_json->>'role_title'),''), photo_url=nullif(values_json->>'photo_url',''), is_default=coalesce((values_json->>'is_default')::boolean,false)
      where id=target_id and agency_id=target_agency returning * into result;
    end if;
  elsif operation = 'default' then
    update public.agent_profiles set is_default=false where agency_id=target_agency and is_default and id<>target_id;
    update public.agent_profiles set is_default=true where id=target_id and agency_id=target_agency returning * into result;
  elsif operation = 'archive' then
    update public.agent_profiles set archived_at=coalesce(archived_at,now()),is_default=false where id=target_id and agency_id=target_agency returning * into result;
  else
    update public.agent_profiles set archived_at=null where id=target_id and agency_id=target_agency returning * into result;
  end if;
  return result;
end;
$$;
revoke all on function public.manage_agent_profile(uuid,uuid,text,jsonb,timestamptz) from public, anon;
grant execute on function public.manage_agent_profile(uuid,uuid,text,jsonb,timestamptz) to authenticated;
