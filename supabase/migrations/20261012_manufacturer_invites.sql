create extension if not exists "pgcrypto";

create table if not exists public.manufacturer_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz
);

alter table public.manufacturer_invites enable row level security;
revoke all on public.manufacturer_invites from anon, authenticated;

create or replace function public.create_manufacturer_invite(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_email text := lower(trim(p_email));
  invite_token text := encode(gen_random_bytes(32), 'hex');
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'Superadmin access required';
  end if;
  if invite_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;

  insert into public.manufacturer_invites (email, token_hash, created_by, expires_at)
  values (
    invite_email,
    encode(digest(invite_token, 'sha256'), 'hex'),
    auth.uid(),
    now() + interval '7 days'
  );
  return invite_token;
end;
$$;

create or replace function public.redeem_manufacturer_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before redeeming the manufacturer invitation';
  end if;

  select lower(email) into current_email from auth.users where id = auth.uid();
  if current_email is null then
    raise exception 'Could not verify the signed-in email';
  end if;

  select id into invite_id
  from public.manufacturer_invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and email = current_email
    and redeemed_at is null
    and expires_at > now()
  for update;

  if invite_id is null then
    raise exception 'Invitation is invalid, expired, already used, or belongs to another email';
  end if;

  update public.profiles set role = 'manufacturer' where id = auth.uid();
  if not found then
    raise exception 'Account profile is not ready; try again shortly';
  end if;

  update public.manufacturer_invites set redeemed_at = now() where id = invite_id;
end;
$$;

revoke all on function public.create_manufacturer_invite(text) from public, anon;
revoke all on function public.redeem_manufacturer_invite(text) from public, anon;
grant execute on function public.create_manufacturer_invite(text) to authenticated;
grant execute on function public.redeem_manufacturer_invite(text) to authenticated;
