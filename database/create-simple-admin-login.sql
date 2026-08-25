create extension if not exists pgcrypto;

create table if not exists public.simple_admin_accounts (
  username text primary key,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.simple_admin_accounts enable row level security;

revoke all on table public.simple_admin_accounts from anon, authenticated;

create or replace function public.verify_simple_admin_login(input_username text, input_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  select password_hash
    into stored_hash
  from public.simple_admin_accounts
  where username = input_username;

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(input_password, stored_hash);
end;
$$;

revoke all on function public.verify_simple_admin_login(text, text) from public;
grant execute on function public.verify_simple_admin_login(text, text) to anon, authenticated;
