create or replace function public.factory_onboarding_checklist(p_manufacturer uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  factory public.manufacturer_profiles%rowtype;
  verification_status text;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select * into factory from public.manufacturer_profiles where user_id = p_manufacturer;
  if not found and not exists (
    select 1 from public.profiles where id = p_manufacturer and role = 'manufacturer'
  ) then
    return null;
  end if;

  select status into verification_status
  from public.manufacturer_verification_submissions
  where manufacturer_id = p_manufacturer
  order by version desc
  limit 1;

  return jsonb_build_object(
    'setup_complete', coalesce(factory.onboarding_complete, false),
    'completed_steps', factory.profile_details->'completedSteps',
    'onboarding_step', factory.profile_details->'onboardingStep',
    'verification_status', coalesce(verification_status, 'not_submitted')
  );
end;
$$;

revoke all on function public.factory_onboarding_checklist(uuid) from public, anon, authenticated;
grant execute on function public.factory_onboarding_checklist(uuid) to authenticated;
notify pgrst, 'reload schema';
