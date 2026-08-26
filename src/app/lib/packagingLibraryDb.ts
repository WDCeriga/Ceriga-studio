import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export type PackagingSnapshot = {
  packagingType: string;
  packagingColor: string;
  notes: string;
  elements: DesignElement[];
};

export type PackagingLibraryRow = {
  id: string;
  user_id: string;
  name: string;
  snapshot: PackagingSnapshot;
  created_at: string;
  updated_at: string;
};

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

export async function listPackagingLibrary(): Promise<PackagingLibraryRow[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('packaging_library')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PackagingLibraryRow[];
}

export async function insertPackagingLibrary(
  name: string,
  snapshot: PackagingSnapshot,
): Promise<PackagingLibraryRow> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to save packaging');

  const { data, error } = await supabase
    .from('packaging_library')
    .insert({
      user_id: user.id,
      name: name.trim() || 'Packaging',
      snapshot,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PackagingLibraryRow;
}

export async function deletePackagingLibrary(id: string): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { error } = await supabase.from('packaging_library').delete().eq('id', id);
  if (error) throw error;
}
