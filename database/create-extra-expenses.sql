create extension if not exists pgcrypto;

create table if not exists public.extra_expenses (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  title text not null,
  total numeric not null default 0,
  payer text not null,
  participants jsonb not null default '[]'::jsonb,
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists extra_expenses_status_created_at_idx
on public.extra_expenses (status, created_at desc);

alter table public.extra_expenses enable row level security;

drop policy if exists "extra_expenses_select_all" on public.extra_expenses;
create policy "extra_expenses_select_all"
on public.extra_expenses
for select
using (true);

drop policy if exists "extra_expenses_insert_all" on public.extra_expenses;
create policy "extra_expenses_insert_all"
on public.extra_expenses
for insert
with check (true);

drop policy if exists "extra_expenses_update_all" on public.extra_expenses;
create policy "extra_expenses_update_all"
on public.extra_expenses
for update
using (true)
with check (true);

drop policy if exists "extra_expenses_delete_all" on public.extra_expenses;
create policy "extra_expenses_delete_all"
on public.extra_expenses
for delete
using (true);
