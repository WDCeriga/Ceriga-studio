import { getSupabase } from './supabaseClient';
import { getOrder } from './ordersDb';
import type { UserOrder } from '../data/userOrders';
import type { Inspection, ProductionReport, ReportContext, ReportEvidence, Release } from '../data/qualityControl';
export type QcWorkspace = { order: UserOrder; context: ReportContext; reports: ProductionReport[]; legacy: Inspection[]; evidence: ReportEvidence[]; releases: Release[] };
export async function loadQcWorkspace(orderId: string): Promise<QcWorkspace> {
 const client = getSupabase();
 const [order, context, inspections, evidence, releases] = await Promise.all([
  getOrder(orderId), client.rpc('qc_report_context', {p_order:orderId}),
  client.from('qc_inspections').select('*').eq('order_id',orderId).order('created_at',{ascending:false}),
  client.from('qc_evidence').select('*').eq('order_id',orderId),
  client.from('qc_shipment_releases').select('*').eq('order_id',orderId).order('approved_at',{ascending:false}),
 ]);
 for (const response of [context,inspections,evidence,releases]) if (response.error) throw new Error(response.error.message);
 if (!order || !context.data) throw new Error('Order not found or QC access is no longer available.');
 return {order,context:context.data,reports:(inspections.data||[]).filter(r=>r.workflow_version===2).sort((a,b)=>b.report_version-a.report_version),legacy:(inspections.data||[]).filter(r=>r.workflow_version!==2),evidence:evidence.data||[],releases:releases.data||[]} as QcWorkspace;
}
