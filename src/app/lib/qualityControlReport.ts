import { jsPDF } from 'jspdf';
import { QC_STAGES, qcLabel, type QcData } from '../data/qualityControl';
export function downloadQualityReport(orderId: string, data: QcData) {
 const pdf = new jsPDF(); let y = 18;
 const line = (text: string, title = false) => {
  pdf.setFontSize(title ? 14 : 10);
  const rows = pdf.splitTextToSize(text.replace(/[^\x20-\x7E\n]/g, ' '), 175);
  for (const row of rows) { if (y > 275) { pdf.addPage(); y=18; } pdf.text(row, 18, y); y += title ? 8 : 5; }
  y+=2;
 };
 line('Ceriga | Quality control report', true); line(`Order: ${orderId}`); line(`Exported: ${new Date().toLocaleString('en-GB')}`);
 for (const i of [...data.inspections].reverse()) {
  line(`${QC_STAGES[i.stage]} | ${i.batch} | ${qcLabel(i.result)}`, true);
  line(`Inspector: ${i.inspector_id} | ${i.submitted_at || 'Draft'} | ${i.size_colour}`);
  line(`Produced ${i.produced}, inspected ${i.inspected}, accepted ${i.accepted}, rejected ${i.rejected}, held ${i.held}`);
  const r = data.requirements.find(r=>r.id===i.requirement_id); line(`Requirements version ${r?.version ?? '?'} | Approved by ${r?.approved_by || 'Unknown'}`);
  for (const c of i.checks) { const spec=r?.checks.find(s=>s.id===c.id); line(`${spec?.label || c.id}: ${c.result || 'Pending'}${c.actual != null && c.actual !== '' ? ` | Actual ${c.actual} ${spec?.unit || ''}, target ${spec?.target}, tolerance +/-${spec?.tolerance}` : ''}. ${c.note}`); }
  if(i.notes)line(i.notes);
  if(i.reviewed_at)line(`Ceriga approval: ${i.reviewed_at} | ${i.reviewed_by} | ${i.review_note}`);
 }
 line('Defects and resolutions', true);
 for(const d of data.defects)line(`${d.title} | ${d.severity} | ${d.affected_units} affected units | ${qcLabel(d.status)} | Owner: ${d.owner_name || 'Unassigned'} | ${d.resolution}`);
 line('Evidence references',true); for(const e of data.evidence)line(`${e.file_name} | Check: ${e.check_id || 'Rework'} | ${e.id}`);
 line('Shipment releases',true); for(const r of data.releases)line(`${r.quantity} units | ${r.revoked_at ? 'Revoked' : r.dispatched_at ? 'Dispatched' : 'Approved'} | ${r.approved_at} | ${r.reason} | ${r.tracking || ''}`);
 line('Audit history',true); for(const e of [...data.events].reverse())line(`${e.created_at} | ${e.actor_id} | ${qcLabel(e.action)} | ${e.details?.reason || e.details?.record_id || ''}`);
 pdf.save(`QC-${orderId}.pdf`);
}
