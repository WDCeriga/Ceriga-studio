create or replace function public.pending_factory_verifications()
returns table (submission_id uuid, manufacturer_id uuid, factory_name text, submitted_at timestamptz, document_count integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  return query
    select v.id, v.manufacturer_id, m.factory_name, v.submitted_at, cardinality(v.document_paths)
    from public.manufacturer_verification_submissions v
    join public.manufacturer_profiles m on m.user_id = v.manufacturer_id
    where v.status = 'pending_review'
    order by v.submitted_at, v.id;
end;
$$;

revoke all on function public.pending_factory_verifications() from public, anon, authenticated;
grant execute on function public.pending_factory_verifications() to authenticated;
notify pgrst, 'reload schema';
