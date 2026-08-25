create extension if not exists pgcrypto;

create table if not exists public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  from_person text not null,
  to_person text not null,
  amount numeric not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.settlement_payments enable row level security;

drop policy if exists "settlement_payments_select_all" on public.settlement_payments;
create policy "settlement_payments_select_all"
on public.settlement_payments
for select
using (true);

drop policy if exists "settlement_payments_insert_all" on public.settlement_payments;
create policy "settlement_payments_insert_all"
on public.settlement_payments
for insert
with check (true);

drop policy if exists "settlement_payments_delete_all" on public.settlement_payments;
create policy "settlement_payments_delete_all"
on public.settlement_payments
for delete
using (true);
