import { useSyncExternalStore } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { convertMinor, formatMoney, isCurrency, type Currency, type RateSnapshot } from './currency';
export type CurrencyState={accountId:string|null;currency:Currency;ready:boolean;saving:boolean;error:string;rates:RateSnapshot|null;rateError:string};
let state:CurrencyState={accountId:null,currency:'EUR',ready:false,saving:false,error:'',rates:null,rateError:''};
const listeners=new Set<()=>void>();
const emit=(patch:Partial<CurrencyState>)=>{state={...state,...patch};listeners.forEach(fn=>fn());};
export const getCurrencyState=()=>state;
export const subscribeCurrency=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
let loading:Promise<void>|null=null;
export function resetCurrencyAccount(accountId:string|null){loading=null;emit({accountId,currency:'EUR',ready:!isSupabaseConfigured,error:'',saving:false,rates:null,rateError:''});}
export function refreshAccountCurrency():Promise<void>{
 if(loading)return loading;if(!isSupabaseConfigured){emit({ready:true});return Promise.resolve();}
 const account=state.accountId;if(!account)return Promise.resolve();
 const task=(async()=>{try{const {data,error}=await getSupabase().rpc('currency_context');if(error)throw new Error(error.message);if(state.accountId!==account)return;if(!isCurrency(data?.currency))throw new Error('Account currency is unavailable');emit({currency:data.currency,ready:true,error:'',rates:data.rates,rateError:data.rate_error||''});}catch(error){if(state.accountId===account)emit({ready:false,error:error instanceof Error?error.message:'Could not load account currency'});}})();loading=task;void task.finally(()=>{if(loading===task)loading=null;});return task;
}
let writes:Promise<unknown>=Promise.resolve();
export function setAccountCurrency(currency:Currency):Promise<void>{
 if(!isCurrency(currency))return Promise.reject(new Error('Choose EUR, USD or GBP.'));
 const account=state.accountId;emit({saving:true,error:''});
 const operation=writes.catch(()=>undefined).then(async()=>{try{if(state.accountId!==account)throw new Error('Account changed before currency was saved');if(isSupabaseConfigured){if(!account)throw new Error('Sign in to save currency.');const {data,error}=await getSupabase().rpc('set_account_currency',{p_currency:currency});if(error||data!==currency)throw new Error(error?.message||'Currency was not saved');}if(state.accountId===account){emit({currency,ready:true,error:'',saving:false});window.dispatchEvent(new CustomEvent('ceriga-account-currency-changed',{detail:currency}));}}catch(error){if(state.accountId===account)emit({saving:false,error:error instanceof Error?error.message:'Could not save currency'});throw error;}});writes=operation;return operation;
}
export function useCurrency(){return useSyncExternalStore(subscribeCurrency,getCurrencyState,getCurrencyState);}
/** Display-only: stored cents and source currency are never mutated. Missing FX keeps the labelled original. */
export function displayMoney(cents:number,source:Currency|undefined,locale?:string):string{
 if(!isCurrency(source))return `${Number.isSafeInteger(cents)?(cents/100).toFixed(2):'—'} (currency needs review)`;
 if(!state.accountId)return formatMoney(cents,source,locale);
 if(!state.ready||state.error)return `${formatMoney(cents,source,locale)} (original; preference unavailable)`;
 try{const converted=convertMinor(cents,source,state.currency,state.rates);return `${formatMoney(converted,state.currency,locale)}${source!==state.currency?' ≈':''}`;}catch{return `${formatMoney(cents,source,locale)} (original; conversion unavailable)`;}
}

export function sumConvertedMinor(rows:{cents:number;currency?:Currency}[],target:Currency=state.currency):number|undefined{try{let total=0;for(const row of rows){if(!isCurrency(row.currency))return undefined;total+=convertMinor(row.cents,row.currency,target,state.rates);if(!Number.isSafeInteger(total))return undefined;}return total;}catch{return undefined;}}
export function formatAccountTotal(cents:number|undefined):string{return cents===undefined?'Total unavailable — review currencies/rates':formatMoney(cents,state.currency);}

export function transactionMoney(cents:number,source:Currency|undefined):string{if(!isCurrency(source))return displayMoney(cents,source);const original=formatMoney(cents,source);if(source===state.currency)return original;const displayed=displayMoney(cents,source);return displayed.includes('≈')?original+' · indicative '+displayed:original;}
