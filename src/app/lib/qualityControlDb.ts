import{currentFactoryId}from './factoryTeam';
import { getSupabase } from './supabaseClient';
import type { QcData, Evidence } from '../data/qualityControl';
export async function loadQualityControl(orderId: string): Promise<QcData> {
 const names = ['qc_requirement_versions','qc_inspections','qc_defects','qc_evidence','qc_shipment_releases','qc_audit_events','qc_defect_events'];
 const results = await Promise.all(names.map(name => getSupabase().from(name).select('*').eq('order_id', orderId).order(name === 'qc_shipment_releases' ? 'approved_at' : 'created_at', { ascending: false })));
 const failed = results.find(result => result.error);
 if (failed?.error) throw new Error(`QC could not load: ${failed.error.message}`);
 const [requirements, inspections, defects, evidence, releases, events, defectEvents] = results.map(result => result.data ?? []);
 return { requirements: requirements.sort((a,b) => b.version-a.version), inspections, defects, evidence, releases, events, defectEvents } as QcData;
}
export async function qcAction(orderId: string, action: string, data: object = {}): Promise<string> {
 const result = await getSupabase().rpc('qc_action', { p_order: orderId, p_action: action, p_data: data });
 if (result.error) throw new Error(result.error.message);
 if (!result.data) throw new Error('The QC action did not persist. Please reload and retry.');
 return result.data;
}
export async function uploadQcEvidence(orderId: string, file: File, target: { inspection_id?: string; defect_id?: string; check_id?: string }) {
 if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPG, PNG, WebP or PDF up to 10 MB.');
 const client = getSupabase();
 const { data: { user }, error } = await client.auth.getUser();
 if (error || !user) throw new Error('Sign in to upload evidence.');
 const path = `${orderId}/${await currentFactoryId()}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const uploaded = await client.storage.from('qc-evidence').upload(path, file, { upsert: false });
 if (uploaded.error) throw new Error(uploaded.error.message);
 try { await qcAction(orderId, 'evidence', { ...target, path, file_name: file.name }); }
 catch (cause) { await client.storage.from('qc-evidence').remove([path]); throw cause; }
}
export async function openQcEvidence(evidence: Evidence) {
 const { data, error } = await getSupabase().storage.from('qc-evidence').createSignedUrl(evidence.path, 120);
 if (error || !data?.signedUrl) throw new Error(error?.message || 'Evidence is unavailable.');
 const link = document.createElement('a'); link.href = data.signedUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
}
