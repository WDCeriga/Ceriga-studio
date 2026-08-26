import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export type MeasurementGuideGarmentType = 'tshirt' | 'hoodie' | 'trousers';

export type MeasurementGuidePackGuide = {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  labelAlign: 'left' | 'center' | 'right';
};

export type MeasurementGuidePack = {
  garmentType: MeasurementGuideGarmentType;
  assetId: string;
  guides: MeasurementGuidePackGuide[];
  updatedAt?: string;
  updatedBy?: string | null;
};

type MeasurementGuidePackRow = {
  garment_type: string;
  asset_id: string;
  guides: unknown;
  updated_at: string;
  updated_by: string | null;
};

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

function isGarmentType(value: string): value is MeasurementGuideGarmentType {
  return value === 'tshirt' || value === 'hoodie' || value === 'trousers';
}

function normalizePackGuides(raw: unknown): MeasurementGuidePackGuide[] {
  if (!Array.isArray(raw)) return [];
  const next: MeasurementGuidePackGuide[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Partial<MeasurementGuidePackGuide>;
    if (typeof g.id !== 'string' || !g.id.trim()) continue;
    const id = g.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    next.push({
      id,
      label: typeof g.label === 'string' ? g.label : '',
      x1: Number(g.x1) || 0,
      y1: Number(g.y1) || 0,
      x2: Number(g.x2) || 0,
      y2: Number(g.y2) || 0,
      labelX: Number(g.labelX) || 0,
      labelY: Number(g.labelY) || 0,
      labelAlign:
        g.labelAlign === 'left' || g.labelAlign === 'right' || g.labelAlign === 'center'
          ? g.labelAlign
          : 'center',
    });
  }
  return next;
}

export async function fetchAllMeasurementGuidePacks(): Promise<MeasurementGuidePack[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('measurement_guide_packs')
    .select('garment_type, asset_id, guides, updated_at, updated_by');

  if (error) throw error;

  const rows: MeasurementGuidePack[] = [];
  for (const row of (data ?? []) as MeasurementGuidePackRow[]) {
    if (!isGarmentType(row.garment_type) || !row.asset_id) continue;
    rows.push({
      garmentType: row.garment_type,
      assetId: row.asset_id,
      guides: normalizePackGuides(row.guides),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });
  }
  return rows;
}

export async function upsertMeasurementGuidePack(
  garmentType: MeasurementGuideGarmentType,
  assetId: string,
  guides: MeasurementGuidePackGuide[],
): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to save measurement guides');

  const { error } = await supabase.from('measurement_guide_packs').upsert(
    {
      garment_type: garmentType,
      asset_id: assetId,
      guides,
      updated_by: user.id,
    },
    { onConflict: 'garment_type,asset_id' },
  );
  if (error) throw error;
}

export async function deleteMeasurementGuidePack(
  garmentType: MeasurementGuideGarmentType,
  assetId: string,
): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('measurement_guide_packs')
    .delete()
    .eq('garment_type', garmentType)
    .eq('asset_id', assetId);
  if (error) throw error;
}
