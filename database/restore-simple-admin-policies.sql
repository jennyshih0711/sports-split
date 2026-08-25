alter table public.events enable row level security;
alter table public.settlement_payments enable row level security;
alter table public.settlement_batches enable row level security;

drop policy if exists "events_update_admin_only" on public.events;
drop policy if exists "settlement_payments_insert_admin_only" on public.settlement_payments;
drop policy if exists "settlement_payments_delete_admin_only" on public.settlement_payments;
drop policy if exists "settlement_batches_insert_admin_only" on public.settlement_batches;
drop policy if exists "settlement_batches_update_admin_only" on public.settlement_batches;
drop policy if exists "settlement_batches_delete_admin_only" on public.settlement_batches;

create policy "events_update_all"
on public.events
for update
using (true)
with check (true);

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
