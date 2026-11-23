import {loadFreight} from './freight';
import { getSupabase } from './supabaseClient';
import type { ManufacturerQuoteTierRow } from './ordersDb';
import { rowToUserOrder, type OrderRow } from './ordersDb';

export async function fetchComparisonRequests(orderId?: string) {
  const { data, error } = await getSupabase().rpc('factory_comparison_requests', orderId ? { p_order: orderId } : {});
  if (error?.code === 'PGRST202') return [];
  if (error) throw new Error(error.message);
  return ((data ?? []) as OrderRow[]).map(rowToUserOrder);
}

export async function respondToComparison(orderId: string, tiers: ManufacturerQuoteTierRow[], comments: string, decline = false) {
  const { data, error } = await getSupabase().rpc('factory_respond_comparison', {
    p_order: orderId, p_tiers: tiers, p_comments: comments, p_decline: decline,
  });
  if (error || data !== orderId) throw new Error(error?.message ?? 'The response was not saved.');
  window.dispatchEvent(new Event('ceriga-orders-updated'));
}

export async function submitManufacturerQuote(orderId: string, tiers: ManufacturerQuoteTierRow[]): Promise<void> {
  // An older backend would silently drop unknown shipping fields. Fail before saving until the migration is live.
  try { await loadFreight(orderId); } catch(cause) {
    const message=cause instanceof Error?cause.message:'Could not verify shipping availability';
    throw new Error(/could not find.*freight_context/i.test(message)?'Shipping quotations are not enabled in the database yet. Ceriga must deploy the freight update before this quotation can be submitted.':message);
  }
  const { data, error } = await getSupabase().rpc('submit_manufacturer_quote', { p_order_id: orderId, p_tiers: tiers });
  if (error) throw new Error(error.message);
  if (data !== orderId) throw new Error('The database did not confirm quotation submission');
  window.dispatchEvent(new Event('ceriga-orders-updated'));
}

/** Keeps the existing quote validators and adds an atomic edit-version check. */
export async function submitCheckedFactoryQuote(orderId:string,tiers:ManufacturerQuoteTierRow[],expected:{at:string|null;status:string},comparison=false,comments='') {
  const {data,error}=await getSupabase().rpc('submit_factory_quote_checked',{
    p_order:orderId,p_tiers:tiers,p_expected:expected,p_comparison:comparison,p_comments:comments,
  });
  if(error||data!==orderId)throw Object.assign(new Error(error?.message??'The database did not confirm quotation submission'),{code:error?.code});
  window.dispatchEvent(new Event('ceriga-orders-updated'));
}

export async function rejectOrderQuotation(orderId: string, reason: string): Promise<'rejected' | 'clarifying'> {
  const { data, error } = await getSupabase().rpc('reject_order_quotation', { p_order_id: orderId, p_reason: reason });
  if (error) throw new Error(error.message);
  if (data !== 'rejected' && data !== 'clarifying') throw new Error('The database did not confirm rejection');
  window.dispatchEvent(new Event('ceriga-orders-updated'));
  return data;
}

export type QuotationRejectionAction = 'revise' | 'reassign';
export async function reviewManufacturerQuotation(orderId:string,reason:string,nextAction:QuotationRejectionAction):Promise<void>{
 const {data,error}=await getSupabase().rpc('review_manufacturer_quotation',{p_order_id:orderId,p_reason:reason,p_next_action:nextAction});
 if(error)throw new Error(error.message);if(data!==nextAction)throw new Error('The database did not confirm quotation rejection');
 window.dispatchEvent(new Event('ceriga-orders-updated'));
}
