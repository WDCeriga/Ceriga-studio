-- Allow category-only questions while the assigned factory is preparing or revising a quotation.
do $migration$
declare
  definition text := pg_get_functiondef('public.order_communication_action(uuid,text,text,uuid,integer,text,text,jsonb,jsonb,boolean)'::regprocedure);
  original text := 'if p_category in (''fabric'',''colour'',''moq'',''timeline'',''quotation'') and new_proposal is null then';
  revised text := $condition$if p_category in ('fabric','colour','moq','timeline','quotation') and new_proposal is null
        and not (
          o.kind='production' and o.status in ('submitted','awaiting_payment')
          and coalesce(o.factory_status,'new') in ('new','reviewing','clarifying','quoted')
          and o.payment_verified_at is null and o.production_released_at is null
          and r.proposal is null
        ) then$condition$;
begin
  if strpos(definition,revised)>0 then return; end if;
  if strpos(definition,original)=0 then raise exception 'Order communication proposal guard has changed'; end if;
  execute replace(definition,original,revised);
end
$migration$;
