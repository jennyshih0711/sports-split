create extension if not exists pgcrypto;

create table if not exists public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open' check (status in ('open', 'completed', 'voided')),
  transfers jsonb not null default '[]'::jsonb,
  paid_transfer_ids jsonb not null default '[]'::jsonb,
  source_detail_keys jsonb not null default '[]'::jsonb,
  source_event_ids jsonb not null default '[]'::jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.settlement_batches
add column if not exists source_detail_keys jsonb not null default '[]'::jsonb;

alter table public.settlement_batches
add column if not exists source_event_ids jsonb not null default '[]'::jsonb;

create index if not exists settlement_batches_status_created_at_idx
on public.settlement_batches (status, created_at desc);

alter table public.settlement_batches enable row level security;

drop policy if exists "settlement_batches_select_all" on public.settlement_batches;
create policy "settlement_batches_select_all"
on public.settlement_batches
for select
using (true);

drop policy if exists "settlement_batches_insert_all" on public.settlement_batches;
create policy "settlement_batches_insert_all"
on public.settlement_batches
for insert
with check (true);

drop policy if exists "settlement_batches_update_all" on public.settlement_batches;
create policy "settlement_batches_update_all"
on public.settlement_batches
for update
using (true)
with check (true);

drop policy if exists "settlement_batches_delete_all" on public.settlement_batches;
create policy "settlement_batches_delete_all"
on public.settlement_batches
for delete
using (true);
