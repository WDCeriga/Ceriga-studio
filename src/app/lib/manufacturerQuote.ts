import { getSupabase } from './supabaseClient';
import type { ManufacturerQuoteTierRow } from './ordersDb';

export async function submitManufacturerQuote(orderId: string, tiers: ManufacturerQuoteTierRow[]): Promise<void> {
  const { data, error } = await getSupabase().rpc('submit_manufacturer_quote', { p_order_id: orderId, p_tiers: tiers });
  if (error) throw new Error(error.message);
  if (data !== orderId) throw new Error('The database did not confirm quotation submission');
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
