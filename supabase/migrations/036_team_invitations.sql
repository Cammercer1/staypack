-- Team access and invitations.
-- A login user can belong to exactly one agency. Agent profiles remain separate
-- from login users and are used only for report/collateral display.

create unique index if not exists agency_members_user_id_unique_idx
on public.agency_members (user_id);

drop policy if exists "Users can create their own membership"
on public.agency_members;

create table if not exists public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_invitations_agency_id_idx
on public.agency_invitations (agency_id, created_at desc);

create unique index if not exists agency_invitations_pending_email_unique_idx
on public.agency_invitations (lower(email))
where accepted_at is null and revoked_at is null;

drop trigger if exists agency_invitations_set_updated_at
on public.agency_invitations;

create trigger agency_invitations_set_updated_at
before update on public.agency_invitations
for each row execute function public.set_updated_at();

alter table public.agency_invitations enable row level security;

comment on table public.agency_invitations is
  'Service-managed agency login invitations. Raw tokens are never stored; accepted users become agency_members.';
