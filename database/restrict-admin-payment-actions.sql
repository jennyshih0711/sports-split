create or replace function public.is_sports_split_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'jennyshih0711@gmail.com';
$$;

alter table public.events enable row level security;
alter table public.settlement_payments enable row level security;
alter table public.settlement_batches enable row level security;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and cmd = 'UPDATE'
  loop
    execute format('drop policy if exists %I on public.events', policy_name);
  end loop;

  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'settlement_payments'
      and cmd in ('INSERT', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.settlement_payments', policy_name);
  end loop;

  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'settlement_batches'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.settlement_batches', policy_name);
  end loop;
end $$;

create policy "events_update_admin_only"
on public.events
for update
using (public.is_sports_split_admin())
with check (public.is_sports_split_admin());

create policy "settlement_payments_insert_admin_only"
on public.settlement_payments
for insert
with check (public.is_sports_split_admin());

create policy "settlement_payments_delete_admin_only"
on public.settlement_payments
for delete
using (public.is_sports_split_admin());

create policy "settlement_batches_insert_admin_only"
on public.settlement_batches
for insert
with check (public.is_sports_split_admin());

create policy "settlement_batches_update_admin_only"
on public.settlement_batches
for update
using (public.is_sports_split_admin())
with check (public.is_sports_split_admin());

create policy "settlement_batches_delete_admin_only"
on public.settlement_batches
for delete
using (public.is_sports_split_admin());
