import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useRef, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { getSupabase } from '../../lib/supabaseClient';
import { invalidateSuperadminReads } from '../../lib/superadminDb';
import { formatMoney, isCurrency } from '../../lib/currency';
import { ORDER_SIZE_KEYS } from '../../data/builderSteps';
import type { SuperAdminUser } from '../../data/superadminMock';
import { Button, buttonVariants } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';

type Entity = 'order' | 'customer' | 'manufacturer';
type Activity = { id: string; action: string; actor_name?: string; actor_id?: string; created_at: string; reason?: string; follow_up?: string; previous?: unknown; updated?: unknown };
type Snapshot = { record: Record<string, unknown>; history: Activity[] };
const rpc = async (entity:Entity,id:string|null,action:string,data:Record<string,unknown>={}) => {
  const result=await getSupabase().rpc('admin_record_action',{p_entity:entity,p_id:id,p_action:action,p_data:data});
  if(result.error) throw new Error(result.error.message);
  return result.data;
};
const message = (error:unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
const fieldClass = 'grid gap-1 text-sm';
const actionClass = 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900';
const money = (amount:number,currency:unknown) => isCurrency(currency) ? formatMoney(amount,currency) : 'Currency unavailable';

export function AdminCreateOrder({ users, customerId,loadError }: { users: SuperAdminUser[]; customerId?:string;loadError?:string|null }) {
  const { t, label: translateLabel } = useCerigaTranslation();
  const [open,setOpen]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const navigate=useNavigate();
  const create=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try{
      const {id}=await rpc('order',null,'create',Object.fromEntries(new FormData(event.currentTarget)));
      invalidateSuperadminReads();
      setOpen(false);
      void navigate('/superadmin/orders/'+id);
    }catch(cause){setError(message(cause));}finally{setBusy(false);}
  };
  return <>
    <Button onClick={()=>{setError('');setOpen(true);}}>{t('orders.create')}</Button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
      <DialogContent className="bg-white text-neutral-900">
        <DialogTitle>{t('orders.create')}</DialogTitle>
        <DialogDescription>{t('adminOrders.draftHelp')}</DialogDescription>
        <form className="space-y-3" onSubmit={create}>
          {loadError&&<p role="alert" className="text-sm text-red-700">{translateLabel(loadError)}</p>}
          <label className={fieldClass}>{t('adminOrders.customer')}<select className="rounded border p-2" name="customer" required defaultValue={customerId??''}><option value="">{t('adminOrders.selectCustomer')}</option>{users.filter(u=>u.role==='brand').map(u=><option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</select></label>
          <label className={fieldClass}>{t('adminOrders.productName')}<Input name="name" required maxLength={300}/></label>
          <label className={fieldClass}>{t('adminOrders.source')}<select className="rounded border p-2" name="source">{['Meeting','Phone','Email','Support','Other'].map(source=><option key={source} value={source}>{translateLabel(source)}</option>)}</select></label>
          {error&&<p role="alert" className="text-sm text-red-700">{cerigaTranslateLabel(error)}</p>}
          <Button disabled={busy||Boolean(loadError&&!customerId)} type="submit">{t('adminOrders.saveDraft')}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

function OrderFields({ record }: { record:Snapshot['record'] }) {
  useCerigaTranslation();

  const details=record.specifications as Record<string,string>|null;
  const quantities=record.quantities as {sample?:{bySize:Record<string,number>};bulkRuns?:{bySize:Record<string,number>}[]}|null;
  const delivery=record.delivery as Record<string,string>|null;
  return <>
    <label className={fieldClass}>{cerigaTranslate("adminOrders.productName")}<Input name="name" required maxLength={300} defaultValue={String(record.name??'')}/></label>
    <label className={fieldClass}>{cerigaTranslate("interface.text_16ead53c93914c88")}<Input name="garment" defaultValue={String(record.garment??'')}/></label>
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries({fabricType:'Fabric',colorName:'Colour',fit:'Fit',gsm:'Fabric weight (GSM)'}).map(([key,label])=><label key={key} className={fieldClass}>{cerigaTranslateLabel(label)}<Input name={key} defaultValue={details?.[key]??''} type={key==='gsm'?'number':'text'} min={key==='gsm'?1:undefined}/></label>)}
    </div>
    {!quantities?.bulkRuns?.some((run,index)=>index>0 || !Object.values(run.bySize??{}).some(Boolean))&&(['sample','bulk'] as const).map(kind=><fieldset key={kind} className="rounded border p-2">
      <legend className="text-sm">{kind==='sample'?cerigaTranslate("interface.text_1896285ea54d145b"):cerigaTranslate("interface.text_58ce8f93fa8d6f99")}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{ORDER_SIZE_KEYS.map(size=><label key={size} className={fieldClass}>{size.toUpperCase()}<Input type="number" min={0} max={1000000} name={kind+'-'+size} defaultValue={(kind==='sample'?quantities?.sample:quantities?.bulkRuns?.[0])?.bySize?.[size]||''}/></label>)}</div>
    </fieldset>)}
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries({country:'Delivery country',city:'City',address1:'Street address',postcode:'Postcode'}).map(([key,label])=><label key={key} className={fieldClass}>{cerigaTranslateLabel(label)}<Input name={'delivery-'+key} defaultValue={delivery?.[key]??''}/></label>)}
    </div>
  </>;
}

export function AdminRecordControls({ entity,id,onSaved,inline = false }: {entity:Entity;id:string;onSaved?:()=>unknown;inline?:boolean}) {
  useCerigaTranslation();

  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [view,setView]=useState<'edit'|'support'|'history'|'payment'|null>(null);
  const [payment,setPayment]=useState<{options?:{id:string;label:string;priceCents:number;currency:string;shipping?:{priceCents:number}}[];selected?:string;verifiedAt?:string;transactions:{provider_event_id:string;option_id:string;amount_cents:number;currency:string;provider_paid_at:string}[]}|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const titles = { edit: entity === 'order' ? 'Edit Order' : 'Edit Details', support: 'Record support', history: 'Activity History', payment: 'Payment details' };
  const load=async(next:NonNullable<typeof view>)=>{
    openingDialog.current = !inline;
    setSnapshot(null);
    setPayment(null);
    setBusy(true);setError('');setView(next);
    try{
      if(next==='payment')setPayment(await rpc(entity,id,'payment'));
      else setSnapshot(await rpc(entity,id,'read'));
    }catch(cause){setError(message(cause));}finally{setBusy(false);}
  };
  const save=async(event:FormEvent<HTMLFormElement>,action:string)=>{
    event.preventDefault();
    if(busy)return;
    const form=new FormData(event.currentTarget);
    let data:Record<string,unknown>=Object.fromEntries(form);
    if(action==='edit'&&entity==='order'&&form.has('garment')){
      const specs={...(snapshot?.record.specifications as Record<string,unknown>)};
      for(const key of ['fabricType','colorName','fit','gsm']){
        const value=String(form.get(key)??'').trim();
        if(value)specs[key]=key==='gsm'?Number(value):value;
        else delete specs[key];
      }
      const delivery={...(snapshot?.record.delivery as Record<string,unknown>)};
      for(const key of ['country','city','address1','postcode'])delivery[key]=form.get('delivery-'+key);
      data={name:form.get('name'),garment:form.get('garment'),notes:form.get('notes'),specifications:specs,delivery};
      if(form.has('sample-xs')){
        const line=(kind:'sample'|'bulk')=>({id:kind,kind,bySize:Object.fromEntries(ORDER_SIZE_KEYS.map(size=>[size,Number(form.get(kind+'-'+size))]))});
        const bulk=line('bulk');
        data.quantities={mode:'custom_clothing',sample:line('sample'),bulkRuns:Object.values(bulk.bySize).some(Boolean)?[bulk]:[]};
      }
    }
    setBusy(true);setError('');
    try{
      await rpc(entity,id,action,data);
      invalidateSuperadminReads();
      setSnapshot(await rpc(entity,id,'read'));
      if(action!=='send')setView(null);
      await onSaved?.();
    }catch(cause){setError(message(cause));}finally{setBusy(false);}
  };
  const record=snapshot?.record;
  const content = <>
        {busy&&<p role="status" className="text-sm text-neutral-600">{cerigaTranslate("interface.text_5474eef8d0f179c7")}</p>}
        {error&&<p role="alert" className="text-sm text-red-700">{cerigaTranslateLabel(error)}</p>}
        {view && <div className={inline ? 'mt-4 space-y-3 border-t pt-3' : 'space-y-4'}>
      {view==='history'&&snapshot&&<ul className="space-y-2 text-sm">
        {!snapshot.history.length&&<li>{cerigaTranslate("interface.text_aa570486b4d1c22f")}</li>}
        {snapshot.history.map(item=><li key={item.id}><details><summary>{item.action.replaceAll('_',' ')} · {item.actor_name||item.actor_id||cerigaTranslate("interface.text_6725e7bbcd28f3a8")} · {new Date(item.created_at).toLocaleString(cerigaLocale())}</summary>
          {item.reason&&<p className="whitespace-pre-wrap">{item.reason}</p>}{item.follow_up&&<p>{cerigaTranslate("interface.text_09b2d9cd1123792a")}{" "}{item.follow_up}</p>}
          {item.previous!=null&&<pre className="overflow-auto whitespace-pre-wrap">{cerigaTranslate("common.previous")}{" "}{JSON.stringify(item.previous,null,2)}</pre>}
          {item.updated!=null&&<pre className="overflow-auto whitespace-pre-wrap">{cerigaTranslate("interface.text_3a5ecca188c0579c")}{" "}{JSON.stringify(item.updated,null,2)}</pre>}
        </details></li>)}
      </ul>}
      {view==='payment'&&payment&&<div className="space-y-4 text-sm">
        <p className="font-medium">{payment.verifiedAt?cerigaTranslate("interface.text_c6fade462a91a693"):cerigaTranslate("interface.text_591d2b56be6886f4")}</p>
        {(payment.options??[]).filter(option=>!payment.selected||payment.selected===option.id).map(option=>{
          const paid=payment.transactions.filter(t=>t.option_id===option.id&&t.currency===option.currency).reduce((sum,t)=>sum+Number(t.amount_cents),0);
          return <div key={option.id} className="rounded-md border border-neutral-200 p-3">
            <h3 className="font-medium">{cerigaTranslateLabel(option.label)}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <div><dt className="text-neutral-600">{cerigaTranslate("adminOrders.total")}</dt><dd>{money(option.priceCents,option.currency)}</dd></div>
              {option.shipping && <div><dt className="text-neutral-600">{cerigaTranslate("nav.shipping")}</dt><dd>{money(option.shipping.priceCents,option.currency)}</dd></div>}
              <div><dt className="text-neutral-600">{cerigaTranslate("adminOrders.paid")}</dt><dd>{money(paid,option.currency)}</dd></div>
              <div><dt className="text-neutral-600">{cerigaTranslate("interface.text_e681b89952c4a88c")}</dt><dd>{money(Math.max(0,option.priceCents-paid),option.currency)}</dd></div>
            </dl>
          </div>;
        })}
        {payment.transactions.length > 0 && <div className="space-y-2">
          <h3 className="font-medium">{cerigaTranslate("interface.text_3e5136fd4b11c0dd")}</h3>
          {payment.transactions.map(t=><div key={t.provider_event_id} className="border-b border-neutral-200 pb-2">
            <p>{money(Number(t.amount_cents),t.currency)} · {new Date(t.provider_paid_at).toLocaleString(cerigaLocale())}</p>
            <p className="break-all text-xs text-neutral-600">{t.provider_event_id}</p>
          </div>)}
        </div>}
        <p>{cerigaTranslate("interface.text_7b28d1576bbcd1da")}</p>
      </div>}
      {view==='support'&&<form className="space-y-3" onSubmit={event=>void save(event,'support')}>
        <label className={fieldClass}>{cerigaTranslate("interface.text_e0cede6297a2a878")}<textarea className="rounded border p-2" name="reason" required minLength={3} maxLength={2000}/></label>
        <label className={fieldClass}>{cerigaTranslate("interface.text_a0d385abbe56d62a")}<Input type="date" name="followUp"/></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="attention" value="true"/>{cerigaTranslate("interface.text_3136d04abb0f7e9f")}</label>
        <Button type="submit" disabled={busy}>{cerigaTranslate("interface.text_68f442411f701555")}</Button>
      </form>}
      {view==='edit'&&record&&<>
        <form className="space-y-3" onSubmit={event=>void save(event,'edit')}>
          {entity==='order' ? <>
            {record.canEditDetails?<OrderFields record={record}/>:<p className="text-sm">{cerigaTranslate("interface.text_b0c3613fbd8b53a7")}</p>}
            <label className={fieldClass}>{cerigaTranslate("interface.text_d8ecfc07659de997")}<textarea className="rounded border p-2" name="notes" defaultValue={String(record.notes??'')}/></label>
          </>:Object.entries(entity==='customer'?{name:'Customer name'}:{name:'Factory name',email:'Contact email',phone:'Phone',address:'Street address',city:'City',country:'Country'}).map(([key,label])=><label className={fieldClass} key={key}>{cerigaTranslateLabel(label)}<Input name={key} defaultValue={String(record[key]??'')} required={key==='name'}/></label>)}
          <Button type="submit" disabled={busy}>{cerigaTranslate("common.saveChanges")}</Button>
        </form>
        {record.status==='admin_draft'&&<form onSubmit={event=>void save(event,'send')}><Button type="submit" variant="outline" disabled={busy}>{cerigaTranslate("interface.text_9e06dd9b08b68e27")}</Button></form>}
        {record.status==='customer_confirmation'&&<Link className="text-sm underline" to={'/orders/'+id}>{cerigaTranslate("interface.text_79c9221a5f970e05")}</Link>}
      </>}
          {(inline || view === 'edit' || view === 'support') && <Button variant="outline" disabled={busy} onClick={() => setView(null)}>{view === 'edit' || view === 'support' ? cerigaTranslate("common.cancel") : cerigaTranslate("common.close")}</Button>}
        </div>}
  </>;
  if (inline) {
    return <section className="rounded-lg border border-neutral-200 bg-white p-5 text-neutral-900 sm:p-6" aria-label={cerigaTranslate("interface.text_f6c11c9797b2fa42")}>
      <h2 className="text-sm font-semibold">{cerigaTranslate("interface.text_f6c11c9797b2fa42")}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className={actionClass} disabled={busy} onClick={() => void load('edit')}>{cerigaTranslateLabel(titles.edit)}</Button>
        <Button variant="outline" size="sm" className={actionClass} disabled={busy} onClick={() => void load('support')}>{cerigaTranslateLabel(titles.support)}</Button>
        <Button variant="outline" size="sm" className={actionClass} disabled={busy} onClick={() => void load('history')}>{cerigaTranslateLabel(titles.history)}</Button>
      </div>
      {content}
    </section>;
  }

  return <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button ref={actionsTrigger} type="button" className={buttonVariants({ variant: 'outline', className: actionClass })}>{cerigaTranslate("interface.text_ff8059dc6752afdd")}{" "}<ChevronDown aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 border-neutral-200 bg-white text-neutral-900" onCloseAutoFocus={event => {
        if (openingDialog.current) event.preventDefault();
        openingDialog.current = false;
      }}>
        <DropdownMenuItem onSelect={() => void load('edit')}>{cerigaTranslateLabel(titles.edit)}</DropdownMenuItem>
        {entity === 'order' && <DropdownMenuItem onSelect={() => void load('payment')}>{cerigaTranslateLabel(titles.payment)}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void load('support')}>{cerigaTranslateLabel(titles.support)}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void load('history')}>{cerigaTranslateLabel(titles.history)}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={view !== null} onOpenChange={open => { if (!open && !busy) setView(null); }}>
      <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-neutral-900 sm:max-w-xl" onCloseAutoFocus={event => {
        event.preventDefault();
        actionsTrigger.current?.focus();
      }}>
        <DialogTitle className="pr-6">{view && titles[view]}</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  </>;
}
