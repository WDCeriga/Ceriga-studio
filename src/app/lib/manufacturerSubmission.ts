import { getSupabase } from './supabaseClient';
export async function submitOrderToManufacturer(orderId: string, optionId: string): Promise<void> {
 const {data,error}=await getSupabase().rpc('submit_order_to_manufacturer',{p_order_id:orderId,p_option_id:optionId});
 if(error)throw new Error(error.message);
 if(data!==orderId)throw new Error('Order submission was not saved. Please retry.');
 window.dispatchEvent(new CustomEvent('ceriga-orders-updated'));
}
