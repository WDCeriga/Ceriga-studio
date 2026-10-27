export const QC_STAGES = { sample: 'Sample', pre_production: 'Pre-production', in_production: 'In production', final: 'Final inspection', reinspection: 'Reinspection' } as const;
export type QcStage = keyof typeof QC_STAGES;
export type RequirementCheck = { id: string; label: string; criteria: string; stage: Exclude<QcStage, 'reinspection'>; target?: number; tolerance?: number; unit?: string };
export type CheckResult = { id: string; result: 'pass' | 'fail' | 'na' | ''; actual?: number | ''; note: string; severity: 'minor' | 'major' | 'critical'; affected_units: number };
export type Requirement = { id: string; version: number; checks: RequirementCheck[]; status: string; approved_at: string; approved_by: string };
export type Inspection = { id: string; order_id: string; requirement_id: string; stage: QcStage; batch: string; size_colour: string; inspector_id: string; produced: number; inspected: number; accepted: number; rejected: number; held: number; checks: CheckResult[]; notes: string; result: 'draft' | 'passed' | 'failed'; created_at: string; submitted_at?: string; parent_defect_id?: string; reviewed_at?: string; reviewed_by?: string; review_note?: string };
export type Defect = { id: string; inspection_id: string; check_id: string; title: string; severity: string; affected_units: number; owner_name: string; action: string; due_date?: string; status: string; resolution: string; created_at: string };
export type Evidence = { id: string; inspection_id?: string; defect_id?: string; check_id: string; path: string; file_name: string };
export const QC_REPORT_STATUS = { not_submitted: 'Not Submitted', pending_review: 'Pending Review', changes_required: 'Changes Required', approved: 'Approved' } as const;
export type QcReportStatus = keyof typeof QC_REPORT_STATUS;
export type ProducedLine = { id: string; label: string; ordered: number; produced: number };
export type ReportEvidence = Evidence & { file_role: 'photo' | 'support'; mime_type?: string; byte_size?: number };
export type ProductionReport = Omit<Inspection, 'result' | 'requirement_id'> & {
 workflow_version: 2; result: 'draft' | 'submitted' | 'passed' | 'failed'; requirement_id: string | null; report_version: number; qc_status: QcReportStatus;
 production_summary: string; produced_lines: ProducedLine[]; order_snapshot: string; has_issues: boolean | null; issue_description: string;
 manufacturer_confirmed: boolean; confirmed_at?: string; photo_ids: string[]; supporting_ids: string[]; measurement_notes: string; manufacturer_id: string; draft_superseded?: boolean;
};
export type ReportContext = { ordered_lines: Omit<ProducedLine, 'produced'>[]; snapshot: string; status: QcReportStatus; manufacturer_name: string; can_submit: boolean; stage_available: boolean; unavailable_reason?: string };
export type Release = { id: string; inspection_id: string; quantity: number; reason: string; approved_at: string; revoked_at?: string; dispatched_at?: string; tracking?: string };
export type QcEvent = { id: string; action: string; actor_id: string; created_at: string; details?: { record_id?: string; reason?: string }; note?: string; defect_id?: string };
export type QcData = { requirements: Requirement[]; inspections: Inspection[]; defects: Defect[]; evidence: Evidence[]; releases: Release[]; events: QcEvent[]; defectEvents: QcEvent[] };
export const emptyQc: QcData = { requirements: [], inspections: [], defects: [], evidence: [], releases: [], events: [], defectEvents: [] };
export const defaultChecks: RequirementCheck[] = [
 { id: 'sample-spec', label: 'Sample specifications', criteria: 'Compare construction, fabric and artwork with the current order tech pack. Record required changes.', stage: 'sample' },
 { id: 'materials', label: 'Materials and approved sample', criteria: 'Verify fabric, colour, trims and approved sample before bulk production.', stage: 'pre_production' },
 { id: 'stitching', label: 'Stitching and construction', criteria: 'Check seams, hems and reinforcement against the agreed tech pack; no open seams.', stage: 'in_production' },
 { id: 'finish', label: 'Finished garment quality', criteria: 'Verify measurements against the order tech pack, finishing, colour and artwork. No unresolved defects.', stage: 'final' },
 { id: 'packaging', label: 'Labels and packing', criteria: 'Verify size labels, quantity, folding, packaging and carton markings against the order.', stage: 'final' },
];
export function measurementResult(check: RequirementCheck, actual: number | '' | undefined) {
 if (check.target == null || actual === '' || actual == null) return null;
 return Math.abs(actual - check.target) <= (check.tolerance ?? 0) + Number.EPSILON * 16 ? 'pass' : 'fail';
}
export const qcLabel = (value: string) => value.replaceAll('_', ' ').replace(/^./, x => x.toUpperCase());
