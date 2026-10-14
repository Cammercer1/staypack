-- Additive, opt-in billing. No existing agency is enrolled and no usage is backfilled.
create schema if not exists billing_private;
revoke all on schema billing_private from public, anon, authenticated;

create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id),
  livemode boolean not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan jsonb,
  status text not null default 'unsubscribed',
  period_start timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metering_enabled boolean not null default false,
  checkout_attempt uuid,
  checkout_expires_at timestamptz,
  sync_token uuid,
  sync_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_id, livemode),
  check (period_end is null or period_end > period_start)
);
-- A shared staging/production database must not charge the same action twice.
create unique index billing_accounts_one_metered_environment on public.billing_accounts(agency_id) where metering_enabled;

create table public.billing_usage_events (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.billing_accounts(id),
  agency_id uuid not null references public.agencies(id),
  livemode boolean not null,
  kind text not null check(kind in ('calculator','report')),
  source_id text not null check(length(source_id) between 1 and 160),
  quantity integer not null default 1 check(quantity = 1),
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  state text not null default 'pending' check(state in ('pending','processing','accepted','needs_review')),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  accepted_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  unique(agency_id,livemode,kind,source_id)
);
create index billing_usage_period_idx on public.billing_usage_events(billing_account_id,occurred_at);
create index billing_usage_queue_idx on public.billing_usage_events(livemode,occurred_at) where state in ('pending','processing');

create table public.billing_webhook_events (
  stripe_event_id text primary key,
  billing_account_id uuid not null references public.billing_accounts(id),
  processed_at timestamptz not null default now()
);
create index billing_webhook_account_idx on public.billing_webhook_events(billing_account_id);

alter table public.billing_accounts enable row level security;
alter table public.billing_usage_events enable row level security;
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_accounts,public.billing_usage_events,public.billing_webhook_events from public,anon,authenticated;
grant select on public.billing_accounts,public.billing_usage_events to authenticated;
grant all on public.billing_accounts,public.billing_usage_events,public.billing_webhook_events to service_role;
create policy billing_accounts_admin_read on public.billing_accounts for select to authenticated
  using (exists(select 1 from public.agency_members m where m.agency_id=billing_accounts.agency_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy billing_usage_admin_read on public.billing_usage_events for select to authenticated
  using (exists(select 1 from public.agency_members m where m.agency_id=billing_usage_events.agency_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

-- Only the server can claim checkout attempts. Concurrent browser requests reuse one attempt.
create function public.begin_billing_checkout(p_account_id uuid,p_plan jsonb)
returns public.billing_accounts language plpgsql security invoker set search_path='' as $$
declare a public.billing_accounts;
begin
  select * into strict a from public.billing_accounts where id=p_account_id for update;
  if a.stripe_subscription_id is not null and a.status not in ('canceled','incomplete_expired') then
    raise exception 'This agency already has a subscription';
  end if;
  if a.checkout_expires_at is null or a.checkout_expires_at <= now() then
    update public.billing_accounts set checkout_attempt=gen_random_uuid(),checkout_expires_at=date_trunc('second',now())+interval '1 hour',plan=p_plan
      where id=a.id returning * into a;
  elsif a.plan is distinct from p_plan then
    raise exception 'Complete the current checkout or wait for it to expire before choosing another plan';
  end if;
  return a;
end $$;

-- Serialize retrieval of current Stripe state, rather than applying out-of-order webhook snapshots.
create function public.claim_billing_sync(p_account_id uuid,p_token uuid)
returns boolean language sql security invoker set search_path='' as $$
  with claimed as (
    update public.billing_accounts set sync_token=p_token,sync_expires_at=now()+interval '2 minutes'
    where id=p_account_id and (sync_expires_at is null or sync_expires_at<now()) returning id
  ) select exists(select 1 from claimed);
$$;
create function public.finish_billing_sync(p_account_id uuid,p_token uuid,p_event_id text,p_subscription_id text,
  p_status text,p_plan jsonb,p_period_start timestamptz,p_period_end timestamptz,p_cancel boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.billing_accounts set stripe_subscription_id=p_subscription_id,status=p_status,plan=p_plan,
    period_start=p_period_start,period_end=p_period_end,cancel_at_period_end=p_cancel,metering_enabled=(p_status='active'),
    sync_token=null,sync_expires_at=null,updated_at=now()
  where id=p_account_id and sync_token=p_token and sync_expires_at>now();
  if not found then raise exception 'Billing sync lease expired'; end if;
  insert into public.billing_webhook_events(stripe_event_id,billing_account_id)
    values(p_event_id,p_account_id) on conflict do nothing;
end $$;

-- Call only after a successful standalone calculator result is persisted.
-- The source ID belongs to that persisted result, not a browser request/retry.
create function public.record_billing_usage(p_agency_id uuid,p_livemode boolean,p_kind text,p_source_id text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_kind not in ('calculator','report') then raise exception 'Invalid usage kind'; end if;
  insert into public.billing_usage_events(billing_account_id,agency_id,livemode,kind,source_id,stripe_customer_id,stripe_subscription_id,event_name)
    select a.id,a.agency_id,a.livemode,p_kind,p_source_id,a.stripe_customer_id,a.stripe_subscription_id,
      a.plan->>case when p_kind='calculator' then 'calculatorEventName' else 'reportEventName' end
    from public.billing_accounts a
    where a.agency_id=p_agency_id and a.livemode=p_livemode and a.metering_enabled
      and a.status='active' and a.stripe_customer_id is not null and a.stripe_subscription_id is not null
    on conflict(agency_id,livemode,kind,source_id) do nothing;
end $$;

-- Atomic with publication. The private definer function is needed because members
-- can publish reports but must never be allowed to forge or alter billing events.
create function billing_private.capture_report_publication()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_report_id uuid; agency uuid; live boolean;
begin
  agency := new.agency_id;
  if (select auth.uid()) is not null and not exists(
    select 1 from public.agency_members m where m.agency_id=agency and m.user_id=(select auth.uid())
  ) then raise exception 'Agency access required'; end if;
  if tg_table_name='reports' then
    if new.status<>'published' or old.published_at is not null then return new; end if;
    target_report_id:=new.id;
    if exists(select 1 from public.digital_proposal_versions v where v.report_id=target_report_id) then return new; end if;
  else
    target_report_id:=new.report_id;
    if exists(select 1 from public.digital_proposal_versions v where v.report_id=target_report_id and v.id<>new.id)
      or exists(select 1 from public.reports r where r.id=target_report_id and r.published_at is not null) then return new; end if;
  end if;
  select a.livemode into live from public.billing_accounts a where a.agency_id=agency and a.metering_enabled;
  if found then perform public.record_billing_usage(agency,live,'report',target_report_id::text); end if;
  return new;
end $$;
revoke all on function billing_private.capture_report_publication() from public,anon,authenticated;
create trigger billing_report_publication after update of status on public.reports
  for each row execute function billing_private.capture_report_publication();
create trigger billing_proposal_publication after insert on public.digital_proposal_versions
  for each row execute function billing_private.capture_report_publication();

create function public.claim_billing_usage(p_livemode boolean,p_token uuid)
returns setof public.billing_usage_events language sql security invoker set search_path='' as $$
  with batch as (
    select id from public.billing_usage_events where livemode=p_livemode
      and (state='pending' or (state='processing' and lease_expires_at<now()))
    order by occurred_at limit 25 for update skip locked
  ) update public.billing_usage_events e set state='processing',lease_token=p_token,
      lease_expires_at=now()+interval '5 minutes',first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
    from batch where e.id=batch.id returning e.*;
$$;

create function public.billing_usage_totals(p_account_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'calculators',coalesce(sum(quantity) filter(where kind='calculator'),0),
    'reports',coalesce(sum(quantity) filter(where kind='report'),0),
    'needsReview',count(*) filter(where state='needs_review')
  ) from public.billing_usage_events where billing_account_id=p_account_id and occurred_at>=p_start and occurred_at<p_end;
$$;

revoke all on function public.begin_billing_checkout(uuid,jsonb),public.claim_billing_sync(uuid,uuid),
  public.finish_billing_sync(uuid,uuid,text,text,text,jsonb,timestamptz,timestamptz,boolean),
  public.record_billing_usage(uuid,boolean,text,text),public.claim_billing_usage(boolean,uuid),
  public.billing_usage_totals(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.begin_billing_checkout(uuid,jsonb),public.claim_billing_sync(uuid,uuid),
  public.finish_billing_sync(uuid,uuid,text,text,text,jsonb,timestamptz,timestamptz,boolean),
  public.record_billing_usage(uuid,boolean,text,text),public.claim_billing_usage(boolean,uuid),
  public.billing_usage_totals(uuid,timestamptz,timestamptz) to service_role;
