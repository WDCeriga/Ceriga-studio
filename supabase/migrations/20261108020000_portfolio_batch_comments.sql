begin;
alter table public.manufacturer_portfolio_items add column if not exists image_comments jsonb not null default '{}';
comment on column public.manufacturer_portfolio_items.image_comments is 'Optional photo comments keyed by an image_paths entry; published atomically with the portfolio example.';

create or replace function public.validate_portfolio_image_comments() returns trigger
language plpgsql set search_path=public as $$
declare entry record;
begin
 if jsonb_typeof(new.image_comments) is distinct from 'object' then raise exception 'Photo comments must be an object';end if;
 if cardinality(new.image_paths)>100 then raise exception 'Use no more than 100 images';end if;
 for entry in select * from jsonb_each(new.image_comments) loop
  if not(entry.key=any(new.image_paths)) or jsonb_typeof(entry.value)<>'string' or length(entry.value#>>'{}')>2000 then
   raise exception 'Each photo comment must belong to an attached image and contain at most 2000 characters';
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.validate_portfolio_image_comments() from public,anon,authenticated;
drop trigger if exists portfolio_validate_image_comments on public.manufacturer_portfolio_items;
create trigger portfolio_validate_image_comments before insert or update on public.manufacturer_portfolio_items
for each row execute function public.validate_portfolio_image_comments();

-- Keep the existing team permission wrapper, upload ownership checks and optimistic version lock.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.team_impl_save_portfolio_item(jsonb,uuid,integer)'::regprocedure) into definition;
 definition:=replace(definition,'cardinality(paths)>20','cardinality(paths)>100');
 definition:=replace(definition,'Use no more than 20 images','Use no more than 100 images');
 if position('image_comments' in definition)=0 then
  definition:=replace(definition,'methods,image_paths)values','methods,image_paths,image_comments)values');
  definition:=replace(definition,',paths)returning',',paths,coalesce(p_item->''image_comments'',''{}''::jsonb))returning');
  definition:=replace(definition,'image_paths=paths,version=',
   'image_paths=paths,image_comments=coalesce(p_item->''image_comments'',(select coalesce(jsonb_object_agg(key,value),''{}''::jsonb) from jsonb_each(row.image_comments) where key=any(paths))),version=');
  if position('image_comments=coalesce' in definition)=0 or position('image_paths,image_comments)values' in definition)=0 then
   raise exception 'Install the current portfolio API before enabling photo comments';
  end if;
 end if;
 execute definition;
end $migration$;
revoke all on function public.team_impl_save_portfolio_item(jsonb,uuid,integer) from public,anon,authenticated;
-- Existing table RLS, grants and allowlisted superadmin access cover the new column.
select public.apply_superadmin_access();
notify pgrst,'reload schema';
commit;
