import { useEffect, useState } from 'react';
import { teamRpc } from './factoryTeam';

export type HistoryOrder = {
  order_id: string; customer_code: string; product_reference: string; title: string; garment: string;
  created_at: string; assigned_at: string | null; due_date: string | null; status: string; factory_status: string | null;
  quote_due: string | null; qc_status: string | null; released: boolean; stage: string | null; order_group: string;
  run_type: string; units: string | null; fabric: string | null; gsm: string | null; colour: string | null;
  nickname: string | null; previous_order: string | null; prior_count: number; last_order: string | null;
  is_returning: boolean; approved: boolean; delayed: boolean; action_required: boolean;
};

export type HistoryPage = {
  rows: HistoryOrder[];
  total: number;
  products: Pick<HistoryOrder, 'product_reference' | 'title' | 'garment' | 'created_at'>[];
  counts: Record<string, number | string | boolean | null>;
};

type Specification = Record<string, unknown>;
export type OrderHistory = {
  order: HistoryOrder; specification: Specification; version: number; capturedAt: string;
  versions: { version: number; capturedAt: string; specification: Specification }[];
  artworkComparison: 'Changed' | 'Unchanged' | null;
  previousSpecification: Specification | null; previousVersion: number | null; timeline: HistoryOrder[];
  productionNotes: { order_id: string; stage: string; note: string; delay_reason: string; expected_completion: string; created_at: string }[];
  quality: { order_id: string; result: string; qc_status: string; notes: string; review_note: string; submitted_at: string;
    issues: { problem: string; resolution: string; status: string }[] }[];
};

export const orderReference = (id: string) => 'ORD-' + id.slice(0, 8).toUpperCase();
export const orderLink = (id: string) => '/manufacturer/orders/' + id;
export const clientLink = (code: string) => '/manufacturer/clients/' + code;
export const historyDate = (date: string | null) => date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(date.length === 10 ? date + 'T12:00:00' : date)) : '—';
export const runLabels: Record<string, string> = { sample: 'Sample', sample_revision: 'Sample revision', bulk: 'Bulk', repeat_bulk: 'Repeat bulk', modified_repeat: 'Modified repeat', options: 'Sample / bulk options', unclassified: 'Unclassified' };
export const stageLabels: Record<string, string> = { preparation: 'Preparations', cutting_sewing: 'Cutting & Sewing', finishing: 'Finishing', quality_control: 'Quality control' };

export const specificationFields = [
  ['fabric', 'Fabric'], ['gsm', 'GSM'], ['colour', 'Colour'], ['colourways', 'Colourways'], ['materials', 'Materials'], ['fit', 'Fit'],
  ['measurements', 'Measurements'], ['sizing', 'Sizing'], ['neckline', 'Neckline'], ['sleeveStyle', 'Sleeve style'],
  ['sleeveLength', 'Sleeve length'], ['construction', 'Construction'], ['decoration', 'Printing / embroidery'],
  ['artworkRevision', 'Artwork revision'], ['supportingFiles', 'Supporting files'], ['techPackVersion', 'Tech pack version'], ['quantity', 'Quantity'],
  ['quantityPlan', 'Size quantities'],
] as const;

const hasValue = (value: unknown) => value != null && value !== '' && (typeof value !== 'object' || Object.keys(value).length > 0);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value) ?? '';
};
export function compareHistory(previous: Specification, current: Specification) {
  return specificationFields.map(([key, label]) => {
    const before = previous[key], after = current[key];
    const numeric = key === 'gsm' || key === 'quantity';
    const comparable = hasValue(before) && hasValue(after) && (numeric ? Number.isFinite(Number(before)) && Number.isFinite(Number(after)) : typeof before === typeof after && Array.isArray(before) === Array.isArray(after));
    const same = numeric ? Number(before) === Number(after) : canonical(before) === canonical(after);
    const status = !comparable ? 'Manual review' : same ? 'Unchanged' : 'Changed';
    return { key, label, before, after, status };
  });
}
export function displaySpecification(value: unknown): string {
  if (!hasValue(value)) return '—';
  if (Array.isArray(value)) return value.map(displaySpecification).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => key + ' · ' + displaySpecification(item)).join(', ');
  return String(value);
}

export function useFactoryHistory<T>(name: string, args: Record<string, unknown>, scope?: string | null, delay = 0) {
  const [result, setResult] = useState<{ key: string; context: string; data?: T; error?: string }>();
  const [retry, setRetry] = useState(0);
  const parameters = JSON.stringify(args);
  const context = JSON.stringify([name, scope, args.p_customer, args.p_order]);
  const key = JSON.stringify([context, parameters, retry]);
  useEffect(() => {
    if (!scope) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void teamRpc(name, JSON.parse(parameters)).then(
        (data: T) => { if (active) setResult({ key, context, data }); },
        (cause: unknown) => { if (active) setResult({ key, context, error: cause instanceof Error ? cause.message : 'Could not load history' }); },
      );
    }, delay);
    return () => { active = false; window.clearTimeout(timer); };
  }, [name, scope, context, key, parameters, delay]);
  return { data: result?.key === key ? result.data : undefined,
    lastData: result?.context === context ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    loading: result?.key !== key, refresh: () => setRetry(value => value + 1) };
}
