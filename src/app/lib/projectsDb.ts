import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type { ProjectFlowType } from './projectFlow';

export type ProjectRow = {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  garment_type: string;
  flow_type: ProjectFlowType;
  progress: number;
  current_step: number;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProjectListItem = Pick<
  ProjectRow,
  | 'id'
  | 'product_id'
  | 'name'
  | 'garment_type'
  | 'flow_type'
  | 'progress'
  | 'current_step'
  | 'updated_at'
  | 'created_at'
  | 'state'
>;

export type UpsertProjectInput = {
  id?: string;
  productId: string;
  name: string;
  garmentType: string;
  flowType: ProjectFlowType;
  progress: number;
  currentStep: number;
  state: Record<string, unknown>;
};

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

export async function listProjects(): Promise<ProjectListItem[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, product_id, name, garment_type, flow_type, progress, current_step, updated_at, created_at, state',
    )
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectListItem[];
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as ProjectRow | null) ?? null;
}

export async function upsertProject(input: UpsertProjectInput): Promise<ProjectRow> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to save a project');

  const payload = {
    ...(input.id ? { id: input.id } : {}),
    user_id: user.id,
    product_id: input.productId,
    name: input.name,
    garment_type: input.garmentType,
    flow_type: input.flowType,
    progress: Math.round(Math.min(100, Math.max(0, input.progress))),
    current_step: input.currentStep,
    state: input.state,
  };

  const { data, error } = await supabase
    .from('projects')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function deleteProject(id: string): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}
