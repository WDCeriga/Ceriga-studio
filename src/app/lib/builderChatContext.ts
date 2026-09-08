import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { builderSteps, type GarmentType } from '../data/builderSteps';

/**
 * Builder context for the AI support chat — summarises the user's most
 * recently edited project so assistant answers can reference the garment
 * they are actually working on ("your hoodie", "the neck type you picked").
 */

const GARMENT_LABELS: Record<GarmentType, string> = {
  tshirt: 'T-shirt',
  hoodie: 'Hoodie',
  sweatshirt: 'Sweatshirt',
  trousers: 'Trousers / joggers',
  shorts: 'Shorts',
  jacket: 'Jacket',
  dress: 'Dress',
  skirt: 'Skirt',
};

type BuilderStateShape = {
  garmentType?: GarmentType;
  fit?: string;
  fabricType?: string;
  gsm?: string;
  colors?: Array<{ hex: string; pantone: string }>;
  neckType?: string;
  sleeveType?: string;
  sleeveLength?: string;
  hemType?: string;
  cuffType?: string;
  pocketType?: string;
  zipType?: string;
  fadingType?: string;
  stitchingType?: string;
  stitchingColor?: string;
  neckTrimColor?: string;
  measurementUnit?: string;
  measurements?: Record<string, Record<string, string>>;
  prints?: Array<{ name?: string; kind?: string }>;
};

type LatestProject = {
  name: string;
  garment_type: string;
  progress: number;
  current_step: number;
  updated_at: string;
  state: BuilderStateShape | null;
};

/** Human label for a builder step id, e.g. "fabric" → "Fabric & Colour". */
function stepTitle(stepName: number): string {
  return builderSteps.find((s) => s.id === stepName)?.title ?? `Step ${stepName}`;
}

function garmentLabel(type: string | undefined): string {
  if (!type) return 'unknown garment';
  return GARMENT_LABELS[type as GarmentType] ?? type;
}

function humanize(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Fetch the most recently updated project for the signed-in user and format
 * a compact context block for the assistant. Returns null when the user is
 * signed out, the DB is unconfigured, or there are no projects yet.
 */
export async function getBuilderChatContext(): Promise<string | null> {
  try {
    if (!isSupabaseConfigured) return null;
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('projects')
      .select('name, garment_type, progress, current_step, updated_at, state')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const project = data[0] as LatestProject;
    const state = project.state ?? {};

    const lines: string[] = [];
    lines.push(`Project name: ${project.name}`);
    lines.push(`Garment: ${garmentLabel(project.garment_type)}`);
    lines.push(
      `Progress: ${project.progress}% — currently on "${stepTitle(project.current_step)}"`,
    );

    if (state.fit) lines.push(`Fit: ${humanize(state.fit)}`);
    if (state.fabricType) lines.push(`Fabric: ${humanize(state.fabricType)}`);
    if (state.gsm) lines.push(`Fabric weight: ${state.gsm} gsm`);

    const colors = (state.colors ?? [])
      .slice(0, 3)
      .map((c) => `${c.hex}${c.pantone ? ` (Pantone ${c.pantone})` : ''}`);
    if (colors.length) lines.push(`Colour(s): ${colors.join(', ')}`);

    if (state.neckType) lines.push(`Neck/collar: ${humanize(state.neckType)}`);
    if (state.sleeveType || state.sleeveLength) {
      lines.push(
        `Sleeves: ${humanize(state.sleeveType)}${state.sleeveLength ? ` · ${humanize(state.sleeveLength)}` : ''}`,
      );
    }
    if (state.hemType) lines.push(`Hem: ${humanize(state.hemType)}`);
    if (state.cuffType) lines.push(`Cuffs: ${humanize(state.cuffType)}`);
    if (state.pocketType) lines.push(`Pockets: ${humanize(state.pocketType)}`);
    if (state.zipType) lines.push(`Zip: ${humanize(state.zipType)}`);
    if (state.fadingType) lines.push(`Fading: ${humanize(state.fadingType)}`);
    if (state.stitchingType) {
      const thread = state.stitchingColor ? `, ${state.stitchingColor} thread` : '';
      lines.push(`Stitching: ${humanize(state.stitchingType)}${thread}`);
    }
    if (state.neckTrimColor) lines.push(`Neck trim: ${state.neckTrimColor}`);

    const printCount = state.prints?.length ?? 0;
    if (printCount > 0) {
      lines.push(`Prints/artwork: ${printCount} placed element${printCount === 1 ? '' : 's'}`);
    }

    const measurementGroups = Object.keys(state.measurements ?? {}).length;
    if (measurementGroups > 0) {
      lines.push(`Measurements: ${measurementGroups} group(s) entered`);
    }

    if (lines.length < 4) return null; // not enough context to be useful

    return [
      "## The user's current project (most recently edited)",
      ...lines.map((l) => `- ${l}`),
      '',
      'When the user says "my project", "this garment", or asks a question that could',
      'apply to what they are building, use the details above. Do not repeat the',
      'summary back unless asked — just use it naturally in your answers.',
    ].join('\n');
  } catch {
    return null;
  }
}
