begin;

create or replace function public.team_password_saved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Auth can write a temporary password before it confirms an invitation.
  -- Only a password change on an already verified account completes setup.
  if old.email_confirmed_at is not null
     and new.encrypted_password is distinct from old.encrypted_password
     and coalesce(new.encrypted_password, '') <> '' then
    update public.manufacturer_team_account_setup
    set completed_at = now()
    where user_id = new.id and completed_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.team_password_saved() from public, anon, authenticated;

commit;
