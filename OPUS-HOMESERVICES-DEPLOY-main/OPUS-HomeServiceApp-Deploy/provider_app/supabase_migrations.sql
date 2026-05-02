-- ============================================================
-- OPUS Provider App — Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── 1. support_tickets ──────────────────────────────────────
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  category    text not null default 'Other',
  order_ref   text,
  description text not null,
  status      text not null default 'Pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create policy "Provider can manage their own tickets"
  on public.support_tickets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ─── 2. support_contacts ─────────────────────────────────────
create table if not exists public.support_contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  subject    text not null default 'Support',
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.support_contacts enable row level security;

create policy "Provider can insert their own contact messages"
  on public.support_contacts
  for insert
  with check (auth.uid() = user_id);

create policy "Provider can view their own contact messages"
  on public.support_contacts
  for select
  using (auth.uid() = user_id);

-- ─── 3. provider_withdrawals ─────────────────────────────────
create table if not exists public.provider_withdrawals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount          numeric(12, 2) not null check (amount >= 100),
  method          text not null check (method in ('IMPS', 'NEFT', 'UPI')),
  -- Bank details (null when method = UPI)
  account_holder  text,
  account_number  text,
  ifsc_code       text,
  -- UPI details (null when method != UPI)
  upi_id          text,
  -- Status managed by backend/admin
  status          text not null default 'pending'
                    check (status in ('pending', 'processing', 'completed', 'failed')),
  failure_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.provider_withdrawals enable row level security;

create policy "Provider can insert their own withdrawals"
  on public.provider_withdrawals
  for insert
  with check (auth.uid() = user_id);

create policy "Provider can view their own withdrawals"
  on public.provider_withdrawals
  for select
  using (auth.uid() = user_id);

create trigger provider_withdrawals_updated_at
  before update on public.provider_withdrawals
  for each row execute function public.set_updated_at();

-- ─── 4. provider_company_info ────────────────────────────────
create table if not exists public.provider_company_info (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users(id) on delete cascade,
  company_name     text,
  type_of_business text,
  services_offered text,
  phone            text,
  email            text,
  address          text,
  photo_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.provider_company_info enable row level security;

create policy "Provider can manage their own company info"
  on public.provider_company_info
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger provider_company_info_updated_at
  before update on public.provider_company_info
  for each row execute function public.set_updated_at();

-- ─── 5. delete_provider_account RPC ──────────────────────────
-- Called from the app when a provider requests account deletion.
-- Deletes the provider's profile row; cascade constraints remove
-- all linked rows.  The auth.users row is then deleted via
-- supabase.auth.admin.deleteUser() called from a secure Edge Function
-- (or the admin can run it manually in the dashboard).
create or replace function public.delete_provider_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Remove provider profile (cascades to linked rows via FK)
  delete from public.providers_profiles where id = v_user_id;

  -- Remove company info
  delete from public.provider_company_info where user_id = v_user_id;

  -- Remove support data
  delete from public.support_tickets where user_id = v_user_id;
  delete from public.support_contacts where user_id = v_user_id;
  delete from public.provider_withdrawals where user_id = v_user_id;

  -- NOTE: The auth.users row must be deleted separately by an admin
  -- or via a Supabase Edge Function that calls auth.admin.deleteUser().
end;
$$;

-- Grant execute to authenticated users only
revoke execute on function public.delete_provider_account() from public;
grant execute on function public.delete_provider_account() to authenticated;
