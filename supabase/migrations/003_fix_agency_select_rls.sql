-- Fix onboarding: allow users to read agencies they belong to via direct membership check
-- (avoids chicken-and-egg when is_agency_member helper is evaluated on fresh inserts)

drop policy if exists "Members can view their agencies" on public.agencies;

create policy "Members can view their agencies"
on public.agencies for select
using (
  exists (
    select 1
    from public.agency_members
    where agency_members.agency_id = agencies.id
      and agency_members.user_id = auth.uid()
  )
);
