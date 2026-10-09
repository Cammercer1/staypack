-- Match contact details within an agency, including archived profiles.
-- Names alone are not unique. Existing duplicates are not merged or deleted.
create or replace function public.agent_contact_phone(value text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case
    when value ~ '[^0-9+()[:space:].-]' or length(digits) not between 8 and 15 then ''
    when digits like '61%' and length(digits) = 11 then '0' || substr(digits, 3)
    else digits end
  from (select regexp_replace(regexp_replace(coalesce(value,''), '[^0-9]', '', 'g'), '^00', '') as digits) normalized;
$$;

create or replace function public.prevent_duplicate_agent_contacts()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  matching public.agent_profiles;
  check_email boolean := true;
  check_phone boolean := true;
  normalized_email text := lower(btrim(coalesce(new.email,'')));
  normalized_phone text := public.agent_contact_phone(new.phone);
begin
  -- Same lock as manage_agent_profile: concurrent saves cannot race the check.
  perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text, 0));
  if tg_op = 'UPDATE' and new.agency_id = old.agency_id then
    check_email := normalized_email is distinct from lower(btrim(coalesce(old.email,'')));
    check_phone := normalized_phone is distinct from public.agent_contact_phone(old.phone);
  end if;
  select * into matching from public.agent_profiles p
  where p.agency_id = new.agency_id and p.id is distinct from new.id and (
    (check_email and normalized_email <> '' and lower(btrim(p.email)) = normalized_email) or
    (check_phone and normalized_phone <> '' and public.agent_contact_phone(p.phone) = normalized_phone)
  ) order by p.archived_at nulls first, p.created_at, p.id limit 1;
  if found then
    raise exception 'An agent already uses this email or phone. Edit or restore the existing profile.'
      using errcode = '23505', detail = json_build_object('agent_id', matching.id)::text;
  end if;
  return new;
end;
$$;
create trigger agent_profiles_prevent_duplicate_contacts
before insert or update of email, phone, agency_id on public.agent_profiles
for each row execute function public.prevent_duplicate_agent_contacts();
create index if not exists agent_profiles_email_match on public.agent_profiles (agency_id, lower(btrim(email))) where email is not null;
create index if not exists agent_profiles_phone_match on public.agent_profiles (agency_id, public.agent_contact_phone(phone)) where phone is not null;
revoke all on function public.prevent_duplicate_agent_contacts() from public, anon, authenticated;
revoke all on function public.agent_contact_phone(text) from public, anon;
grant execute on function public.agent_contact_phone(text) to authenticated, service_role;
